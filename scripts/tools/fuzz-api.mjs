#!/usr/bin/env node
// API fuzz harness for the packaged jar (plan decision 13: rolled own, no jqwik).
// Deterministic: fixed seed from scripts/tools/qa.json (fuzz.seed) drives every
// generated variant, the curated corpus is scripts/tools/fuzz-corpus.json.
// Assertions per docs/api-v3.md: response status stays in the documented set for
// the endpoint, and every error body is problem+json carrying a known code,
// application errors and framework errors alike (deserialization 400 VALIDATION,
// method-not-allowed 405 METHOD_NOT_ALLOWED, unknown paths 404 NOT_FOUND, per
// the committed error advice). No response is ever 5xx or a hang.
// The run boots target/flowershop-*.jar (newest first, same glob as make run) on a
// scratch port against the compose MySQL, kills it afterwards, and writes
// docs/qa/fuzz-report.md. Run via `make fuzz`, which provides JAVA_BIN and the
// MySQL env. Exit 0 on a green run, 1 on any assertion failure.

import { createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'scripts/tools/qa.json'), 'utf8')).fuzz;
const corpus = JSON.parse(readFileSync(join(ROOT, cfg.corpusPath), 'utf8'));
const BASE = `http://localhost:${cfg.port}`;

// Machine codes from docs/api-v3.md plus the framework advice codes the
// committed handler emits; every problem+json error must carry one.
const KNOWN_CODES = new Set(['VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'EMAIL_IN_USE',
	'NAME_IN_USE', 'OUT_OF_STOCK', 'ILLEGAL_TRANSITION', 'PAYMENT_CANCELLED', 'PAYMENT_CONFIRMED',
	'HAS_ORDERS', 'COUPON_INACTIVE', 'STOCK_ROWS_EXIST', 'WRONG_SECRET', 'METHOD_NOT_ALLOWED']);

// Deterministic PRNG (mulberry32): same seed, same request sequence, same statuses.
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rng = mulberry32(cfg.seed);
const pick = (values) => values[Math.floor(rng() * values.length)];

// The seed fixes the request sequence; the run tag namespaces the fresh users
// each run registers and every credential the run rotates derives from it, so
// a rerun of the same seed under a fresh tag replays identical statuses and a
// replay of a completed run (FUZZ_RUN_TAG set to its tag) is green end to end:
// statuses may flip where persistent state legitimately differs, for instance
// setup login falling back to the already rotated password, but no assertion
// may fail. The first run of a tag rotates user 1's password, which is why
// setup retries the tag derived rotated form.
const runTag = process.env.FUZZ_RUN_TAG ?? Date.now().toString(36);

const failures = [];
const endpointStats = new Map();
let requests = 0;

function fail(name, detail) {
	failures.push({name, detail});
	console.error(`FAIL ${name}: ${detail}`);
}

function stat(template, status) {
	requests++;
	const entry = endpointStats.get(template) ?? {count: 0, statuses: new Map()};
	entry.count++;
	entry.statuses.set(status, (entry.statuses.get(status) ?? 0) + 1);
	endpointStats.set(template, entry);
}

