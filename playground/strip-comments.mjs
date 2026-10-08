import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
	console.error('usage: node strip-comments.mjs <file.mjs|file.ps1>');
	process.exit(1);
}
const raw = readFileSync(file, 'utf8');
const bom = raw.charCodeAt(0) === 0xfeff ? '﻿' : '';
const body = bom ? raw.slice(1) : raw;
const eol = body.includes('\r\n') ? '\r\n' : '\n';
const lines = body.split(/\r?\n/);
const endsWithNewline = body.endsWith('\n');

function stripJsLine(line, ctx) {
	const out = [];
	let i = 0;
	const n = line.length;
	while (i < n) {
		const c = line[i];
		if (ctx.state === 'linecomment') {
			ctx.sawComment = true;
			break;
		}
		if (ctx.state === 'blockcomment') {
			ctx.sawComment = true;
			if (c === '*' && line[i + 1] === '/') {
				i += 2;
				ctx.state = 'code';
			} else {
				i++;
			}
			continue;
		}
		if (ctx.state === 'sq' || ctx.state === 'dq') {
			out.push(c);
			if (c === '\\') {
				if (i + 1 < n) {
					out.push(line[i + 1]);
					i += 2;
					continue;
				}
				i++;
				continue;
			}
			if ((ctx.state === 'sq' && c === "'") || (ctx.state === 'dq' && c === '"')) {
				ctx.lastSig = c;
				ctx.lastWord = '';
				ctx.state = 'code';
			}
			i++;
			continue;
		}
		if (ctx.state === 'tpl') {
			out.push(c);
			if (c === '\\') {
				if (i + 1 < n) {
					out.push(line[i + 1]);
					i += 2;
					continue;
				}
				i++;
				continue;
			}
			if (c === '`') {
				ctx.lastSig = '`';
				ctx.lastWord = '';
				ctx.state = 'code';
			} else if (c === '$' && line[i + 1] === '{') {
				out.push('{');
				ctx.stack.push({depth: 0});
				ctx.state = 'code';
				i += 2;
				continue;
			}
			i++;
			continue;
		}
		if (ctx.state === 'regex') {
			out.push(c);
			if (c === '\\') {
				if (i + 1 < n) {
					out.push(line[i + 1]);
					i += 2;
					continue;
				}
				i++;
				continue;
			}
			if (c === '[') {
				ctx.regexClass = true;
			} else if (c === ']') {
				ctx.regexClass = false;
			} else if (c === '/' && !ctx.regexClass) {
				let flags = '';
				while (i + 1 < n && /[a-z]/.test(line[i + 1])) {
					flags += line[i + 1];
					i++;
				}
				out.push(flags);
				ctx.lastSig = flags ? flags[flags.length - 1] : '/';
				ctx.lastWord = flags;
				ctx.state = 'code';
			}
			i++;
			continue;
		}
		if (c === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) {
			ctx.sawComment = true;
			if (line[i + 1] === '/') {
				ctx.state = 'linecomment';
				break;
			}
			ctx.state = 'blockcomment';
			i += 2;
			continue;
		}
		if (c === '/' && regexCanStart(ctx)) {
			ctx.state = 'regex';
			ctx.regexClass = false;
			out.push(c);
			i++;
			continue;
		}
		out.push(c);
		if (c === "'") {
			ctx.state = 'sq';
		} else if (c === '"') {
			ctx.state = 'dq';
		} else if (c === '`') {
			ctx.state = 'tpl';
		} else if (c === '{' && ctx.stack.length) {
			ctx.stack[ctx.stack.length - 1].depth++;
		} else if (c === '}') {
			const top = ctx.stack[ctx.stack.length - 1];
			if (top && top.depth === 0) {
				ctx.stack.pop();
				ctx.state = 'tpl';
			} else if (top) {
				top.depth--;
			}
		}
		if (!/\s/.test(c)) {
			ctx.lastSig = c;
			if (/[A-Za-z0-9_$]/.test(c)) {
				ctx.lastWord = (ctx.lastWord || '') + c;
			} else {
				ctx.lastWord = '';
			}
		}
		i++;
	}
	return out.join('');
}

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'case', 'delete', 'void', 'new', 'do', 'else', 'yield', 'await']);

