// Captures the README screenshot set from the live app served by the packaged jar.
// Run through `make screenshots`, which provides db-up, JAVA_BIN, and the MySQL env.
// Each capture mirrors one 2019 screenshot: same page, same interaction state.
import {spawn} from 'node:child_process';
import {readdir, readFile, mkdir} from 'node:fs/promises';
import {existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = {
	baseUrl: process.env.FLOWERSHOP_BASE_URL ?? 'http://localhost:8080',
	outDir: path.join(REPO_ROOT, 'project-pictures'),
	viewport: {width: 1600, height: 900},
	locale: 'en',
	member: {email: 'chuatebongdem666@gmail.com', password: '12345678', userId: 4},
	admin: {email: 'flowershop.noreply@gmail.com', password: '1234qwer'},
	healthTimeoutMs: 180_000,
	imageTimeoutMs: 45_000
};

async function fetchJson(url, options) {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`${options?.method ?? 'GET'} ${url} -> ${response.status}`);
	}
	return response.json();
}

async function findJar() {
	const target = path.join(REPO_ROOT, 'target');
	if (!existsSync(target)) {
		throw new Error('target/ missing; run make package first');
	}
	const jars = (await readdir(target))
		.filter(name => /^flowershop-.*\.jar$/.test(name) && !name.endsWith('.original'))
		.map(name => ({name, mtimeMs: statSync(path.join(target, name)).mtimeMs}))
		.sort((a, b) => b.mtimeMs - a.mtimeMs);
	if (jars.length === 0) {
		throw new Error('no packaged jar in target/; run make package first');
	}
	return path.join(target, jars[0].name);
}

function killTree(child) {
	if (process.platform === 'win32') {
		// taskkill /T reaches the whole process tree, child.kill() would not.
		spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
	} else {
		child.kill('SIGTERM');
	}
}

async function startServer() {
	if (process.env.FLOWERSHOP_BASE_URL) {
		return null;
	}
	const jar = await findJar();
	const javaBin = process.env.JAVA_BIN
		?? (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java');
	console.log(`[server] ${javaBin} -jar ${path.relative(REPO_ROOT, jar)}`);
	const child = spawn(javaBin, ['-jar', jar], {cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe']});
	let stderrTail = '';
	child.stderr.on('data', chunk => {
		stderrTail = (stderrTail + chunk).slice(-2000);
	});
	// These throws happen before main's try/finally, so the tree must die here
	// or the orphaned jar keeps port 8080 and poisons every later run.
	const deadline = Date.now() + CONFIG.healthTimeoutMs;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`jar exited with code ${child.exitCode}:\n${stderrTail}`);
		}
		try {
			await fetchJson(`${CONFIG.baseUrl}/api/product`);
			return {child, stderrTail: () => stderrTail};
		} catch {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
	killTree(child);
	throw new Error(`app did not answer on ${CONFIG.baseUrl} within ${CONFIG.healthTimeoutMs} ms:\n${stderrTail}`);
}

async function stopServer(server) {
	if (!server || server.child.exitCode !== null) {
		return;
	}
	// 'close' fires exactly once, so a jar that already died would leave a bare
	// once() listener hanging forever; the timeout keeps make from hanging too.
	await new Promise(resolve => {
		const timer = setTimeout(resolve, 10_000);
		server.child.once('close', () => {
			clearTimeout(timer);
			resolve();
		});
		killTree(server.child);
	});
}

async function seedData() {
	const categories = await fetchJson(`${CONFIG.baseUrl}/api/category`);
	if (!Array.isArray(categories) || categories.length === 0) {
		throw new Error('category table is empty; run make db-seed first');
	}
	const products = await fetchJson(`${CONFIG.baseUrl}/api/product`);
	if (products.length === 0) {
		const payload = await readFile(path.join(REPO_ROOT, 'db/product.json'), 'utf8');
		await fetchJson(`${CONFIG.baseUrl}/api/product`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: payload
		});
		console.log('[seed] products imported from db/product.json');
	}
	// Bills drive the summary and account pages; placed through the real checkout below.
	// The endpoint answers 400 for a user with no bills (pre-existing behavior).
	const billsResponse = await fetch(`${CONFIG.baseUrl}/api/bill/user/${CONFIG.member.userId}`);
	const memberBills = billsResponse.ok ? await billsResponse.json() : [];
	return memberBills.length === 0;
}

async function launchBrowser() {
	const channels = ['chrome', 'msedge'];
	for (const channel of channels) {
		try {
			return await chromium.launch({channel, headless: true});
		} catch (error) {
			console.log(`[browser] ${channel} unavailable: ${error.message.split('\n')[0]}`);
		}
	}
	throw new Error(`no chromium channel found (tried ${channels.join(', ')})`);
}

async function shot(page, name, fullPage = false) {
	await page.screenshot({path: path.join(CONFIG.outDir, name), fullPage});
	console.log(`[shot] ${name}`);
}

async function waitForImages(page) {
	const loaded = () => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0);
	try {
		await page.waitForFunction(loaded, null, {timeout: CONFIG.imageTimeoutMs});
	} catch {
		// image.complete is true for broken loads too, so failed CDN URLs are
		// indistinguishable from slow ones without the naturalWidth check above.
		const broken = await page.evaluate(() => Array.from(document.images)
			.filter(image => image.complete && image.naturalWidth === 0)
			.map(image => image.src));
		if (broken.length > 0) {
			throw new Error(`broken images, not capturing placeholder icons:\n${broken.join('\n')}`);
		}
		console.log('[warn] some images did not finish loading');
	}
}

