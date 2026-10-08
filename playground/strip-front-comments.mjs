import {createRequire} from 'node:module';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const REPO = 'C:/Users/lavantien/dev/github/FlowerShop';
const SRC = join(REPO, 'frontend/src');
const require = createRequire(join(REPO, 'frontend', 'package.json'));
const ts = require('typescript');

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir, {withFileTypes: true})) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

function tsCommentRanges(text, path) {
	const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const seen = new Set();
	const ranges = [];
	const collect = (position) => {
		for (const range of ts.getLeadingCommentRanges(text, position) ?? []) {
			if (!seen.has(range.pos)) {
				seen.add(range.pos);
				ranges.push([range.pos, range.end]);
			}
		}
		for (const range of ts.getTrailingCommentRanges(text, position) ?? []) {
			if (!seen.has(range.pos)) {
				seen.add(range.pos);
				ranges.push([range.pos, range.end]);
			}
		}
	};
	let lastEnd = 0;
	const visit = (node) => {
		collect(node.getFullStart());
		lastEnd = Math.max(lastEnd, node.getEnd());
		for (const child of node.getChildren(sourceFile)) visit(child);
	};
	visit(sourceFile);
	collect(lastEnd);
	ranges.sort((a, b) => a[0] - b[0]);
	return ranges;
}

function scssCommentRanges(text) {
	const ranges = [];
	let i = 0;
	const n = text.length;
	while (i < n) {
		const c = text[i];
		if (c === "'" || c === '"') {
			const quote = c;
			i++;
			while (i < n) {
				if (text[i] === '\\') {
					i += 2;
					continue;
				}
				if (text[i] === quote) {
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (c === '/' && i + 1 < n) {
			if (text[i + 1] === '/') {
				const start = i;
				while (i < n && text[i] !== '\n') i++;
				ranges.push([start, i]);
				continue;
			}
			if (text[i + 1] === '*') {
				const start = i;
				i += 2;
				while (i + 1 < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
				i = Math.min(i + 2, n);
				ranges.push([start, i]);
				continue;
			}
		}
		i++;
	}
	return ranges;
}

function htmlCommentRanges(text) {
	const ranges = [];
	let i = 0;
	while (true) {
		const start = text.indexOf('<!--', i);
		if (start === -1) break;
		let end = text.indexOf('-->', start + 4);
		end = end === -1 ? text.length : end + 3;
		ranges.push([start, end]);
		i = end;
	}
	return ranges;
}

function expandRemovals(text, ranges) {
	const spans = [];
	for (const [start, end] of ranges) {
		const lineStart = text.lastIndexOf('\n', start - 1) + 1;
		const before = text.slice(lineStart, start);
		let restStart = end;
		while (restStart < text.length && (text[restStart] === ' ' || text[restStart] === '\t')) restStart++;
		let lineEnd = text.indexOf('\n', restStart);
		if (lineEnd === -1) lineEnd = text.length;
		const rest = text.slice(restStart, lineEnd).replace(/\r$/, '');
		if (before.trim() === '' && rest.trim() === '') {
			spans.push([lineStart, Math.min(lineEnd + 1, text.length)]);
		} else {
			let trimmedStart = start;
			while (trimmedStart > lineStart && (text[trimmedStart - 1] === ' ' || text[trimmedStart - 1] === '\t')) trimmedStart--;
			spans.push([trimmedStart, end]);
		}
	}
	return spans;
}

function apply(text, spans) {
	spans.sort((a, b) => a[0] - b[0]);
	for (let i = 1; i < spans.length; i++) {
		if (spans[i][0] < spans[i - 1][1]) throw new Error('overlapping removal spans');
	}
	let out = '';
	let pos = 0;
	for (const [start, end] of spans) {
		out += text.slice(pos, start);
		pos = end;
	}
	out += text.slice(pos);
	return out;
}

function strip(text, kind, path) {
	const ranges = kind === 'ts' ? tsCommentRanges(text, path) : kind === 'scss' ? scssCommentRanges(text) : htmlCommentRanges(text);
	if (!ranges.length) return null;
	const out = apply(text, expandRemovals(text, ranges));
	if (kind === 'ts' && tsCommentRanges(out, path).length) throw new Error('residual comment in ' + path);
	return {out, count: ranges.length};
}

const files = walk(SRC).filter(p => /\.(ts|html|scss)$/.test(p));
let changedFiles = 0;
let removedComments = 0;
for (const path of files) {
	const kind = path.endsWith('.ts') ? 'ts' : path.endsWith('.scss') ? 'scss' : 'html';
	const text = readFileSync(path, 'utf8');
	const result = strip(text, kind, path);
	if (!result || result.out === text) continue;
	writeFileSync(path, result.out);
	changedFiles++;
	removedComments += result.count;
}
let residual = 0;
for (const path of files) {
	const kind = path.endsWith('.ts') ? 'ts' : path.endsWith('.scss') ? 'scss' : 'html';
	const text = readFileSync(path, 'utf8');
	const ranges = kind === 'ts' ? tsCommentRanges(text, path) : kind === 'scss' ? scssCommentRanges(text) : htmlCommentRanges(text);
	if (ranges.length) {
		residual += ranges.length;
		console.error('RESIDUAL ' + ranges.length + ' in ' + path);
	}
}
console.log('files scanned: ' + files.length);
console.log('files changed: ' + changedFiles);
console.log('comments removed: ' + removedComments);
console.log('residual comments: ' + residual);
if (residual) process.exit(1);