function regexCanStart(ctx) {
	if (ctx.lastSig === '') {
		return true;
	}
	if (/[A-Za-z0-9_$]/.test(ctx.lastSig)) {
		return KEYWORDS_BEFORE_REGEX.has(ctx.lastWord || '');
	}
	if (')]}'.includes(ctx.lastSig)) {
		return false;
	}
	if (ctx.lastSig === '"' || ctx.lastSig === "'" || ctx.lastSig === '`') {
		return false;
	}
	return true;
}

function stripJsAll(lines) {
	const ctx = {state: 'code', lastSig: '', lastWord: '', stack: [], regexClass: false, sawComment: false};
	const outLines = [];
	if (lines[0].startsWith('#!')) {
		outLines.push(lines[0]);
		lines = lines.slice(1);
	}
	for (const line of lines) {
		ctx.sawComment = false;
		const kept = stripJsLine(line, ctx);
		if (ctx.state === 'linecomment') {
			ctx.state = 'code';
		}
		const trimmed = ctx.sawComment ? kept.replace(/\s+$/, '') : kept;
		const wasBlank = line.trim() === '';
		if (trimmed === '' && !wasBlank && ctx.sawComment) {
			continue;
		}
		outLines.push(trimmed);
	}
	return outLines;
}

function stripPs1Line(line, state) {
	const out = [];
	let i = 0;
	const n = line.length;
	let s = state.state;
	let sawComment = false;
	while (i < n) {
		const c = line[i];
		if (s === 'code') {
			if (c === '<' && line[i + 1] === '#') {
				s = 'blockcomment';
				sawComment = true;
				i += 2;
				continue;
			}
			if (c === '#') {
				sawComment = true;
				break;
			}
			out.push(c);
			if (c === "'") {
				s = 'sq';
			} else if (c === '"') {
				s = 'dq';
			}
		} else if (s === 'sq') {
			out.push(c);
			if (c === "'") {
				if (line[i + 1] === "'") {
					out.push("'");
					i += 2;
					continue;
				}
				s = 'code';
			}
		} else if (s === 'dq') {
			out.push(c);
			if (c === '`') {
				if (i + 1 < n) {
					out.push(line[i + 1]);
					i += 2;
					continue;
				}
			} else if (c === '"') {
				s = 'code';
			}
		}
		i++;
	}
	const kept = sawComment ? out.join('').replace(/\s+$/, '') : out.join('');
	return {kept, endState: s === 'blockcomment' ? 'blockcomment' : 'code', sawComment};
}

function stripPs1All(lines) {
	const outLines = [];
	let inBlock = false;
	for (const line of lines) {
		if (inBlock) {
			const close = line.indexOf('#>');
			if (close === -1) {
				continue;
			}
			inBlock = false;
			const rest = line.slice(close + 2);
			const kept = rest.replace(/^\s+/, '').replace(/\s+$/, '');
			if (kept || line.trim() === '') {
				outLines.push(kept);
			}
			continue;
		}
		const {kept, endState, sawComment} = stripPs1Line(line, {state: 'code'});
		if (endState === 'blockcomment') {
			inBlock = true;
		}
		const wasBlank = line.trim() === '';
		if (kept === '' && !wasBlank && sawComment) {
			continue;
		}
		outLines.push(kept);
	}
	return outLines;
}

if (lines.length && lines[lines.length - 1] === '') {
	lines.pop();
}
const stripped = file.endsWith('.ps1') ? stripPs1All(lines) : stripJsAll(lines);
let text = stripped.join(eol);
if (endsWithNewline) {
	text += eol;
}
text = text.replace(/(\r?\n){3,}/g, '$1$1');
writeFileSync(file, bom + text, 'utf8');
console.log(`${file}: ${lines.length} -> ${text.split(/\r?\n/).length} lines`);
