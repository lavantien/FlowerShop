import {writeFileSync} from 'node:fs';

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

function escapeXml(text) {
	return text.replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[ch]));
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

writeFileSync('docs/badges/qa.svg', badge('qa', 'passed', '#4c1'), 'utf8');
console.log(`label=${textWidth('qa')} value=${textWidth('passed')} aws=${textWidth('aws')} ready=${textWidth('ready')} passing=${textWidth('passing')}`);