async function closeModal(page) {
	const close = page.locator('.modal.show .btn-close');
	if (await close.count() > 0) {
		await close.first().click();
	} else {
		await page.keyboard.press('Escape');
	}
	await page.waitForSelector('.modal.show', {state: 'detached', timeout: 5000});
}

// Navbar button order per app.component.html: guest = [cart, login],
// member = [cart, logout], admin = [logout].
async function login(page, {email, password}) {
	await page.locator('.responsive-float button').nth(1).click();
	// ngx-bootstrap queues a new modal behind the previous fade-out; values filled
	// before the container carries the show class do not survive, so gate on it.
	await page.waitForSelector('.modal.show #inputEmail');
	await page.fill('#inputEmail', email);
	await page.fill('#inputPassword', password);
	await page.locator('.modal.show .btn-success').click();
	await page.waitForSelector('.modal.show', {state: 'detached', timeout: 10000});
	// The app writes the token before the zoneless navbar re-renders, so gate
	// on the DOM, not on localStorage, before any button-index click.
	await page.waitForSelector('.responsive-float svg.fa-right-from-bracket', {timeout: 10000});
}

async function logout(page) {
	await page.locator('.responsive-float button').nth(1).click();
	// Same race as login in reverse: the GUESS token lands while the stale
	// member navbar still shows logout at nth(1).
	await page.waitForSelector('.responsive-float svg.fa-right-to-bracket', {timeout: 10000});
}

async function addToCart(page, index) {
	await page.locator('app-store .card-footer button').nth(index).click();
}

