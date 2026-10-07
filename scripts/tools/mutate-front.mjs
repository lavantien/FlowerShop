#!/usr/bin/env node
// Source-level mutation harness for the Angular side, the mutate.mjs
// conventions adapted to TypeScript over the core and services classes listed
// in scripts/tools/mutation-front-map.json. One mutant at a time, applied to
// the working tree, only the mapped spec files run through the Angular
// unit-test builder. A compile failure, a test failure, or a hang all count
// as killed, a green selective run is a survivor and fails the gate. Every
// mutated file is restored with git after each mutant and verified against
// git diff before the next. Serialized: one mutant, one build, one run at a
// time. A control run over the mapped specs must pass unmutated before the
// sweep: missing node_modules, a broken builder, or a genuinely red suite
// would otherwise turn every nonzero exit into a phantom kill and hand the
// gate a false all-killed report. Writes the committed artifact
// docs/qa/mutation-front-report.md. Run
// via `make mutate-front`. Exit 0 on zero survivors, 1 otherwise. --list
// prints the curated mutant set without running anything, --only <id> runs a
// single mutant for triage.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts/tools/qa.json'), 'utf8'))['mutate-front'];
const map = JSON.parse(readFileSync(join(ROOT, cfg.mapPath), 'utf8'));

const args = process.argv.slice(2);
const LIST_ONLY = args.includes('--list');
const onlyId = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

function git(...gitArgs) {
	const result = spawnSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' });
	if (result.error) {
		throw new Error(`git ${gitArgs.join(' ')} could not run: ${result.error.message}`);
	}
	return result.stdout.trimEnd();
}

function killTree(pid) {
	if (process.platform === 'win32') {
		// taskkill /T reaches the whole process tree, child.kill() would not.
		spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
	} else {
		try {
			process.kill(-pid, 'SIGKILL');
		} catch {
			try {
				process.kill(pid, 'SIGKILL');
			} catch {}
		}
	}
}

// Mask string literals, template literals (interpolation included), char
// literals, and comments so token scanners only see code. Masked characters
// become \x01, offsets stay identical to the raw line. Code units, not code
// points, so indices always align with string slicing.
function maskLine(line, state) {
	const chars = line.split('');
	let inString = false;
	let inChar = false;
	let inTemplate = false;
	for (let i = 0; i < chars.length; i++) {
		const c = chars[i];
		if (state.inBlockComment) {
			if (c === '*' && chars[i + 1] === '/') {
				chars[i] = '\x01';
				chars[i + 1] = '\x01';
				i++;
				state.inBlockComment = false;
			} else {
				chars[i] = '\x01';
			}
			continue;
		}
		if (inString) {
			if (c === '\\') {
				chars[i] = '\x01';
				if (i + 1 < chars.length) {
					chars[i + 1] = '\x01';
					i++;
				}
			} else if (c === '"') {
				inString = false;
			} else {
				chars[i] = '\x01';
			}
			continue;
		}
		if (inChar) {
			if (c === '\\') {
				chars[i] = '\x01';
				if (i + 1 < chars.length) {
					chars[i + 1] = '\x01';
					i++;
				}
			} else if (c === '\'') {
				inChar = false;
			} else {
				chars[i] = '\x01';
			}
			continue;
		}
		if (inTemplate) {
			if (c === '\\') {
				chars[i] = '\x01';
				if (i + 1 < chars.length) {
					chars[i + 1] = '\x01';
					i++;
				}
			} else if (c === '`') {
				inTemplate = false;
				chars[i] = '\x01';
			} else {
				chars[i] = '\x01';
			}
			continue;
		}
		if (c === '/' && chars[i + 1] === '/') {
			for (let j = i; j < chars.length; j++) {
				chars[j] = '\x01';
			}
			break;
		}
		if (c === '/' && chars[i + 1] === '*') {
			state.inBlockComment = true;
			chars[i] = '\x01';
			chars[i + 1] = '\x01';
			i++;
			continue;
		}
		if (c === '"') {
			inString = true;
		} else if (c === '\'') {
			inChar = true;
		} else if (c === '`') {
			inTemplate = true;
			chars[i] = '\x01';
		}
	}
	state.inTemplate = inTemplate;
	return chars.join('');
}