async function call(name, template, method, path, {query, token, body, raw, status, error, codes} = {}) {
	if (elapsed() > cfg.runBudgetMs) {
		fail(name, 'run budget exceeded before the request fired');
		return null;
	}
	const url = new URL(BASE + path);
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
	}
	const headers = {Accept: 'application/json'};
	if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
	if (token) headers['X-Auth-Token'] = token;
	const payload = raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
	let response;
	try {
		response = await fetch(url, {method, headers, body: payload, signal: controller.signal});
	} catch (error_) {
		fail(name, `hang or transport error: ${error_.name}: ${error_.message}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
	stat(template, response.status);
	if (response.status >= 500) {
		fail(name, `5xx observed: ${response.status}`);
		return response;
	}
	if (!status.includes(response.status)) {
		fail(name, `status ${response.status} outside documented set [${status.join(', ')}]`);
		return response;
	}
	// Read once here and cache: every caller that needs a body reads the cache.
	const text = await response.text();
	response.fuzzBody = text;
	if (response.status < 400 || error === undefined) {
		return response;
	}
	const contentType = response.headers.get('content-type') ?? '';
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		fail(name, `error body is not JSON (${contentType}): ${text.slice(0, 120)}`);
		return response;
	}
	// Every error body is problem+json per the contract and the committed
	// error advice; application and framework errors share the shape.
	if (error === 'any' || error === 'problem') {
		contentType.startsWith('application/problem+json')
			? assertProblem(name, parsed, response.status, codes)
			: fail(name, `expected problem+json, got ${contentType}: ${text.slice(0, 120)}`);
	}
	return response;
}

function assertProblem(name, parsed, status, codes) {
	if (parsed.status !== status) fail(name, `problem status ${parsed.status} != http ${status}`);
	if (!KNOWN_CODES.has(parsed.code)) fail(name, `unknown problem code ${JSON.stringify(parsed.code)}`);
	if (codes && !codes.includes(parsed.code)) fail(name, `problem code ${parsed.code} outside [${codes.join(', ')}]`);
}

function json(response) {
	if (!response || response.status === 204 || !response.fuzzBody) return null;
	return JSON.parse(response.fuzzBody);
}

const sig = (paymentId, orderId, amount) =>
	createHmac('sha256', cfg.paymentSecret).update(`${paymentId}:${orderId}:${amount}`).digest('hex');

// Every fuzz user's password derives from the run tag: a replay of the same
// tag computes the same passwords the previous run left in the database.
const credential = (n) =>
	createHmac('sha256', cfg.paymentSecret).update(`${runTag}:user${n}`).digest('hex').slice(0, 20);
const rotatedCredential = (n) =>
	createHmac('sha256', cfg.paymentSecret).update(`${runTag}:user${n}:rotated`).digest('hex').slice(0, 20);

const bitFlip = (hex) => {
	const byte = Number.parseInt(hex[0], 16) ^ 1;
	return byte.toString(16) + hex.slice(1);
};

const runStart = Date.now();
const elapsed = () => Date.now() - runStart;

// --- server lifecycle, same jar selection and tree-kill discipline as capture.mjs

function findJar() {
	const target = join(ROOT, 'target');
	if (!existsSync(target)) throw new Error('target/ missing; run make package first');
	const jars = readdirSync(target)
		.filter((name) => /^flowershop-.*\.jar$/.test(name) && !name.endsWith('.original'))
		.map((name) => ({name, mtimeMs: statSync(join(target, name)).mtimeMs}))
		.sort((a, b) => b.mtimeMs - a.mtimeMs);
	if (jars.length === 0) throw new Error('no target/flowershop-*.jar; run make package first');
	return join(target, jars[0].name);
}

function startServer() {
	const jar = findJar();
	const javaBin = process.env.JAVA_BIN
		?? (process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java');
	console.log(`[server] ${javaBin} -jar ${jar.slice(ROOT.length + 1)} on port ${cfg.port}`);
	// Keep the dev default payment secret so the sig vectors above stay computable.
	// The log truncates per run so it cannot grow unboundedly across reruns.
	const logFd = openSync(join(ROOT, cfg.serverLogPath), 'w');
	const child = spawn(javaBin, ['-jar', jar, `--server.port=${cfg.port}`], {
		cwd: ROOT,
		env: {...process.env, FLOWERSHOP_PAYMENT_SECRET: cfg.paymentSecret},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let tail = '';
	const collect = (chunk) => {
		tail = (tail + chunk).slice(-2000);
		try {
			writeSync(logFd, chunk);
		} catch {
			// the log is best effort, the run must not die on a full disk
		}
	};
	child.stdout.on('data', collect);
	child.stderr.on('data', collect);
	child.once('close', () => closeSync(logFd));
	const deadline = Date.now() + cfg.bootTimeoutMs;
	const bootReady = async () => {
		while (Date.now() < deadline) {
			if (child.exitCode !== null) throw new Error(`jar exited with code ${child.exitCode}:\n${tail}`);
			try {
				const response = await fetch(`${BASE}/api/product?page=0&size=1`, {signal: AbortSignal.timeout(2000)});
				if (response.ok) return;
			} catch {
				// still booting
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		killTree(child.pid);
		throw new Error(`app did not answer on ${BASE} within ${cfg.bootTimeoutMs} ms:\n${tail}`);
	};
	return bootReady().then(() => ({child, jar, log: () => tail}));
}

function killTree(pid) {
	if (process.platform === 'win32') {
		// taskkill /T reaches the whole process tree, child.kill() would not.
		spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
	} else {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			// already gone
		}
	}
}

function stopServer(server) {
	if (!server || server.child.exitCode !== null) return Promise.resolve();
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, 10_000);
		server.child.once('close', () => {
			clearTimeout(timer);
			resolve();
		});
		killTree(server.child.pid);
	}).then(() => {
		const check = spawnSync('tasklist', ['/FI', `PID eq ${server.child.pid}`]);
		if (String(check.stdout).includes(String(server.child.pid))) {
			fail('server-shutdown', `pid ${server.child.pid} survived the kill`);
		} else {
			console.log(`[server] pid ${server.child.pid} verified dead`);
		}
	});
}

// A plain fetch cannot probe path traversal: the URL parser collapses
// /api/product/../user to /api/user before the socket opens, so the old
// check certified nothing. This sends the raw path verbatim on the request
// line and lets the server's own handling answer.
function rawPathProbe(path) {
	return new Promise((resolve, reject) => {
		const outbound = httpRequest(
			{host: 'localhost', port: cfg.port, path, method: 'GET', headers: {Accept: 'application/json'}, timeout: cfg.requestTimeoutMs},
			(response) => {
				let body = '';
				response.on('data', (chunk) => { body += chunk; });
				response.on('end', () => resolve({status: response.statusCode, contentType: response.headers['content-type'] ?? '', body}));
			});
		outbound.on('timeout', () => outbound.destroy(new Error('raw path probe timed out')));
		outbound.on('error', reject);
		outbound.end();
	});
}

// --- scenario state, populated by setup()

const facts = {};

async function login(email, password) {
	const response = await call('setup-login', 'POST /api/auth/login', 'POST', '/api/auth/login',
		{body: {email, password}, status: [200], error: 'problem', codes: ['UNAUTHENTICATED']});
	return (await json(response)).token;
}

// User 1's password is rotated by the user walk, so logging in as user 1
// tries the tag derived base form first and falls back to the rotated one on
// a replay of a completed run; both candidates are pure functions of the tag.
async function loginRegistered(n) {
	const email = facts[`user${n}`];
	for (const password of [credential(n), rotatedCredential(n)]) {
		const response = await call('setup-login', 'POST /api/auth/login', 'POST', '/api/auth/login',
			{body: {email, password}, status: [200, 401], error: 'problem', codes: ['UNAUTHENTICATED']});
		if (response.status === 200) {
			return {token: (await json(response)).token, password};
		}
	}
	throw new Error(`login failed for ${email} under both tag derived passwords`);
}

async function registerUser(n) {
	const email = `fz${cfg.seed}-${runTag}-${n}@fuzz.local`;
	await call(`setup-register-${n}`, 'POST /api/user/create', 'POST', '/api/user/create', {
		body: {name: `Fuzz ${n}`, email, password: credential(n), phone: '0900000000', address: '1 Le Loi',
			district: 'Bình Thạnh', city: 'Hồ Chí Minh', answer: 'blue'},
		// A rerun of the same seed re-registers the same addresses: 201 first, 409 after.
		status: [201, 409], error: 'any', codes: ['EMAIL_IN_USE'],
	});
	return email;
}

async function setup() {
	facts.adminToken = await login('admin@flowershop.example', '1234qwer');
	for (let n = 1; n <= 4; n++) facts[`user${n}`] = await registerUser(n);
	const member = await loginRegistered(1);
	facts.memberToken = member.token;
	facts.user1Password = member.password;
	facts.buyerToken = await login(facts.user2, credential(2));
	facts.editorToken = await login(facts.user3, credential(3));
	const product = (await json(await call('setup-product', 'GET /api/product', 'GET', '/api/product',
		{query: {page: 0, size: 1}, status: [200]}))).content[0];
	facts.productId = product.id;
	facts.typeName = product.typeName;
	facts.categoryName = product.categoryName;
	const branch = (await json(await call('setup-branch', 'GET /api/branch', 'GET', '/api/branch',
		{status: [200]}))).find((b) => b.active);
	facts.branchId = branch.id;
	await call('setup-stock', 'PUT /api/branch/{id}/stock', 'PUT', `/api/branch/${facts.branchId}/stock`, {
		token: facts.adminToken, body: {productId: facts.productId, quantity: cfg.stockTopUpQuantity},
		status: [200], error: 'problem', codes: ['NOT_FOUND'],
	});
}

const orderBody = (over = {}) => ({
	items: [{productId: facts.productId, quantity: 1}],
	phone: '0900000000', address: '1 Le Loi', district: 'Bình Thạnh', city: 'Hồ Chí Minh',
	branchId: facts.branchId, ...over,
});

async function checkout(name, token, body = orderBody()) {
	return json(await call(name, 'POST /api/order', 'POST', '/api/order',
		{token, body, status: [201], error: 'any'}));
}

// --- curated walks, one per contract section

async function authWalk() {
	const t = facts.adminToken;
	await call('login-wrong-password', 'POST /api/auth/login', 'POST', '/api/auth/login',
		{body: {email: 'admin@flowershop.example', password: 'nope'}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('login-unknown-email', 'POST /api/auth/login', 'POST', '/api/auth/login',
		{body: {email: 'ghost@nowhere.x', password: 'nope'}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('login-missing-fields', 'POST /api/auth/login', 'POST', '/api/auth/login',
		{body: {}, status: [400], error: 'problem', codes: ['VALIDATION']});
	// The corpus email pool against login: every hostile address must stay
	// inside the documented envelope, validation 400 or unauthenticated 401.
	for (const [index, email] of corpus.emails.entries()) {
		await call(`login-corpus-email-${index}`, 'POST /api/auth/login', 'POST', '/api/auth/login',
			{body: {email, password: 'nope'}, status: [200, 400, 401], error: 'any', codes: ['VALIDATION', 'UNAUTHENTICATED']});
	}
	await call('logout-live', 'POST /api/auth/logout', 'POST', '/api/auth/logout',
		{token: t, status: [204]});
	await call('logout-dead-session', 'POST /api/auth/logout', 'POST', '/api/auth/logout',
		{token: t, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('logout-no-header', 'POST /api/auth/logout', 'POST', '/api/auth/logout',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	// Fresh admin session for every later walk: logout burned the old one.
	facts.adminToken = await login('admin@flowershop.example', '1234qwer');
	await call('reset-wrong-answer', 'POST /api/user/resetPassword', 'POST', '/api/user/resetPassword',
		{body: {email: facts.user4, answer: 'red', newPassword: 'pass5678'}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('reset-unknown-email', 'POST /api/user/resetPassword', 'POST', '/api/user/resetPassword',
		{body: {email: 'ghost@nowhere.x', answer: 'blue', newPassword: 'pass5678'}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('reset-good-answer', 'POST /api/user/resetPassword', 'POST', '/api/user/resetPassword',
		{body: {email: facts.user4, answer: 'blue', newPassword: rotatedCredential(4)}, status: [200], error: 'problem', codes: ['UNAUTHENTICATED']});
}

async function userWalk() {
	await call('me', 'GET /api/user/me', 'GET', '/api/user/me',
		{token: facts.memberToken, status: [200]});
	await call('me-no-token', 'GET /api/user/me', 'GET', '/api/user/me',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('me-update', 'PUT /api/user/me', 'PUT', '/api/user/me',
		{token: facts.memberToken, body: {name: 'Fuzz One', phone: '0912345678', address: '2 Hai Ba Trung',
			district: 'Quận 1', city: 'Hồ Chí Minh'}, status: [200], error: 'problem', codes: ['VALIDATION']});
	await call('me-password-wrong-current', 'POST /api/user/me/password', 'POST', '/api/user/me/password',
		{token: facts.memberToken, body: {currentPassword: 'wrong', newPassword: rotatedCredential(1)}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	// The rotated target derives from the run tag; on a replay of a completed
	// run the current password already is the rotated one and the change is a
	// same value no-op, still 204 with every session revoked.
	await call('me-password-change', 'POST /api/user/me/password', 'POST', '/api/user/me/password',
		{token: facts.memberToken, body: {currentPassword: facts.user1Password, newPassword: rotatedCredential(1)}, status: [204]});
	await call('me-token-dead-after-rotate', 'GET /api/user/me', 'GET', '/api/user/me',
		{token: facts.memberToken, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	facts.memberToken = await login(facts.user1, rotatedCredential(1));
	await call('create-duplicate-email', 'POST /api/user/create', 'POST', '/api/user/create',
		{body: {name: 'Dup', email: 'admin@flowershop.example', password: 'x'}, status: [409], error: 'problem', codes: ['EMAIL_IN_USE']});
	await call('create-missing-name', 'POST /api/user/create', 'POST', '/api/user/create',
		{body: {email: `fz${cfg.seed}-9@fuzz.local`, password: 'x'}, status: [400], error: 'problem', codes: ['VALIDATION']});
}

async function adminUserWalk() {
	const t = facts.adminToken;
	await call('list-users', 'GET /api/user', 'GET', '/api/user', {token: t, status: [200]});
	await call('list-users-member-forbidden', 'GET /api/user', 'GET', '/api/user',
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	await call('list-users-no-token', 'GET /api/user', 'GET', '/api/user',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	const users = await json(await call('admin-users-read', 'GET /api/user', 'GET', '/api/user',
		{token: t, status: [200]}));
	const target = users.find((u) => u.email === facts.user3);
	await call('update-user', 'PUT /api/user/{id}', 'PUT', `/api/user/${target.id}`,
		{token: t, body: {name: 'Fuzz Three', phone: '0900', role: 'USER', enable: true}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('update-user-unknown', 'PUT /api/user/{id}', 'PUT', '/api/user/99999999',
		{token: t, body: {name: 'Ghost', role: 'USER', enable: true}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	const buyer = users.find((u) => u.email === facts.user2);
	await call('delete-user-with-orders', 'DELETE /api/user/{id}', 'DELETE', `/api/user/${buyer.id}`,
		{token: t, status: [409], error: 'problem', codes: ['HAS_ORDERS']});
	const editor = users.find((u) => u.email === facts.user3);
	await call('delete-user-clean', 'DELETE /api/user/{id}', 'DELETE', `/api/user/${editor.id}`,
		{token: t, status: [204]});
	await call('delete-user-unknown', 'DELETE /api/user/{id}', 'DELETE', '/api/user/99999999',
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
}

async function catalogWalk() {
	for (const sort of corpus.sortValues) {
		await call(`product-sort-${sort || 'empty'}`, 'GET /api/product', 'GET', '/api/product',
			{query: {sort}, status: [200]});
	}
	for (const page of corpus.pages) {
		for (const size of corpus.sizes) {
			await call(`product-page-${page}-size-${size}`, 'GET /api/product', 'GET', '/api/product',
				{query: {page, size}, status: [200]});
		}
	}
	await call('product-all-filters', 'GET /api/product', 'GET', '/api/product',
		{query: {search: 'a', category: facts.categoryName, type: facts.typeName, sort: 'price-desc', page: 0, size: 48},
			status: [200]});
	await call('product-unknown-filters', 'GET /api/product', 'GET', '/api/product',
		{query: {search: corpus.strings[8], category: 'No Such Category', type: 'No Such Type'}, status: [200]});
	await call('product-by-id', 'GET /api/product/{id}', 'GET', `/api/product/${facts.productId}`, {status: [200]});
	await call('product-by-id-unknown', 'GET /api/product/{id}', 'GET', '/api/product/99999999',
		{status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('product-by-id-garbage', 'GET /api/product/{id}', 'GET', '/api/product/abc',
		{status: [400], error: 'problem', codes: ['VALIDATION']});
	const t = facts.adminToken;
	const created = await json(await call('product-create', 'POST /api/product/create', 'POST', '/api/product/create',
		{token: t, body: {name: `Fuzz Bouquet ${cfg.seed}`, description: 'harness probe', imgUrl: 'https://x/y.png',
			price: 100000, typeName: facts.typeName, categoryName: facts.categoryName}, status: [200], error: 'problem', codes: ['VALIDATION']}));
	await call('product-update', 'PUT /api/product/{id}', 'PUT', `/api/product/${created.id}`,
		{token: t, body: {...created, price: 120000}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('product-update-unknown', 'PUT /api/product/{id}', 'PUT', '/api/product/99999999',
		{token: t, body: {name: 'Ghost', price: 1, typeName: facts.typeName, categoryName: facts.categoryName},
			status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('product-bulk-upsert', 'POST /api/product', 'POST', '/api/product',
		{token: t, body: [{name: `Fuzz Bulk A ${cfg.seed}`, price: 50000, typeName: facts.typeName, categoryName: facts.categoryName},
			{name: `Fuzz Bulk B ${cfg.seed}`, price: 60000, typeName: facts.typeName, categoryName: facts.categoryName}],
			status: [200], error: 'problem', codes: ['VALIDATION']});
	await call('product-bulk-empty-list', 'POST /api/product', 'POST', '/api/product',
		{token: t, body: [], status: [200]});
	await call('product-delete', 'DELETE /api/product/{id}', 'DELETE', `/api/product/${created.id}`,
		{token: t, status: [204]});
	await call('product-delete-again', 'DELETE /api/product/{id}', 'DELETE', `/api/product/${created.id}`,
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('product-delete-many-empty-ids', 'DELETE /api/product', 'DELETE', '/api/product',
		{token: t, body: [], status: [204]});
	facts.cleanupProductIds = await (async () => {
		const page = await json(await call('product-cleanup-scan', 'GET /api/product', 'GET', '/api/product',
			{query: {search: `Fuzz Bulk`, size: 48}, status: [200]}));
		return page.content.map((p) => p.id);
	})();
	for (const id of facts.cleanupProductIds) {
		await call(`product-cleanup-${id}`, 'DELETE /api/product', 'DELETE', '/api/product',
			{token: t, body: [id], status: [204]});
	}
}

async function taxonomyWalk() {
	await call('category-list', 'GET /api/category', 'GET', '/api/category', {status: [200]});
	await call('type-list', 'GET /api/type', 'GET', '/api/type', {status: [200]});
	const t = facts.adminToken;
	const categoryName = `Fuzz Cat ${cfg.seed}`;
	await call('category-create', 'POST /api/category/create', 'POST', '/api/category/create',
		{token: t, body: {name: categoryName}, status: [200], error: 'problem', codes: ['VALIDATION']});
	await call('category-create-duplicate', 'POST /api/category/create', 'POST', '/api/category/create',
		{token: t, body: {name: categoryName}, status: [409], error: 'problem', codes: ['NAME_IN_USE']});
	const categories = await json(await call('category-scan', 'GET /api/category', 'GET', '/api/category', {status: [200]}));
	const created = categories.find((c) => c.name === categoryName);
	// Run-tagged rename target: the taxonomy PUT with an id-less body inserts
	// a fresh row under the new name instead of renaming the addressed one,
	// so a fixed target name would collide on the second run. The inserted
	// row outlives the run, so a same tag replay scores the 409 instead.
	await call('category-update', 'PUT /api/category/{id}', 'PUT', `/api/category/${created.id}`,
		{token: t, body: {name: `${categoryName}b-${runTag}`}, status: [200, 409], error: 'problem', codes: ['NOT_FOUND', 'NAME_IN_USE']});
	await call('category-update-unknown', 'PUT /api/category/{id}', 'PUT', '/api/category/99999999',
		{token: t, body: {name: 'Ghost Cat'}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('category-delete', 'DELETE /api/category/{id}', 'DELETE', `/api/category/${created.id}`,
		{token: t, status: [204]});
	await call('category-delete-unknown', 'DELETE /api/category/{id}', 'DELETE', '/api/category/99999999',
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	const typeName = `Fuzz Type ${cfg.seed}`;
	await call('type-create', 'POST /api/type/create', 'POST', '/api/type/create',
		{token: t, body: {name: typeName, categoryName: facts.categoryName}, status: [200], error: 'problem', codes: ['VALIDATION']});
	const types = await json(await call('type-scan', 'GET /api/type', 'GET', '/api/type', {status: [200]}));
	const createdType = types.find((ty) => ty.name === typeName);
	await call('type-update', 'PUT /api/type/{id}', 'PUT', `/api/type/${createdType.id}`,
		{token: t, body: {name: `${typeName}b-${runTag}`, categoryName: facts.categoryName}, status: [200, 409], error: 'problem', codes: ['NOT_FOUND', 'NAME_IN_USE']});
	await call('type-delete', 'DELETE /api/type/{id}', 'DELETE', `/api/type/${createdType.id}`,
		{token: t, status: [204]});
}

async function branchWalk() {
	const t = facts.adminToken;
	await call('branch-list', 'GET /api/branch', 'GET', '/api/branch', {status: [200]});
	const created = await json(await call('branch-create', 'POST /api/branch', 'POST', '/api/branch',
		{token: t, body: {name: `Fuzz Branch ${cfg.seed}`, address: '3 Test St', district: 'Bình Thạnh',
			city: 'Hồ Chí Minh', lat: 10.78, lng: 106.7, active: false}, status: [200], error: 'problem', codes: ['VALIDATION']}));
	await call('branch-update', 'PUT /api/branch/{id}', 'PUT', `/api/branch/${created.id}`,
		{token: t, body: {...created, address: '4 Test St'}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	// Body validation runs before the existence check: a body without the
	// required coordinates scores 400 VALIDATION, a valid body on an unknown
	// id scores the 404.
	await call('branch-update-invalid-body', 'PUT /api/branch/{id}', 'PUT', '/api/branch/99999999',
		{token: t, body: {name: 'Ghost'}, status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('branch-update-unknown', 'PUT /api/branch/{id}', 'PUT', '/api/branch/99999999',
		{token: t, body: {name: 'Ghost', lat: 10.7, lng: 106.7}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('stock-read-empty-branch', 'GET /api/branch/{id}/stock', 'GET', `/api/branch/${created.id}/stock`,
		{token: t, status: [200]});
	await call('stock-set-new-branch', 'PUT /api/branch/{id}/stock', 'PUT', `/api/branch/${created.id}/stock`,
		{token: t, body: {productId: facts.productId, quantity: 3}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('stock-read-member-forbidden', 'GET /api/branch/{id}/stock', 'GET', `/api/branch/${facts.branchId}/stock`,
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	await call('stock-set-negative-clamps', 'PUT /api/branch/{id}/stock', 'PUT', `/api/branch/${facts.branchId}/stock`,
		{token: t, body: {productId: facts.productId, quantity: -5}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('stock-set-unknown-product', 'PUT /api/branch/{id}/stock', 'PUT', `/api/branch/${facts.branchId}/stock`,
		{token: t, body: {productId: 99999999, quantity: 5}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('stock-set-unknown-branch', 'PUT /api/branch/{id}/stock', 'PUT', '/api/branch/99999999/stock',
		{token: t, body: {productId: facts.productId, quantity: 5}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('stock-restore', 'PUT /api/branch/{id}/stock', 'PUT', `/api/branch/${facts.branchId}/stock`,
		{token: t, body: {productId: facts.productId, quantity: cfg.stockTopUpQuantity}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	// The created branch now carries a stock row, so delete must refuse.
	await call('branch-delete-with-stock', 'DELETE /api/branch/{id}', 'DELETE', `/api/branch/${created.id}`,
		{token: t, status: [409], error: 'problem', codes: ['STOCK_ROWS_EXIST']});
	await call('branch-delete-unknown', 'DELETE /api/branch/{id}', 'DELETE', '/api/branch/99999999',
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
}

async function orderAndPaymentWalk() {
	const t = facts.adminToken;
	const first = await checkout('order-checkout-nearest-branch', facts.buyerToken,
		orderBody({branchId: undefined}));
	facts.buyerOrderId = first.order.id;
	const couponed = await checkout('order-checkout-coupon', facts.buyerToken,
		orderBody({couponCode: 'WELCOME10'}));
	await call('order-me', 'GET /api/order/me', 'GET', '/api/order/me',
		{token: facts.buyerToken, query: {page: 0, size: 12}, status: [200]});
	await call('order-me-no-token', 'GET /api/order/me', 'GET', '/api/order/me',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('order-get-owner', 'GET /api/order/{id}', 'GET', `/api/order/${first.order.id}`,
		{token: facts.buyerToken, status: [200]});
	await call('order-get-other-user-forbidden', 'GET /api/order/{id}', 'GET', `/api/order/${first.order.id}`,
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	await call('order-get-unknown', 'GET /api/order/{id}', 'GET', '/api/order/99999999',
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('order-admin-list', 'GET /api/order', 'GET', '/api/order',
		{token: t, query: {status: 'PENDING', from: '2026-01-01T00:00:00Z', to: '2026-12-31T00:00:00Z', page: 0, size: 12}, status: [200]});
	await call('order-admin-list-garbage-dates', 'GET /api/order', 'GET', '/api/order',
		{token: t, query: {status: 'banana', from: 'zzz', to: 'yyy'}, status: [200]});
	await call('order-admin-list-member-forbidden', 'GET /api/order', 'GET', '/api/order',
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	// Payment matrix against the live PENDING session from the couponed checkout.
	const payment = couponed.payment;
	const good = sig(payment.id, couponed.order.id, couponed.order.total);
	await call('payment-get', 'GET /api/payment/{id}', 'GET', `/api/payment/${payment.id}`,
		{query: {sig: good}, status: [200]});
	await call('payment-get-bitflip-sig', 'GET /api/payment/{id}', 'GET', `/api/payment/${payment.id}`,
		{query: {sig: bitFlip(good)}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('payment-get-truncated-sig', 'GET /api/payment/{id}', 'GET', `/api/payment/${payment.id}`,
		{query: {sig: good.slice(0, 32)}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('payment-get-missing-sig', 'GET /api/payment/{id}', 'GET', `/api/payment/${payment.id}`,
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	// The corpus sig pool against a live payment: every hostile signature
	// must draw the documented 401, never a 5xx or a body leak.
	for (const [index, hostile] of corpus.sigs.entries()) {
		await call(`payment-get-sig-corpus-${index}`, 'GET /api/payment/{id}', 'GET', `/api/payment/${payment.id}`,
			{query: {sig: hostile}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	}
	await call('payment-get-unknown-id', 'GET /api/payment/{id}', 'GET', '/api/payment/deadbeef',
		{query: {sig: good}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('payment-confirm', 'POST /api/payment/{id}/confirm', 'POST', `/api/payment/${payment.id}/confirm`,
		{query: {sig: good}, status: [200]});
	await call('payment-confirm-replay', 'POST /api/payment/{id}/confirm', 'POST', `/api/payment/${payment.id}/confirm`,
		{query: {sig: good}, status: [200]});
	await call('payment-cancel-after-confirm', 'POST /api/payment/{id}/cancel', 'POST', `/api/payment/${payment.id}/cancel`,
		{query: {sig: good}, status: [409], error: 'problem', codes: ['PAYMENT_CONFIRMED']});
	// Fulfilment transitions on the PAID order, then the terminal wall.
	await call('order-status-shipped', 'POST /api/order/{id}/status', 'POST', `/api/order/${couponed.order.id}/status`,
		{token: t, body: {status: 'SHIPPED'}, status: [200], error: 'problem', codes: ['NOT_FOUND', 'ILLEGAL_TRANSITION']});
	await call('order-status-completed', 'POST /api/order/{id}/status', 'POST', `/api/order/${couponed.order.id}/status`,
		{token: t, body: {status: 'COMPLETED'}, status: [200], error: 'problem', codes: ['NOT_FOUND', 'ILLEGAL_TRANSITION']});
	await call('order-status-illegal-reopen', 'POST /api/order/{id}/status', 'POST', `/api/order/${couponed.order.id}/status`,
		{token: t, body: {status: 'PENDING'}, status: [409], error: 'problem', codes: ['ILLEGAL_TRANSITION']});
	await call('order-cancel-completed', 'POST /api/order/{id}/cancel', 'POST', `/api/order/${couponed.order.id}/cancel`,
		{token: t, status: [409], error: 'problem', codes: ['ILLEGAL_TRANSITION']});
	// A second PENDING order walks the cancel path: owner cancel, replay, stock restore.
	const second = await checkout('order-checkout-for-cancel', facts.buyerToken);
	const cancelSig = sig(second.payment.id, second.order.id, second.order.total);
	await call('payment-cancel', 'POST /api/payment/{id}/cancel', 'POST', `/api/payment/${second.payment.id}/cancel`,
		{query: {sig: cancelSig}, status: [200]});
	await call('payment-cancel-replay', 'POST /api/payment/{id}/cancel', 'POST', `/api/payment/${second.payment.id}/cancel`,
		{query: {sig: cancelSig}, status: [200]});
	await call('payment-confirm-after-cancel', 'POST /api/payment/{id}/confirm', 'POST', `/api/payment/${second.payment.id}/confirm`,
		{query: {sig: cancelSig}, status: [409], error: 'problem', codes: ['PAYMENT_CANCELLED']});
	await call('order-cancel-already-cancelled', 'POST /api/order/{id}/cancel', 'POST', `/api/order/${second.order.id}/cancel`,
		{token: facts.buyerToken, status: [409], error: 'problem', codes: ['ILLEGAL_TRANSITION']});
	// Cross-session sig: a valid signature computed over a different payment.
	const third = await checkout('order-checkout-cross-session', facts.buyerToken);
	await call('payment-get-cross-session-sig', 'GET /api/payment/{id}', 'GET', `/api/payment/${third.payment.id}`,
		{query: {sig: cancelSig}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('order-owner-cancel-pending', 'POST /api/order/{id}/cancel', 'POST', `/api/order/${third.order.id}/cancel`,
		{token: facts.buyerToken, status: [200], error: 'problem', codes: ['NOT_FOUND', 'ILLEGAL_TRANSITION']});
	await call('order-cancel-unknown', 'POST /api/order/{id}/cancel', 'POST', '/api/order/99999999/cancel',
		{token: facts.buyerToken, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('order-status-member-forbidden', 'POST /api/order/{id}/status', 'POST', `/api/order/${facts.buyerOrderId}/status`,
		{token: facts.buyerToken, body: {status: 'SHIPPED'}, status: [403], error: 'problem', codes: ['FORBIDDEN']});
}

async function checkoutCorpusWalk() {
	const token = facts.buyerToken;
	await call('order-empty-items', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: []}), status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('order-duplicate-items', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: facts.productId, quantity: 1}, {productId: facts.productId, quantity: 1}]}),
			status: [201], error: 'any'});
	await call('order-quantity-zero', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: facts.productId, quantity: 0}]}), status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('order-quantity-negative', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: facts.productId, quantity: -3}]}), status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('order-quantity-above-ceiling', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: facts.productId, quantity: 99999}]}), status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('order-unknown-product', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: 99999999, quantity: 1}]}), status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('order-oversell', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({items: [{productId: facts.productId, quantity: 9999}]}), status: [409], error: 'problem', codes: ['OUT_OF_STOCK']});
	await call('order-unknown-branch', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({branchId: 99999999}), status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('order-unknown-coupon', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({couponCode: 'NOSUCH'}), status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('order-inactive-coupon', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({couponCode: 'EXPIRED5'}), status: [409], error: 'problem', codes: ['COUPON_INACTIVE']});
	await call('order-missing-address', 'POST /api/order', 'POST', '/api/order',
		{token, body: {items: [{productId: facts.productId, quantity: 1}], phone: '0900'}, status: [400], error: 'problem', codes: ['VALIDATION']});
	await call('order-unicode-address', 'POST /api/order', 'POST', '/api/order',
		{token, body: orderBody({address: corpus.strings[8], district: 'Bình Thạnh'}), status: [201], error: 'any'});
}

async function couponWalk() {
	const t = facts.adminToken;
	await call('coupon-list', 'GET /api/coupon', 'GET', '/api/coupon', {token: t, status: [200]});
	await call('coupon-list-member-forbidden', 'GET /api/coupon', 'GET', '/api/coupon',
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	const code = `FZ${cfg.seed % 10000}`;
	const created = await call('coupon-create', 'POST /api/coupon', 'POST', '/api/coupon',
		{token: t, body: {code, kind: 'PERCENT', value: 15, active: true, expiresAt: null},
			status: [200, 409], error: 'any', codes: ['VALIDATION', 'NAME_IN_USE']});
	let couponId;
	if (created.status === 200) {
		couponId = (await json(created)).id;
	} else {
		// 409 NAME_IN_USE from an earlier crashed run: resolve the existing
		// coupon by its code instead of addressing an undefined id.
		const list = await json(await call('coupon-scan', 'GET /api/coupon', 'GET', '/api/coupon', {token: t, status: [200]}));
		couponId = list.find((c) => c.code === code).id;
	}
	await call('coupon-create-duplicate', 'POST /api/coupon', 'POST', '/api/coupon',
		{token: t, body: {code, kind: 'PERCENT', value: 15, active: true}, status: [409], error: 'problem', codes: ['NAME_IN_USE']});
	await call('coupon-create-negative-value', 'POST /api/coupon', 'POST', '/api/coupon',
		{token: t, body: {code: `FZ-${rng().toString(36).slice(2, 8)}`, kind: 'FIXED', value: -5, active: true},
			status: [400], error: 'any', codes: ['VALIDATION']});
	await call('coupon-update', 'PUT /api/coupon/{id}', 'PUT', `/api/coupon/${couponId}`,
		{token: t, body: {code, kind: 'PERCENT', value: 20, active: true, expiresAt: null}, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('coupon-update-unknown', 'PUT /api/coupon/{id}', 'PUT', '/api/coupon/99999999',
		{token: t, body: {code: 'GHOST', kind: 'FIXED', value: 1, active: true}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('coupon-validate-percent', 'POST /api/coupon/validate', 'POST', '/api/coupon/validate',
		{token: facts.memberToken, body: {code: 'WELCOME10', subtotal: 255000}, status: [200]});
	await call('coupon-validate-fixed', 'POST /api/coupon/validate', 'POST', '/api/coupon/validate',
		{token: facts.memberToken, body: {code: 'SHIP50K', subtotal: 60000}, status: [200]});
	await call('coupon-validate-unknown', 'POST /api/coupon/validate', 'POST', '/api/coupon/validate',
		{token: facts.memberToken, body: {code: 'NOSUCH', subtotal: 100000}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('coupon-validate-inactive', 'POST /api/coupon/validate', 'POST', '/api/coupon/validate',
		{token: facts.memberToken, body: {code: 'EXPIRED5', subtotal: 100000}, status: [409], error: 'problem', codes: ['COUPON_INACTIVE']});
	await call('coupon-validate-no-token', 'POST /api/coupon/validate', 'POST', '/api/coupon/validate',
		{body: {code: 'WELCOME10', subtotal: 1000}, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	await call('coupon-delete', 'DELETE /api/coupon/{id}', 'DELETE', `/api/coupon/${couponId}`,
		{token: t, status: [204]});
	await call('coupon-delete-again', 'DELETE /api/coupon/{id}', 'DELETE', `/api/coupon/${couponId}`,
		{token: t, status: [404], error: 'problem', codes: ['NOT_FOUND']});
}

async function wishlistWalk() {
	await call('wishlist-toggle-on', 'POST /api/wishlist/me/{productId}', 'POST', `/api/wishlist/me/${facts.productId}`,
		{token: facts.memberToken, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('wishlist-toggle-off', 'POST /api/wishlist/me/{productId}', 'POST', `/api/wishlist/me/${facts.productId}`,
		{token: facts.memberToken, status: [200], error: 'problem', codes: ['NOT_FOUND']});
	await call('wishlist-toggle-unknown-product', 'POST /api/wishlist/me/{productId}', 'POST', '/api/wishlist/me/99999999',
		{token: facts.memberToken, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('wishlist-list', 'GET /api/wishlist/me', 'GET', '/api/wishlist/me',
		{token: facts.memberToken, status: [200]});
	await call('wishlist-list-no-token', 'GET /api/wishlist/me', 'GET', '/api/wishlist/me',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
}

async function reportWalk() {
	const t = facts.adminToken;
	await call('report-sales', 'GET /api/report/sales', 'GET', '/api/report/sales', {token: t, status: [200]});
	await call('report-sales-window', 'GET /api/report/sales', 'GET', '/api/report/sales',
		{token: t, query: {from: '2026-09-01T00:00:00Z', to: '2026-10-07T00:00:00Z'}, status: [200]});
	await call('report-sales-garbage-dates', 'GET /api/report/sales', 'GET', '/api/report/sales',
		{token: t, query: {from: 'zzz', to: 'yyy'}, status: [200]});
	await call('report-sales-far-future', 'GET /api/report/sales', 'GET', '/api/report/sales',
		{token: t, query: {from: '9999-01-01T00:00:00Z', to: '9999-12-31T00:00:00Z'}, status: [200]});
	await call('report-sales-member-forbidden', 'GET /api/report/sales', 'GET', '/api/report/sales',
		{token: facts.memberToken, status: [403], error: 'problem', codes: ['FORBIDDEN']});
	await call('report-sales-no-token', 'GET /api/report/sales', 'GET', '/api/report/sales',
		{status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
}

// Cross-cutting abuse: malformed transports, tampered tokens, wrong methods,
// unknown paths. None of these may reach a controller with side effects.
async function crossWalk() {
	for (const raw of corpus.malformedBodies) {
		await call(`login-malformed-${raw.length}-${raw.slice(0, 6)}`, 'POST /api/auth/login', 'POST', '/api/auth/login',
			{raw, status: [400], error: 'problem', codes: ['VALIDATION']});
		await call(`register-malformed-${raw.length}-${raw.slice(0, 6)}`, 'POST /api/user/create', 'POST', '/api/user/create',
			{raw, status: [400], error: 'problem', codes: ['VALIDATION']});
	}
	for (const plaintext of corpus.tokenPlaintexts) {
		const token = plaintext.length ? Buffer.from(plaintext).toString('base64') : '';
		await call(`tampered-token-${plaintext || 'empty'}`, 'GET /api/user/me', 'GET', '/api/user/me',
			{token, status: [401], error: 'problem', codes: ['UNAUTHENTICATED']});
	}
	await call('tampered-token-member-on-admin', 'GET /api/user', 'GET', '/api/user',
		{token: Buffer.from(`${facts.buyerOrderId}+ADMIN+deadbeef`).toString('base64'),
			status: [401, 403], error: 'any', codes: ['UNAUTHENTICATED', 'FORBIDDEN']});
	// Wrong methods on paths that exist for another verb: 405 problem+json
	// METHOD_NOT_ALLOWED from the error advice.
	await call('wrong-method-get-login', 'GET /api/auth/login', 'GET', '/api/auth/login', {status: [405], error: 'problem', codes: ['METHOD_NOT_ALLOWED']});
	await call('wrong-method-delete-payment', 'DELETE /api/payment/x', 'DELETE', '/api/payment/x', {status: [405], error: 'problem', codes: ['METHOD_NOT_ALLOWED']});
	await call('wrong-method-put-order-me', 'PUT /api/order/me', 'PUT', '/api/order/me', {status: [405], error: 'problem', codes: ['METHOD_NOT_ALLOWED']});
	// DELETE /api/product is real and destructive with an empty body: hit it
	// only with a member token, which the interceptor rejects before dispatch.
	await call('wrong-method-delete-product-member', 'DELETE /api/product', 'DELETE', '/api/product',
		{token: facts.memberToken, body: [], status: [403], error: 'problem', codes: ['FORBIDDEN']});
	await call('unknown-api-path', 'GET /api/nosuch', 'GET', '/api/nosuch', {status: [404], error: 'problem', codes: ['NOT_FOUND']});
	await call('unknown-api-post-path', 'POST /api/nosuch/deep/path', 'POST', '/api/nosuch/deep/path',
		{body: {}, status: [404], error: 'problem', codes: ['NOT_FOUND']});
	// Path traversal over a raw socket: the dot segments must reach the server
	// un-normalized and be refused as an unknown endpoint, with the problem
	// instance echoing the raw path back as the proof it arrived intact.
	const traversal = await rawPathProbe('/api/product/../user');
	stat('GET /api/product/../user', traversal.status);
	if (traversal.status !== 404) {
		fail('traversal-path', `raw dot-segment path answered ${traversal.status}, expected the documented 404`);
	} else {
		const parsed = JSON.parse(traversal.body);
		assertProblem('traversal-path', parsed, 404, ['NOT_FOUND']);
		if (parsed.instance !== '/api/product/../user') {
			fail('traversal-path', `problem instance ${parsed.instance} lost the raw dot segments`);
		}
	}
}

// --- seeded generated variants over mutating JSON templates

function hostileValue() {
	switch (Math.floor(rng() * 6)) {
		case 0: return pick(corpus.numbers);
		case 1: return pick(corpus.strings);
		case 2: return corpus.longString;
		case 3: return pick(corpus.enums);
		case 4: return pick(corpus.emails);
		default: return pick(corpus.numbers);
	}
}

function mutated(body) {
	const keys = Object.keys(body);
	const key = keys[Math.floor(rng() * keys.length)];
	const copy = {...body};
	// Nested items arrays mutate one inner field so checkout variants stay shaped.
	if (Array.isArray(copy[key])) {
		const inner = {...copy[key][0]};
		inner[Object.keys(inner)[Math.floor(rng() * Object.keys(inner).length)]] = hostileValue();
		copy[key] = [inner];
	} else {
		copy[key] = hostileValue();
	}
	return copy;
}

async function variantsWalk() {
	const templates = [
		['login', 'POST /api/auth/login', '/api/auth/login', undefined, {email: 'admin@flowershop.example', password: '1234qwer'}, [200, 400, 401]],
		['register', 'POST /api/user/create', '/api/user/create', undefined,
			{name: 'V', email: `fzv${cfg.seed}@fuzz.local`, password: 'pass1234', phone: '0', address: 'a', district: 'd', city: 'c', answer: 'q'}],
		['checkout', 'POST /api/order', '/api/order', facts.buyerToken, orderBody()],
		['me-update', 'PUT /api/user/me', '/api/user/me', facts.memberToken, {name: 'V', phone: '0', address: 'a', district: 'd', city: 'c'}],
		['coupon-create', 'POST /api/coupon', '/api/coupon', facts.adminToken, {code: `FZV${Math.floor(rng() * 1e6)}`, kind: 'PERCENT', value: 10, active: true}],
		['stock-set', 'PUT /api/branch/{id}/stock', `/api/branch/${facts.branchId}/stock`, facts.adminToken,
			{productId: facts.productId, quantity: 10}],
		['branch-create', 'POST /api/branch', '/api/branch', facts.adminToken,
			{name: `Fuzz V ${Math.floor(rng() * 1e6)}`, address: 'a', district: 'd', city: 'c', lat: 10.7, lng: 106.7, active: true}],
		['payment-validate', 'POST /api/coupon/validate', '/api/coupon/validate', facts.memberToken, {code: 'WELCOME10', subtotal: 100000}],
	];
	for (const [name, template, path, token, body, statuses] of templates) {
		for (let i = 0; i < cfg.generatedVariantsPerEndpoint; i++) {
			await call(`variant-${name}-${i}`, template, methodOf(template), path,
				{token, body: mutated(body), status: statuses ?? [200, 201, 204, 400, 404, 409], error: 'any'});
		}
	}
	// A few raw malformed swaps against the two most sensitive writers.
	for (let i = 0; i < cfg.generatedVariantsPerEndpoint; i++) {
		await call(`variant-raw-checkout-${i}`, 'POST /api/order', 'POST', '/api/order',
			{token: facts.buyerToken, raw: pick(corpus.malformedBodies), status: [400], error: 'problem', codes: ['VALIDATION']});
		await call(`variant-raw-login-${i}`, 'POST /api/auth/login', 'POST', '/api/auth/login',
			{raw: pick(corpus.malformedBodies), status: [400], error: 'problem', codes: ['VALIDATION']});
	}
}

const methodOf = (template) => template.split(' ')[0];

// --- report

function writeReport(jarName, durationMs) {
	const lines = [];
	lines.push('# fuzz report', '');
	lines.push('Baseline run of `make fuzz` per plan decision 13: the in-repo API fuzz harness over the packaged jar.');
	lines.push('');
	lines.push(`- jar: ${jarName}`);
	lines.push(`- seed: ${cfg.seed} (scripts/tools/qa.json, fuzz.seed)`);
	lines.push(`- run tag: ${runTag} (namespaces this run's users; replay with FUZZ_RUN_TAG)`);
	lines.push(`- corpus: ${cfg.corpusPath}`);
	lines.push(`- requests fired: ${requests}`);
	lines.push(`- endpoints covered: ${endpointStats.size} templates`);
	lines.push(`- duration: ${(durationMs / 1000).toFixed(1)} s`);
	lines.push(`- assertion failures: ${failures.length}`);
	lines.push('');
	lines.push('Invariants asserted on every response: status inside the documented set for the endpoint,');
	lines.push('and every error body, application and framework alike (deserialization, method-not-allowed,');
	lines.push('unknown paths, traversal), is problem+json carrying a code from the contract list, and never');
	lines.push('a 5xx, hang, or run-budget breach. Status unions appear where persistent');
	lines.push('state can legitimately flip a case between two documented outcomes, for instance the register');
	lines.push('template across tagged reruns (201 versus EMAIL_IN_USE 409) or a variant that may validate or');
	lines.push('score a business 404 or 409 depending on which field the seeded mutation strikes. Replaying a');
	lines.push('completed run with FUZZ_RUN_TAG is green end to end: every credential derives from the tag, so');
	lines.push('setup login falls back to the rotated password and the taxonomy rename scores NAME_IN_USE');
	lines.push('against the previous run residue instead of failing.');
	lines.push('');
	lines.push('| endpoint | requests | statuses |');
	lines.push('| --- | --- | --- |');
	for (const [template, entry] of [...endpointStats.entries()].sort()) {
		const statuses = [...entry.statuses.entries()].sort((a, b) => a[0] - b[0])
			.map(([status, count]) => `${status}x${count}`).join(' ');
		lines.push(`| \`${template}\` | ${entry.count} | ${statuses} |`);
	}
	lines.push('');
	if (failures.length > 0) {
		lines.push('## failures', '');
		for (const failure of failures) lines.push(`- ${failure.name}: ${failure.detail}`);
		lines.push('');
	}
	writeFileSync(join(ROOT, cfg.reportPath), lines.join('\n') + '\n');
}

// --- main

let server = null;
try {
	mkdirSync(dirname(join(ROOT, cfg.reportPath)), {recursive: true});
	mkdirSync(dirname(join(ROOT, cfg.serverLogPath)), {recursive: true});
	server = await startServer();
	await setup();
	await authWalk();
	await userWalk();
	await catalogWalk();
	await taxonomyWalk();
	await branchWalk();
	// Orders before admin user admin: the HAS_ORDERS delete case needs the
	// buyer's checkouts on record, and deleting a user kills its session.
	await orderAndPaymentWalk();
	await checkoutCorpusWalk();
	await adminUserWalk();
	await couponWalk();
	await wishlistWalk();
	await reportWalk();
	await crossWalk();
	await variantsWalk();
} catch (error) {
	fail('run-aborted', error.message.split('\n')[0]);
	console.error(error);
} finally {
	await stopServer(server);
}

const duration = elapsed();
writeReport(server?.jar ? server.jar.slice(ROOT.length + 1) : 'unavailable', duration);
console.log(`fuzz: ${requests} requests over ${endpointStats.size} endpoint templates in ${(duration / 1000).toFixed(1)} s, ${failures.length} failure(s)`);
console.log(`report: ${cfg.reportPath}`);
process.exit(failures.length > 0 ? 1 : 0);