async function openCart(page) {
	await page.locator('.responsive-float button').nth(0).click();
	await page.waitForSelector('.modal.show .wrapper-cart-table');
	await page.waitForFunction(() => /\([1-9]/.test(document.querySelector('.responsive-float button span')?.textContent ?? ''), null, {timeout: 5000});
}

async function main() {
	await mkdir(CONFIG.outDir, {recursive: true});
	const server = await startServer();
	let browser;
	let page;
	try {
		const placeOrder = await seedData();
		browser = await launchBrowser();
		const context = await browser.newContext({viewport: CONFIG.viewport, locale: CONFIG.locale});
		page = await context.newPage();
		page.on('dialog', dialog => dialog.accept());
		page.on('console', message => {
			if (message.type() === 'error' || message.type() === 'warning') {
				console.log(`[console.${message.type()}] ${message.text()}`);
			}
		});
		page.on('requestfailed', request => console.log(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText}`));
		page.on('response', response => {
			if (response.status() >= 400) {
				console.log(`[http ${response.status()}] ${response.request().method()} ${response.url()}`);
			}
		});

		// Guest: shop grid, product details modal, cart modal.
		await page.goto(`${CONFIG.baseUrl}/`);
		await page.waitForSelector('app-store .card');
		await waitForImages(page);
		// Viewport framing like the 2019 set; fullPage would float the fixed
		// scroll buttons into the middle of the tall capture.
		await shot(page, '01-shop-page.png');

		await page.locator('app-store .card-body img').first().click();
		await page.waitForSelector('.modal.show img.img-fluid');
		await waitForImages(page);
		await shot(page, '11-product-details.png');
		await closeModal(page);

		await addToCart(page, 0);
		await addToCart(page, 2);
		await openCart(page);
		await shot(page, '02-shopping-cart.png');
		await closeModal(page);

		// Member: place one order (only when the account has no bills yet), account details.
		await login(page, CONFIG.member);
		if (placeOrder) {
			await addToCart(page, 1);
			await openCart(page);
			await page.locator('.modal.show .btn-success').click(); // confirm order, alert auto-accepted
			await page.waitForSelector('.modal.show', {state: 'detached', timeout: 10000});
			const bills = await fetchJson(`${CONFIG.baseUrl}/api/bill/user/${CONFIG.member.userId}`);
			if (bills.length === 0) {
				throw new Error('checkout produced no bills');
			}
		}
		await page.locator('a[href="/info"]').click();
		await page.waitForFunction(() => (document.querySelector('#inputNameI')?.value ?? '').length > 0, null, {timeout: 10000});
		// The empty state is also a tbody tr (td colspan=8); real bill rows
		// carry a th[scope=row] index cell, so wait for one of those.
		await page.waitForSelector('app-info tbody th[scope="row"]');
		await page.waitForTimeout(500);
		await shot(page, '03-member-account-details.png');

		// Admin: product table, create, import, edit, batch delete, export, summary.
		await logout(page);
		await login(page, CONFIG.admin);
		await page.locator('a[href="/admin"]').click();
		await page.waitForSelector('app-admin tbody tr th');
		await waitForImages(page);
		await page.mouse.move(800, 450); // drop the navbar tooltip before shooting
		await page.waitForTimeout(300);
		await shot(page, '04-admin-products.png');

		// Toolbar order in admin.component.html: create, import, export.
		await page.locator('.btn-create').nth(0).click();
		await page.waitForSelector('.modal.show #inputName');
		await shot(page, '06-admin-create-product.png');
		await closeModal(page);

		await page.locator('.btn-create').nth(1).click();
		await page.waitForSelector('.modal.show #inputGroupFile');
		await shot(page, '07-admin-import-excel.png');
		await closeModal(page);

		await page.locator('app-admin tbody .btn-edit').first().click();
		await page.waitForFunction(() => (document.querySelector('.modal.show #inputNameE')?.value ?? '').trim().length > 0, null, {timeout: 5000});
		await shot(page, '09-admin-edit-product.png');
		await closeModal(page);

		// The first row click right after a modal close can race the app's
		// re-render and get dropped, so verify the selection and top up missing rows.
		const rows = page.locator('app-admin tbody tr');
		for (let attempt = 0; attempt < 3; attempt++) {
			for (const index of [0, 1, 2]) {
				const selected = await rows.nth(index).evaluate(tr => tr.classList.contains('row-selected'));
				if (!selected) {
					await rows.nth(index).locator('th').click();
					await page.waitForTimeout(300);
				}
			}
			const count = await page.locator('app-admin tbody tr.row-selected').count();
			console.log(`[select] attempt ${attempt}: ${count}/3 selected`);
			if (count === 3) {
				break;
			}
		}
		await page.waitForFunction(() => document.querySelectorAll('app-admin tbody tr.row-selected').length === 3, null, {timeout: 5000});
		// A normal click on the delete button bubbles to the row and deselects it,
		// so open the modal with a non-bubbling event on the button itself.
		await page.evaluate(() => document.querySelector('app-admin tbody .btn-warning')
			.dispatchEvent(new MouseEvent('click', {bubbles: false})));
		await page.waitForSelector('.modal.show .wrapper-delete-table');
		// saleAmount is null in the seed data, so count rows with content, not cells.
		await page.waitForFunction(() => Array.from(document.querySelectorAll('.modal.show .wrapper-delete-table tbody tr'))
			.filter(tr => (tr.textContent ?? '').trim().length > 20).length >= 3, null, {timeout: 5000});
		await shot(page, '10-admin-batch-delete.png');
		await closeModal(page);

		await page.locator('.btn-create').nth(2).hover();
		await page.waitForSelector('.tooltip.show', {timeout: 5000});
		await shot(page, '08-admin-export-excel.png');

		await page.locator('a[href="/summary"]').click();
		// The empty-state row is also a tbody tr, so wait for real bill rows.
		await page.waitForFunction(() => document.querySelectorAll('app-summary tbody tr').length >= 2, null, {timeout: 10000});
		await page.mouse.move(800, 450);
		await page.waitForTimeout(500);
		await shot(page, '05-admin-transaction-summary.png');

		await context.close();
	} catch (error) {
		// Fresh clones have no playground/ yet; without the mkdir the failure
		// screenshot rejects with ENOENT and the catch swallows its own artifact.
		await mkdir(path.join(REPO_ROOT, 'playground'), {recursive: true});
		await page?.screenshot({path: path.join(REPO_ROOT, 'playground', 'failure.png'), fullPage: true}).catch(() => {});
		throw error;
	} finally {
		await browser?.close();
		await stopServer(server);
	}
}

await main();