const STRINGISH = new Set(['"', '\'', '`', '\x01']);

function nearString(masked, index, prevTail) {
	let i = index - 1;
	while (i >= 0 && /\s/.test(masked[i])) {
		i--;
	}
	if (i < 0) {
		// Nothing before the operator on this line: a continuation of the
		// previous one, a string there makes this a concat, not arithmetic.
		const tail = (prevTail ?? '').trimEnd();
		return tail.length > 0 && STRINGISH.has(tail[tail.length - 1]);
	}
	if (STRINGISH.has(masked[i])) {
		return true;
	}
	i = index + 1;
	while (i < masked.length && /\s/.test(masked[i])) {
		i++;
	}
	return i < masked.length && STRINGISH.has(masked[i]);
}

function scanLine(rawLine, masked, prevTail) {
	const edits = [];
	const push = (start, length, to, op) => edits.push({ start, length, to, op });
	// Strict equality only: loose == and != never enter the codebase, the
	// eslint config bans them.
	for (const match of masked.matchAll(/===/g)) {
		push(match.index, 3, '!==', 'STRICT_EQ_TO_NE');
	}
	for (const match of masked.matchAll(/!==/g)) {
		push(match.index, 3, '===', 'STRICT_NE_TO_EQ');
	}
	for (const match of masked.matchAll(/&&/g)) {
		push(match.index, 2, '||', 'AND_TO_OR');
	}
	for (const match of masked.matchAll(/\|\|/g)) {
		push(match.index, 2, '&&', 'OR_TO_AND');
	}
	// Comparison boundaries. Whitespace or an opening paren before and
	// whitespace, semicolon, or closing paren after keeps generics,
	// arrow functions, and type unions out.
	for (const match of masked.matchAll(/(?<=[\s(])<=(?=[\s;)])/g)) {
		push(match.index, 2, '<', 'LE_TO_LT');
	}
	for (const match of masked.matchAll(/(?<=[\s(])>=(?=[\s;)])/g)) {
		push(match.index, 2, '>', 'GE_TO_GT');
	}
	for (const match of masked.matchAll(/(?<=[\s(])<(?=[\s;)])/g)) {
		push(match.index, 1, '<=', 'LT_TO_LE');
	}
	for (const match of masked.matchAll(/(?<=[\s(])>(?=[\s;)])/g)) {
		push(match.index, 1, '>=', 'GT_TO_GE');
	}
	for (let index = 0; index < masked.length; index++) {
		const c = masked[index];
		if (c === '+' && masked[index + 1] !== '+' && masked[index - 1] !== '+'
			&& masked[index + 1] !== '=' && masked[index - 1] !== '=' && !nearString(masked, index, prevTail)) {
			push(index, 1, '-', 'ADD_TO_SUB');
		}
		if (c === '-' && masked[index + 1] !== '>' && masked[index + 1] !== '-' && masked[index - 1] !== '-'
			&& masked[index + 1] !== '=' && masked[index - 1] !== '=' && !nearString(masked, index, prevTail)) {
			push(index, 1, '+', 'SUB_TO_ADD');
		}
		if (c === '*' && masked[index + 1] !== '*' && masked[index - 1] !== '*' && !nearString(masked, index, prevTail)) {
			push(index, 1, '/', 'MUL_TO_DIV');
		}
		if (c === '/' && masked[index + 1] !== '/' && masked[index - 1] !== '/' && !nearString(masked, index, prevTail)) {
			push(index, 1, '*', 'DIV_TO_MUL');
		}
		if (c === '!' && masked[index + 1] !== '=' && /[A-Za-z_(]/.test(masked[index + 1] ?? '')) {
			push(index, 1, '', 'NOT_DROP');
		}
	}
	for (const match of masked.matchAll(/(?<![\w.'"\x01])0(?![\w.'"\x01])/g)) {
		push(match.index, 1, '1', 'LIT_0_TO_1');
	}
	for (const match of masked.matchAll(/(?<![\w.'"\x01])1(?![\w.'"\x01])/g)) {
		push(match.index, 1, '0', 'LIT_1_TO_0');
	}
	for (const match of masked.matchAll(/\.(min|max)\(/g)) {
		const which = masked[match.index + 1] === 'm' && masked[match.index + 2] === 'i' ? 'max' : 'min';
		push(match.index + 1, 3, which, 'MIN_MAX');
	}
	const statement = masked.match(/^(.*?)(return|=>)\s+(true|false);/);
	if (statement && /^[a-zA-Z0-9_,\s]*$/.test(statement[1])) {
		const start = statement.index + statement[0].indexOf(statement[3]);
		push(start, statement[3].length, statement[3] === 'true' ? 'false' : 'true', 'BOOL_RETURN');
	}
	return edits;
}

function methodRegions(lines, methodNames) {
	const skip = new Set();
	const state = { inBlockComment: false };
	for (const name of methodNames) {
		for (let i = 0; i < lines.length; i++) {
			const masked = maskLine(lines[i], state);
			if (masked.includes(`${name}(`)) {
				let depth = 0;
				let seen = false;
				for (let j = i; j < lines.length; j++) {
					for (const c of lines[j]) {
						if (c === '{') {
							depth++;
							seen = true;
						} else if (c === '}') {
							depth--;
						}
					}
					skip.add(j);
					if (seen && depth <= 0) {
						break;
					}
				}
			}
		}
	}
	return skip;
}

function lineEligible(rawLine, masked) {
	if (!masked.trim()) {
		return false;
	}
	if (/^\s*@/.test(masked)) {
		return false;
	}
	if (/^\s*(import|export\s+\{)/.test(masked)) {
		return false;
	}
	return true;
}

function matchesAny(patterns, line) {
	return patterns.some((pattern) => new RegExp(pattern).test(line));
}

function generateMutants() {
	const mutants = [];
	for (const target of map.targets) {
		const raw = readFileSync(join(ROOT, target.file), 'utf8');
		const lines = raw.split(/\r?\n/);
		const skipLines = new Set(methodRegions(lines, target.skipMethods ?? []));
		const state = { inBlockComment: false };
		let prevTail = '';
		for (const explicit of target.explicit ?? []) {
			const line = lines[explicit.line - 1];
			let at = -1;
			for (let occurrence = 0; occurrence < (explicit.occurrence ?? 1); occurrence++) {
				at = line.indexOf(explicit.from, at + 1);
			}
			if (at < 0) {
				throw new Error(`explicit mutant not found: ${target.file}:${explicit.line} ${explicit.from}`);
			}
			mutants.push({
				target: target.name, file: target.file, line: explicit.line, col: at + 1,
				from: explicit.from, to: explicit.to, op: explicit.op, note: explicit.note ?? '',
				tests: explicit.tests ?? target.tests,
			});
		}
		for (const [index, line] of lines.entries()) {
			const masked = maskLine(line, state);
			const excluded = skipLines.has(index)
				|| (target.lineExcludes && matchesAny(target.lineExcludes, line))
				|| (target.lineIncludes && !matchesAny(target.lineIncludes, line));
			// Equivalent-mutant exclusions: an operator provably indistinguishable
			// on one line, under a data invariant, never enters the gate.
			const opExcludes = (target.lineOpExcludes ?? [])
				.filter((rule) => rule.line === index + 1)
				.flatMap((rule) => rule.ops);
			if (!excluded && lineEligible(line, masked)) {
				for (const edit of scanLine(line, masked, prevTail)) {
					if (opExcludes.includes(edit.op)) {
						continue;
					}
					mutants.push({
						target: target.name, file: target.file, line: index + 1, col: edit.start + 1,
						from: line.slice(edit.start, edit.start + edit.length), to: edit.to, op: edit.op, note: '',
						tests: target.tests,
					});
				}
			}
			prevTail = masked;
		}
	}
	mutants.forEach((mutant, index) => {
		mutant.id = `F${String(index + 1).padStart(3, '0')}`;
	});
	return mutants;
}

function applyMutant(mutant) {
	const path = join(ROOT, mutant.file);
	const raw = readFileSync(path, 'utf8');
	const eol = raw.includes('\r\n') ? '\r\n' : '\n';
	const lines = raw.split(/\r?\n/);
	const line = lines[mutant.line - 1];
	const at = line.indexOf(mutant.from, mutant.col - 1);
	if (at !== mutant.col - 1) {
		throw new Error(`${mutant.id} drifted: ${mutant.file}:${mutant.line} expected ${mutant.from} at col ${mutant.col}`);
	}
	lines[mutant.line - 1] = line.slice(0, at) + mutant.to + line.slice(at + mutant.from.length);
	writeFileSync(path, lines.join(eol), 'utf8');
}

function runTests(specs) {
	const logPath = join(ROOT, cfg.logPath);
	mkdirSync(dirname(logPath), { recursive: true });
	const argv = ['run', 'test', '--prefix', cfg.frontendDir, '--',
		...specs.flatMap((spec) => ['--include', spec])];
	// Node refuses to spawn a .cmd without a shell since the 2024 security
	// patch; the argument list is repo-relative paths only, no quoting risk.
	const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const child = spawn(npm, argv, {
		cwd: ROOT,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: process.platform === 'win32',
	});
	let output = '';
	child.stdout.on('data', (chunk) => {
		output += chunk;
	});
	child.stderr.on('data', (chunk) => {
		output += chunk;
	});
	const started = Date.now();
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			killTree(child.pid);
			resolve({ timedOut: true, exitCode: null, output, seconds: (Date.now() - started) / 1000 });
		}, cfg.perMutantTimeoutMs);
		child.on('close', (code) => {
			clearTimeout(timer);
			resolve({ timedOut: false, exitCode: code, output, seconds: (Date.now() - started) / 1000 });
		});
	}).then((result) => {
		// The last run's full output stays on disk for triage.
		writeFileSync(logPath, result.output, 'utf8');
		return result;
	});
}

function classify(result) {
	if (result.timedOut) {
		return 'timeout';
	}
	if (result.exitCode === 0) {
		return 'survivor';
	}
	if (/error TS\d+|bundle generation failed|Build failed|NG\d{4}/i.test(result.output)) {
		return 'compile';
	}
	return 'test';
}

function restore(mutant) {
	spawnSync('git', ['restore', '--worktree', '--', mutant.file], { cwd: ROOT });
	const dirty = git('diff', '--name-only', '--', mutant.file);
	if (dirty) {
		throw new Error(`${mutant.file} stayed modified after restore`);
	}
}

function renderReport(run) {
	const lines = [];
	lines.push('# frontend mutation report', '');
	lines.push('Generated by `make mutate-front` (scripts/tools/mutate-front.mjs), the backend mutation harness conventions adapted to the TypeScript core and services classes. One mutant at a time, applied to the working tree, restored with git after each run, file verified clean between mutants, only the mapped spec files run per target.', '');
	lines.push(`Run: ${run.finishedAt}`);
	lines.push(`Commit: ${run.head}`);
	lines.push(`Command: ${run.command}`);
	lines.push(`Total mutants: ${run.mutants.length}, killed: ${run.killed}, survivors: ${run.survivors.length}`);
	if (run.controlSpecs) {
		lines.push(`Control run: green over ${run.controlSpecs} mapped spec files before the sweep.`);
	}
	lines.push(`Runtime: ${run.seconds.toFixed(0)} s serialized (${(run.seconds / 60).toFixed(1)} min), per-mutant timeout ${cfg.perMutantTimeoutMs / 1000} s`, '');
	lines.push('## operator set', '');
	lines.push('| operator | rewrite |');
	lines.push('| --- | --- |');
	for (const [op, rewrite] of run.operatorTable) {
		lines.push(`| ${op} | ${rewrite} |`);
	}
	lines.push('');
	lines.push('## per target', '');
	lines.push('| target | file | mapped specs | mutants | killed | compile | test | timeout | survivor |');
	lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
	for (const row of run.targets) {
		lines.push(`| ${row.name} | ${row.file} | ${row.tests.join(', ')} | ${row.total} | ${row.killed} | ${row.compile} | ${row.test} | ${row.timeout} | ${row.survivor} |`);
	}
	lines.push('', '## mutants by operator', '');
	const byOp = new Map();
	for (const result of run.results) {
		byOp.set(result.op, (byOp.get(result.op) ?? 0) + 1);
	}
	for (const [op, count] of [...byOp.entries()].sort()) {
		lines.push(`- ${op}: ${count}`);
	}
	if (run.survivors.length === 0) {
		lines.push('', '## survivors', '', 'None. Every mutant was killed by its mapped specs, a compile failure, or the timeout ceiling.');
	} else {
		lines.push('', '## survivors', '');
		for (const survivor of run.survivors) {
			lines.push(`- ${survivor.id} ${survivor.op} ${survivor.file}:${survivor.line} ${survivor.from} -> ${survivor.to}`);
		}
	}
	lines.push('', '## curation notes', '');
	lines.push('- Clean-tree precondition, scoped to the mutation cycle: every mapped target file sits at HEAD with nothing staged, so each mutant is exactly one line over a known state. Untracked files elsewhere (new specs, the harness itself) never touch the mutated set. After every mutant the harness restores the file with git and verifies `git diff` over that file is empty before continuing.');
	lines.push('- Template literals are masked whole, interpolation included, the same policy the backend harness applies to Java string literals: URL builders and display text live inside strings, their behavior is contract-covered by the api specs and e2e.');
	lines.push('- Guard ternary polarity and localStorage key literals are mutated through the explicit entries of scripts/tools/mutation-front-map.json, the generic token scanners see only code.');
	lines.push('- The map carries lineOpExcludes for the two provably equivalent mutants culled before the run: the session predicate `||` to `&&` (every input class reaches the same logout fallback, null through the catch) and the toast id origin `0` to `1` (identity needs uniqueness, not a specific origin). The cart array guard dropped `!` was un-culled: it breaks the array narrowing into a compile kill, and the reload survival spec pins the reload behavior beneath it.');
	lines.push('- Sort direction flips have no in-scope site: the store sort is a passthrough enum into the server-side sort whitelist, the sorting itself is backend work already mutated in docs/qa/mutation-report.md.');
	lines.push('- Zero-mutant rows are the thin delegation services: once strings are masked they expose no operators, every behavior is an endpoint constant or an HttpClient passthrough asserted by their specs.');
	for (const note of map.reportNotes ?? []) {
		lines.push(`- ${note}`);
	}
	lines.push('', 'Reproduce with `make mutate-front`. List the mutant set without running anything with `node scripts/tools/mutate-front.mjs --list`.');
	return `${lines.join('\n')}\n`;
}

async function main() {
	const mutants = generateMutants();
	if (LIST_ONLY) {
		for (const mutant of mutants) {
			console.log(`${mutant.id} ${mutant.op} ${mutant.file}:${mutant.line}:${mutant.col} ${mutant.from} -> ${mutant.to} [${mutant.tests.join(',')}] ${mutant.note}`);
		}
		console.log(`total: ${mutants.length}`);
		return;
	}
	const selected = onlyId ? mutants.filter((mutant) => mutant.id === onlyId || mutant.id === `F${onlyId}`) : mutants;
	if (selected.length === 0) {
		console.error(`no mutants selected${onlyId ? ` for ${onlyId}` : ''}`);
		process.exit(1);
	}
	// Clean-tree precondition scoped to what the cycle touches: every mapped
	// target file at HEAD, nothing staged, so every mutant is exactly one
	// line over a known state and git restore is exact.
	const files = map.targets.map((target) => target.file);
	if (git('diff', '--name-only', '--', ...files)
		|| git('diff', '--cached', '--name-only', '--', ...files)
		|| git('status', '--porcelain', '--', ...files)) {
		console.error('the mapped target files are not clean, refusing to mutate');
		process.exit(1);
	}
	const head = git('rev-parse', 'HEAD');
	console.log(`frontend mutation run over ${selected.length} mutants at ${head}`);
	// Control run: the mapped specs must be green with no mutant applied, or
	// every later nonzero exit would masquerade as a kill.
	const controlSpecs = [...new Set(selected.flatMap((mutant) => mutant.tests))];
	console.log(`control run: ${controlSpecs.length} mapped spec files unmutated`);
	const control = await runTests(controlSpecs);
	if (control.timedOut || control.exitCode !== 0) {
		console.error(`control run failed (${control.timedOut ? 'timeout' : `exit ${control.exitCode}`}): `
			+ `the mapped specs are red before any mutant, full output in ${cfg.logPath}`);
		process.exit(3);
	}
	const results = [];
	const run = {
		mutants: selected, results, survivors: [], head,
		command: 'make mutate-front',
		controlSpecs: controlSpecs.length,
	};
	const started = Date.now();
	try {
		for (const [index, mutant] of selected.entries()) {
			applyMutant(mutant);
			const result = await runTests(mutant.tests);
			const verdict = classify(result);
			if (verdict === 'survivor') {
				run.survivors.push(mutant);
			}
			results.push({ ...mutant, verdict, seconds: result.seconds });
			console.log(`[${index + 1}/${selected.length}] ${mutant.id} ${mutant.op} ${mutant.file}:${mutant.line} ${mutant.from} -> ${mutant.to} : ${verdict.toUpperCase()} (${result.seconds.toFixed(0)}s)`);
			restore(mutant);
		}
	} finally {
		for (const mutant of selected) {
			spawnSync('git', ['restore', '--worktree', '--', mutant.file], { cwd: ROOT });
		}
		const dirty = git('diff', '--name-only', '--', ...files);
		if (dirty) {
			console.error(`mapped files left dirty after the run, inspect git diff ${dirty}`);
		}
	}
	run.seconds = (Date.now() - started) / 1000;
	// Stamped at sweep completion, not run start: the Run line must read the
	// moment the last mutant finished, matching the runtime beside it.
	run.finishedAt = new Date().toISOString();
	run.killed = results.filter((result) => result.verdict !== 'survivor').length;
	const operatorTable = [
		['STRICT_EQ_TO_NE', '=== to !=='], ['STRICT_NE_TO_EQ', '!== to ==='],
		['AND_TO_OR', '&& to ||'], ['OR_TO_AND', '|| to &&'],
		['LE_TO_LT', '<= to <'], ['GE_TO_GT', '>= to >'],
		['LT_TO_LE', '< to <='], ['GT_TO_GE', '> to >='],
		['ADD_TO_SUB', '+ to -'], ['SUB_TO_ADD', '- to +'],
		['MUL_TO_DIV', '* to /'], ['DIV_TO_MUL', '/ to *'],
		['LIT_0_TO_1', '0 to 1'], ['LIT_1_TO_0', '1 to 0'],
		['NOT_DROP', 'drop a !'], ['MIN_MAX', 'Math.min to Math.max or back'],
		['BOOL_RETURN', 'boolean return literal flip'],
		['GUARD_POLARITY', 'guard ternary true to false'],
		['STORAGE_KEY', 'localStorage key literal tweak'],
	];
	run.operatorTable = operatorTable;
	run.targets = map.targets.map((target) => {
		const own = results.filter((result) => result.target === target.name);
		return {
			name: target.name, file: target.file, tests: target.tests, total: own.length,
			killed: own.filter((result) => result.verdict !== 'survivor').length,
			compile: own.filter((result) => result.verdict === 'compile').length,
			test: own.filter((result) => result.verdict === 'test').length,
			timeout: own.filter((result) => result.verdict === 'timeout').length,
			survivor: own.filter((result) => result.verdict === 'survivor').length,
		};
	});
	const report = renderReport(run);
	mkdirSync(dirname(join(ROOT, cfg.reportPath)), { recursive: true });
	writeFileSync(join(ROOT, cfg.reportPath), report, 'utf8');
	console.log(`report: ${cfg.reportPath}`);
	console.log(`mutants: ${run.mutants.length}, killed: ${run.killed}, survivors: ${run.survivors.length}, runtime: ${run.seconds.toFixed(0)}s`);
	process.exit(run.survivors.length === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error(error.stack ?? error);
	process.exit(1);
});
