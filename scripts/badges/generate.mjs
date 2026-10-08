import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

function arg(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : fallback;
}

const backendCsv = arg('backend-csv', 'target/site/jacoco/jacoco.csv');
const frontendSummary = arg('frontend-summary', 'frontend/coverage/frontend/coverage-summary.json');
const ciStatus = arg('ci', 'passed');
const outDir = arg('out', 'badges-out');

function escapeXml(text) {
	return text.replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[ch]));
}

function textWidth(text) {
	let width = 0;
	for (const ch of text) {
		if ("iljI.,:;'|! ".includes(ch)) {
			width += 4;
		} else if ("mwMW@".includes(ch)) {
			width += 10;
		} else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
			width += 7.5;
		} else {
			width += 6.2;
		}
	}
	return Math.round(width + 20);
}

function badge(label, value, color) {
	const labelWidth = textWidth(label);
	const valueWidth = textWidth(value);
	const width = labelWidth + valueWidth;
	const center = offset => Math.round(offset / 2);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="10" font-weight="bold">
    <text x="${center(labelWidth)}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + center(valueWidth)}" y="14">${escapeXml(value)}</text>
  </g>
</svg>
`;
}

function coverageColor(percent) {
	if (percent >= 90) {
		return '#4c1';
	}
	if (percent >= 75) {
		return '#dfb317';
	}
	if (percent >= 60) {
		return '#fe7d37';
	}
	return '#e05d44';
}

async function readPercentOrNull(reader, source) {
	try {
		return await reader();
	} catch (error) {
		console.log(`[badge] ${source} unreadable (${error.code ?? error.message}), rendering unknown`);
		return null;
	}
}

async function backendCoveragePercent() {
	const csv = await readFile(backendCsv, 'utf8');
	let missed = 0;
	let covered = 0;
	for (const line of csv.split('\n').slice(1)) {
		const columns = line.split(',');
		if (columns.length < 6 || columns[3] === '' || columns[4] === '') {
			continue;
		}
		missed += Number(columns[3]);
		covered += Number(columns[4]);
	}
	if (missed + covered === 0) {
		throw new Error(`no instruction counts found in ${backendCsv}`);
	}
	return (100 * covered) / (missed + covered);
}

async function frontendCoveragePercent() {
	const summary = JSON.parse(await readFile(frontendSummary, 'utf8'));
	const pct = summary?.total?.lines?.pct;
	if (typeof pct !== 'number') {
		throw new Error(`no total.lines.pct in ${frontendSummary}`);
	}
	return pct;
}

function formatPercent(raw) {
	const floored = Math.floor(raw * 100) / 100;
	return `${floored.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function coverageBadge(label, percent) {
	if (percent === null) {
		return badge(label, 'unknown', '#9f9f9f');
	}
	return badge(label, formatPercent(percent), coverageColor(Math.floor(percent)));
}

await mkdir(outDir, {recursive: true});
const backendPercent = await readPercentOrNull(backendCoveragePercent, backendCsv);
const frontendPercent = await readPercentOrNull(frontendCoveragePercent, frontendSummary);
const badges = [
	['backend-coverage.svg', coverageBadge('backend coverage', backendPercent)],
	['frontend-coverage.svg', coverageBadge('frontend coverage', frontendPercent)],
	['ci.svg', badge('ci', ciStatus === 'passed' ? 'passed' : 'failed', ciStatus === 'passed' ? '#4c1' : '#e05d44')]
];
for (const [name, svg] of badges) {
	await writeFile(path.join(outDir, name), svg);
	console.log(`[badge] ${name}`);
}
try {
	await copyFile('docs/badges/aws-ready.svg', path.join(outDir, 'aws-ready.svg'));
	console.log('[badge] aws-ready.svg');
} catch {
	console.log('[badge] docs/badges/aws-ready.svg missing, skipped');
}
try {
	await copyFile('docs/badges/qa.svg', path.join(outDir, 'qa.svg'));
	console.log('[badge] qa.svg');
} catch {
	console.log('[badge] docs/badges/qa.svg missing, skipped');
}
try {
	await copyFile('docs/badges/security.svg', path.join(outDir, 'security.svg'));
	console.log('[badge] security.svg');
} catch {
	console.log('[badge] docs/badges/security.svg missing, skipped');
}
