#!/usr/bin/env node
// Source-level mutation harness (plan decision 13: rolled own, no pitest, no
// stryker). Applies one mutant at a time to the logic-dense classes listed in
// scripts/tools/mutation-map.json, runs only the mapped test classes through
// mvnw, and classifies the outcome: compile failure, test failure, or a hang
// all count as killed, a green selective run is a survivor and fails the gate.
// The tree must be clean before the run starts and is restored with git after
// every mutant, verified against git diff between mutants. Serialized: one
// mutant, one build, one selective test run at a time. A control run over the
// mapped tests must pass unmutated before the sweep: a dead MySQL, offline
// maven, or a genuinely red suite would otherwise turn every nonzero exit
// into a phantom kill and hand the gate a false all-killed report. Writes the
// committed artifact docs/qa/mutation-report.md. Run via `make mutate` (JAVA_HOME from
// the Makefile wins; the JDK 27 fallback mirrors it). Exit 0 on zero
// survivors, 1 otherwise. --list prints the curated mutant set without
// running anything, --only <id> runs a single mutant for triage.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts/tools/qa.json'), 'utf8')).mutate;
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

function javaHome() {
	if (process.env.JAVA_HOME) {
		return process.env.JAVA_HOME;
	}
	const fallback = join(process.env.USERPROFILE ?? '', 'dev', 'jdk', 'jdk-27_oracle');
	return existsSync(join(fallback, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
		? fallback
		: null;
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

// Mask string literals, char literals, and comments so token scanners only see
// code. Masked characters become \x01, offsets stay identical to the raw line.
// Code units, not code points, so indices always align with string slicing.
function maskLine(line, state) {
	const chars = line.split('');
	let inString = false;
	let inChar = false;
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
		}
	}
	return chars.join('');
}

const STRINGISH = new Set(['"', '\'', '\x01']);

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

function receiverIdentifier(masked, dotIndex) {
	let end = dotIndex;
	while (end > 0 && /[\w]/.test(masked[end - 1])) {
		end--;
	}
	return masked.slice(end, dotIndex);
}

// One top-level argument inside the call's parentheses, else an arity flip
// would be a cheap compile-failure kill rather than a behavioral mutant.
function singleTopLevelArgument(masked, openIndex) {
	let depth = 0;
	let commas = 0;
	for (let i = openIndex; i < masked.length; i++) {
		const c = masked[i];
		if (c === '(') {
			depth++;
		} else if (c === ')') {
			depth--;
			if (depth === 0) {
				return commas === 0;
			}
		} else if (c === ',' && depth === 1) {
			commas++;
		}
	}
	return false;
}

const ROUNDING_FLIPS = new Map([
	['CEILING', 'FLOOR'], ['FLOOR', 'CEILING'],
	['HALF_UP', 'DOWN'], ['DOWN', 'HALF_UP'], ['UP', 'DOWN'],
]);

function scanLine(rawLine, masked, prevTail) {
	const edits = [];
	const push = (start, length, to, op) => edits.push({ start, length, to, op });
	for (const match of masked.matchAll(/(?<![!=<>])==(?!=)/g)) {
		push(match.index, 2, '!=', 'EQ_TO_NE');
	}
	for (const match of masked.matchAll(/!=/g)) {
		push(match.index, 2, '==', 'NE_TO_EQ');
	}
	for (const match of masked.matchAll(/&&/g)) {
		push(match.index, 2, '||', 'AND_TO_OR');
	}
	for (const match of masked.matchAll(/\|\|/g)) {
		push(match.index, 2, '&&', 'OR_TO_AND');
	}
	// Comparison boundaries. Whitespace or an opening paren on both sides keeps
	// generics (Map<Long, ...>), lambdas (->), and shifts out.
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
	for (const match of masked.matchAll(/\.(add|subtract|multiply|divide)\(/g)) {
		const name = match[1];
		if (!singleTopLevelArgument(masked, match.index + match[0].length - 1)) {
			continue;
		}
		const receiver = receiverIdentifier(masked, match.index);
		if (map.bdCollectionReceivers.includes(receiver)) {
			continue;
		}
		const flip = { add: 'subtract', subtract: 'add', multiply: 'divide', divide: 'multiply' }[name];
		push(match.index + 1, name.length, flip, 'BD_ARITH');
	}
	for (const match of masked.matchAll(/\b(ASC|DESC)\b/g)) {
		push(match.index, match[1].length, match[1] === 'ASC' ? 'DESC' : 'ASC', 'SORT_DIR');
	}
	for (const match of masked.matchAll(/\bRoundingMode\.(CEILING|FLOOR|HALF_UP|DOWN|UP)\b/g)) {
		const flip = ROUNDING_FLIPS.get(match[1]);
		if (flip) {
			push(match.index + 'RoundingMode.'.length, match[1].length, flip, 'ROUND_MODE');
		}
	}
	const statement = masked.match(/^(.*?)(return|->)\s+(true|false);/);
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
	if (/^\s*(package|import)\b/.test(masked)) {
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
		mutant.id = `M${String(index + 1).padStart(3, '0')}`;
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

function runMaven(tests) {
	const home = javaHome();
	if (!home) {
		throw new Error('no JAVA_HOME and no JDK 27 fallback; run through make mutate');
	}
	const logPath = join(ROOT, cfg.logPath);
	mkdirSync(dirname(logPath), { recursive: true });
	const mavenArgs = [...cfg.mavenArgs, `-Dtest=${tests.join(',')}`, 'test'];
	const child = spawn('sh', ['./mvnw', ...mavenArgs], {
		cwd: ROOT,
		env: { ...process.env, JAVA_HOME: home, MAVEN_OPTS: cfg.mavenOpts },
		stdio: ['ignore', 'pipe', 'pipe'],
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
		// The last build's full output stays on disk for triage.
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
	if (/COMPILATION ERROR|\.java:\[\d+,\d+\]/.test(result.output)) {
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
	lines.push('# mutation report', '');
	lines.push('Generated by `make mutate` (scripts/tools/mutate.mjs), the in-repo source-level mutation harness of plan decision 13. One mutant at a time, applied to the working tree, restored with git after each run, tree verified clean between mutants, only the mapped test classes run per target.', '');
	lines.push(`Run: ${run.finishedAt}`);
	lines.push(`Commit: ${run.head}`);
	lines.push(`Command: ${run.command}`);
	lines.push(`Total mutants: ${run.mutants.length}, killed: ${run.killed}, survivors: ${run.survivors.length}`);
	if (run.controlTests) {
		lines.push(`Control run: green over ${run.controlTests} mapped test classes before the sweep.`);
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
	lines.push('| target | file | mapped tests | mutants | killed | compile | test | timeout | survivor |');
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
		lines.push('', '## survivors', '', 'None. Every mutant was killed by its mapped tests, a compile failure, or the timeout ceiling.');
	} else {
		lines.push('', '## survivors', '');
		for (const survivor of run.survivors) {
			lines.push(`- ${survivor.id} ${survivor.op} ${survivor.file}:${survivor.line} ${survivor.from} -> ${survivor.to}`);
		}
	}
	lines.push('', '## curation notes', '');
	lines.push('- Clean-tree precondition, scoped to the mutation cycle: every file under src/ and the pom sit at HEAD with nothing untracked underneath, so each mutant is exactly one line over a known state. After every mutant the harness restores the file with git and verifies `git diff` over that file is empty before continuing.');
	lines.push('- Auth.parseSession line 26 (`first <= 0 || second < 0`) is excluded: every operator there yields an equivalent mutant, the surrounding substring parse throws IllegalArgumentException on the same inputs either way. Auth.ownIdOrAdmin is skipped as controller-level authorization outside the plan\'s token mint and parse target; OrderControllerTest and UserControllerTest cover it where it lives.');
	lines.push('- JPQL and separator literals inside strings are mutated through the explicit entries of scripts/tools/mutation-map.json, the generic token scanners see only code.');
	lines.push('- The map carries lineOpExcludes for provably equivalent mutants: the branch id tie-break `<` versus `<=` in GeoService.nearestBranch, indistinguishable because branch ids are unique per row.');
	lines.push('- BigDecimal arity flips run only on single-argument add/subtract/multiply/divide calls, collection receivers listed in the map are skipped so a List.add flip cannot degrade into a compile-error kill.');
	lines.push('- toString bodies are skipped unless they hold logic.');
	for (const note of map.reportNotes ?? []) {
		lines.push(`- ${note}`);
	}
	lines.push('', 'Reproduce with `make mutate`. List the mutant set without running anything with `node scripts/tools/mutate.mjs --list`.');
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
	const selected = onlyId ? mutants.filter((mutant) => mutant.id === onlyId || mutant.id === `M${onlyId}`) : mutants;
	if (selected.length === 0) {
		console.error(`no mutants selected${onlyId ? ` for ${onlyId}` : ''}`);
		process.exit(1);
	}
	// Clean-tree precondition scoped to what the cycle touches: every source
	// file and the pom at HEAD, nothing untracked under src/, so every mutant
	// is exactly one line over a known state and git restore is exact.
	if (git('diff', '--name-only', '--', 'src', 'pom.xml')
		|| git('diff', '--cached', '--name-only', '--', 'src', 'pom.xml')
		|| git('status', '--porcelain', '--', 'src', 'pom.xml')) {
		console.error('the source tree is not clean, refusing to mutate');
		process.exit(1);
	}
	const head = git('rev-parse', 'HEAD');
	console.log(`mutation run over ${selected.length} mutants at ${head}`);
	// Control run: the mapped tests must be green with no mutant applied, or
	// every later nonzero exit would masquerade as a kill.
	const controlTests = [...new Set(selected.flatMap((mutant) => mutant.tests))];
	console.log(`control run: ${controlTests.length} mapped test classes unmutated`);
	const control = await runMaven(controlTests);
	if (control.timedOut || control.exitCode !== 0) {
		console.error(`control run failed (${control.timedOut ? 'timeout' : `exit ${control.exitCode}`}): `
			+ `the mapped tests are red before any mutant, full output in ${cfg.logPath}`);
		process.exit(3);
	}
	const results = [];
	const run = {
		mutants: selected, results, survivors: [], head,
		command: 'make mutate',
		controlTests: controlTests.length,
	};
	const started = Date.now();
	try {
		for (const [index, mutant] of selected.entries()) {
			applyMutant(mutant);
			const result = await runMaven(mutant.tests);
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
		if (git('diff', '--name-only', '--', 'src')) {
			console.error('source tree left dirty after the run, inspect git diff src');
		}
	}
	run.seconds = (Date.now() - started) / 1000;
	// Stamped at sweep completion, not run start: the Run line must read the
	// moment the last mutant finished, matching the runtime beside it.
	run.finishedAt = new Date().toISOString();
	run.killed = results.filter((result) => result.verdict !== 'survivor').length;
	const operatorTable = [
		['EQ_TO_NE', '== to !='], ['NE_TO_EQ', '!= to =='],
		['AND_TO_OR', '&& to ||'], ['OR_TO_AND', '|| to &&'],
		['LE_TO_LT', '<= to <'], ['GE_TO_GT', '>= to >'],
		['LT_TO_LE', '< to <='], ['GT_TO_GE', '> to >='],
		['ADD_TO_SUB', '+ to -'], ['SUB_TO_ADD', '- to +'],
		['MUL_TO_DIV', '* to /'], ['DIV_TO_MUL', '/ to *'],
		['LIT_0_TO_1', '0 to 1'], ['LIT_1_TO_0', '1 to 0'],
		['NOT_DROP', 'drop a !'], ['MIN_MAX', 'min to max or max to min'],
		['BD_ARITH', 'BigDecimal add/subtract/multiply/divide swap'],
		['SORT_DIR', 'ASC to DESC or DESC to ASC'], ['ROUND_MODE', 'RoundingMode flip'],
		['BOOL_RETURN', 'boolean return literal flip'],
		['QUERY_BOUNDARY', 'JPQL >= to > inside the stock guard'],
		['QUERY_ARITH', 'JPQL - to + inside the stock guard'],
		['LIT_SEPARATOR', 'payload separator literal tweak'],
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
