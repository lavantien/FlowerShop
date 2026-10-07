// Captures the README screenshot set from the live app served by the packaged jar.
// Run through `make screenshots`, which provides db-up, JAVA_BIN, and the MySQL env.
// The walk mirrors a real v3 session: guest browse with server paging, register,
// cart checkout with coupon, payment gateway confirm, order history with a member
// cancel, wishlist, then the full admin back office and a 404.
import {spawn} from 'node:child_process';
import {readdir, mkdir} from 'node:fs/promises';
import {existsSync, statSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STAMP = Date.now().toString(36);
const CONFIG = {
	baseUrl: process.env.FLOWERSHOP_BASE_URL ?? 'http://localhost:8080',
	outDir: path.join(REPO_ROOT, 'project-pictures'),
	viewport: {width: 1600, height: 900},
	locale: 'en',
	// a fresh member per run proves the register flow and dodges duplicate-email 409s
	member: {
		name: 'Capture Member',
		email: `capture-${STAMP}@flowershop.example`,
		password: 'capture-pass-123',
		answer: 'capture',
		phone: '0900000123',
		address: '05 Capture Lane',
		city: 'Hồ Chí Minh',
		district: 'Bình Thạnh'
	},
	admin: {email: 'admin@flowershop.example', password: '1234qwer'},
	couponCode: 'WELCOME10',
	newCoupon: {code: `CAPTURE${STAMP}`, kind: 'PERCENT', value: 15},
	stockQuantity: 42,
	taxonomyName: `Capture${STAMP}`,
	junkRoute: 'no-such-capture-route',
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

// Money mirrors of the jar's own math (GeoService, Coupon, ShopProperties),
// parameterized from the committed config and seeds so the expected numbers
// cannot drift from the source of truth.

function readDeliveryConfig() {
	const block = readFileSync(path.join(REPO_ROOT, 'src/main/resources/application.yml'), 'utf8')
		.split('delivery:')[1].split('payment:')[0];
	const value = key => Number(block.match(new RegExp(`${key}:\\s*(\\d+)`))[1]);
	return {baseFee: value('base-fee'), perKm: value('per-km'), maxFee: value('max-fee'), roundTo: value('round-to')};
}

function readDistrictPoint(district) {
	const hit = JSON.parse(readFileSync(path.join(REPO_ROOT, 'src/main/resources/geo/vn-geo.json'), 'utf8'))
		.districts.find(entry => entry.name === district);
	if (!hit) {
		throw new Error(`district ${district} is missing from vn-geo.json`);
	}
	return hit;
}

function readSeedCoupon(code) {
	const line = readFileSync(path.join(REPO_ROOT, 'db/run.sql'), 'utf8')
		.split('\n').find(row => row.includes(`'${code}',`));
	const hit = line?.match(/^\s*\(\d+,\s*'[^']+',\s*'([A-Z]+)',\s*(\d+),\s*(true|false)/);
	if (!hit) {
		throw new Error(`seed coupon ${code} not found in db/run.sql`);
	}
	return {kind: hit[1], value: Number(hit[2])};
}

// Mean earth radius, IUGG R1, with GeoService's ceil to the next tenth of a km.
const EARTH_RADIUS_KM = 6371.0088;

function distanceKm(from, to) {
	const radians = degrees => degrees * Math.PI / 180;
	const sinLat = Math.sin(radians(to.lat - from.lat) / 2);
	const sinLng = Math.sin(radians(to.lng - from.lng) / 2);
	const a = sinLat * sinLat
		+ Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * sinLng * sinLng;
	return Math.ceil(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a))) * 10) / 10;
}

function expectedDeliveryFee(delivery, distance) {
	const raw = Math.min(delivery.baseFee + delivery.perKm * distance, delivery.maxFee);
	// HALF_UP onto the round-to step, like ShopProperties.Delivery.round.
	return Math.round(raw / delivery.roundTo) * delivery.roundTo;
}

// The fee depends only on the distance, so the nearest eligible branch decides
// it regardless of GeoService's lowest-id tie-break among equals.
function nearestBranchDistance(branches, target) {
	return Math.min(...branches
		.filter(branch => branch.active && branch.lat !== null && branch.lng !== null)
		.map(branch => distanceKm({lat: branch.lat, lng: branch.lng}, target)));
}

// Coupon.discountOn (percent kinds ceil, both clamp to the subtotal) followed
// by the checkout's round-then-min clamp.
function expectedDiscount(delivery, subtotal, coupon) {
	const raw = coupon.kind === 'PERCENT'
		? Math.ceil(subtotal * coupon.value / 100)
		: coupon.value;
	return Math.min(Math.round(Math.min(raw, subtotal) / delivery.roundTo) * delivery.roundTo, subtotal);
}

function assertMoney(name, expected, actual) {
	if (expected !== actual) {
		throw new Error(`money mismatch on ${name}: expected ${expected}, got ${actual}`);
	}
}

function assertOrderMoney(label, order, expected) {
	for (const field of ['subtotal', 'deliveryFee', 'discountAmount', 'total']) {
		if (!Number.isInteger(order[field])) {
			throw new Error(`${label}: ${field} is not whole-dong VND: ${order[field]}`);
		}
		assertMoney(`${label} ${field}`, expected[field], order[field]);
	}
	assertMoney(`${label} subtotal vs the line totals`,
		order.items.reduce((sum, item) => sum + item.lineTotal, 0), order.subtotal);
	for (const item of order.items) {
		assertMoney(`${label} lineTotal on ${item.productName}`, item.unitPrice * item.quantity, item.lineTotal);
	}
	assertMoney(`${label} total identity`,
		order.subtotal - order.discountAmount + order.deliveryFee, order.total);
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
			await fetchJson(`${CONFIG.baseUrl}/api/product?page=0&size=1`);
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

// The seeds must already live in MySQL (make db-reset); the walker never
// POSTs db/product.json anymore, it boots against the seeded database.
async function verifySeeded() {
	const firstPage = await fetchJson(`${CONFIG.baseUrl}/api/product?page=0&size=1`);
	if (!Array.isArray(firstPage.content) || firstPage.content.length === 0 || firstPage.totalElements < 13) {
		throw new Error('product table is empty or too small for the paging walk; run make db-reset first');
	}
	const branches = await fetchJson(`${CONFIG.baseUrl}/api/branch`);
	if (!Array.isArray(branches) || branches.length === 0) {
		throw new Error('branch table is empty; run make db-reset first');
	}
	return firstPage.totalElements;
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

// Toasts sit fixed in the top right corner for 4 s and would cover the shots.
async function settleToasts(page) {
	try {
		await page.waitForFunction(() => document.querySelectorAll('app-toasts .toast').length === 0, null, {timeout: 6000});
	} catch {
		console.log('[warn] toasts still visible after timeout');
	}
}

async function shot(page, name, fullPage = false) {
	await settleToasts(page);
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

// ngx-bootstrap fades opacity over 150 ms and the dialog transform over 300 ms,
// so `.modal.show` alone fires mid-fade and the shot captures a half-transparent
// modal. Settled means opacity 1 and both opacity and transform unchanged across
// two consecutive animation frames.
async function waitForModalSettled(page) {
	await page.waitForFunction(() => {
		const modal = document.querySelector('.modal.show');
		if (!modal) {
			return false;
		}
		const dialog = modal.querySelector('.modal-dialog');
		const snapshot = `${getComputedStyle(modal).opacity}|${dialog ? getComputedStyle(dialog).transform : ''}`;
		const settled = window.__modalSnapshot === snapshot && getComputedStyle(modal).opacity === '1';
		window.__modalSnapshot = snapshot;
		return settled;
	}, null, {timeout: 5000});
}

async function closeModal(page) {
	// Pin the count before clicking: a locator re-query for detachment could match
	// a modal queued behind this one, while the count dropping proves this one died.
	const openCount = await page.locator('.modal.show').count();
	const close = page.locator('.modal.show .btn-close');
	if (await close.count() > 0) {
		await close.first().click();
	} else {
		// the store product modal has no header, ngx-bootstrap closes on Escape
		await page.keyboard.press('Escape');
	}
	await page.waitForFunction(count => document.querySelectorAll('.modal.show').length < count, openCount, {timeout: 5000});
	// ngx-bootstrap queues a new modal behind the previous fade-out, so the next
	// open must find a clean stage.
	await page.waitForFunction(() => document.querySelectorAll('.modal.show').length === 0, null, {timeout: 5000});
}

// The auth modal is a plain always-rendered div pair, not an ngx-bootstrap
// dialog, so it never carries .show and needs its own waits.
async function openAuthModal(page) {
	await page.locator('.responsive-float button:not([data-test="nav-cart"])').click();
	await page.waitForSelector('app-auth-modal .modal #inputEmail');
}

async function login(page, {email, password}) {
	await openAuthModal(page);
	await page.fill('app-auth-modal #inputEmail', email);
	await page.fill('app-auth-modal #inputPassword', password);
	await page.locator('app-auth-modal .modal-footer .btn-success').click();
	await page.waitForSelector('app-auth-modal .modal', {state: 'detached', timeout: 10_000});
	// The app writes the token before the zoneless navbar re-renders, so gate
	// on the DOM, not on localStorage, before any button-index click.
	await page.waitForSelector('.responsive-float svg.fa-right-from-bracket', {timeout: 10_000});
}

async function register(page, member) {
	await openAuthModal(page);
	await page.locator('app-auth-modal .modal-footer .btn-primary').click(); // switch to the sign up form
	await page.waitForSelector('app-auth-modal #inputNameS');
	await page.fill('app-auth-modal #inputNameS', member.name);
	await page.fill('app-auth-modal #inputEmailS', member.email);
	await page.fill('app-auth-modal #inputReEmailS', member.email);
	await page.fill('app-auth-modal #inputPasswordS', member.password);
	await page.fill('app-auth-modal #inputRePasswordS', member.password);
	await page.fill('app-auth-modal #inputAnswerS', member.answer);
	await page.fill('app-auth-modal #inputReAnswerS', member.answer);
	await page.fill('app-auth-modal #inputPhoneS', member.phone);
	await page.fill('app-auth-modal #inputAddressS', member.address);
	await page.locator('app-auth-modal .modal-footer .btn-success').click();
	await page.waitForSelector('app-auth-modal .modal', {state: 'detached', timeout: 10_000});
	// register auto-logs in on success, the navbar flips to logout right after
	await page.waitForSelector('.responsive-float svg.fa-right-from-bracket', {timeout: 10_000});
}

async function logout(page) {
	await page.locator('.responsive-float button:not([data-test="nav-cart"])').click();
	await page.waitForSelector('.responsive-float svg.fa-right-to-bracket', {timeout: 10_000});
}

async function waitForCartBadge(page, expected) {
	await page.waitForFunction(value => {
		const match = (document.querySelector('[data-test="nav-cart"]')?.textContent ?? '').match(/\((\d+)\)/);
		return match !== null && Number(match[1]) === value;
	}, expected, {timeout: 5000});
}

async function fillCheckoutForm(page) {
	await page.fill('[data-test="cart-phone"]', CONFIG.member.phone);
	await page.fill('[data-test="cart-address"]', CONFIG.member.address);
	await page.selectOption('[data-test="cart-city"]', CONFIG.member.city);
	await page.selectOption('[data-test="cart-district"]', CONFIG.member.district);
}

async function main() {
	await mkdir(CONFIG.outDir, {recursive: true});
	const server = await startServer();
	const totalProducts = await verifySeeded();
	console.log(`[seed] ${totalProducts} products, database is ready`);
	const delivery = readDeliveryConfig();
	const districtPoint = readDistrictPoint(CONFIG.member.district);
	const branches = await fetchJson(`${CONFIG.baseUrl}/api/branch`);
	const fee = expectedDeliveryFee(delivery, nearestBranchDistance(branches, districtPoint));
	const coupon = readSeedCoupon(CONFIG.couponCode);
	// The walk's two carts, priced from the same catalog page the store grid
	// renders (sorted name-asc, page 1): card 0 twice plus card 2 once for the
	// couponed checkout, card 0 once for the cancel-path checkout.
	const catalog = await fetchJson(`${CONFIG.baseUrl}/api/product?page=0&size=12&sort=name-asc`);
	const priceOf = index => catalog.content[index].price;
	const expectedMoney = (lines, appliedCoupon) => {
		const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
		const discountAmount = appliedCoupon ? expectedDiscount(delivery, subtotal, appliedCoupon) : 0;
		return {subtotal, discountAmount, deliveryFee: fee, total: subtotal - discountAmount + fee};
	};
	const couponedMoney = expectedMoney([{price: priceOf(0), quantity: 2}, {price: priceOf(2), quantity: 1}], coupon);
	const plainMoney = expectedMoney([{price: priceOf(0), quantity: 1}], null);
	console.log(`[money] ${CONFIG.member.district} expects fee ${fee}, ${CONFIG.couponCode} is ${coupon.kind} ${coupon.value},`
		+ ` couponed cart ${couponedMoney.subtotal} -> ${couponedMoney.total}, plain cart ${plainMoney.subtotal} -> ${plainMoney.total}`);
	let browser;
	let page;
	try {
		browser = await launchBrowser();
		const context = await browser.newContext({viewport: CONFIG.viewport, locale: CONFIG.locale});
		page = await context.newPage();
		page.on('console', message => {
			if (message.type() === 'error' || message.type() === 'warning') {
				console.log(`[console.${message.type()}] ${message.text()}`);
			}
		});
		page.on('requestfailed', request => console.log(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText}`));
		// Money trail: the JSON behind the pay view and the order history. The
		// checkout response itself is unreadable here: the cart redirects to
		// the gateway with document.location.assign, and Chromium discards the
		// previous document's network resources, so the walked order is instead
		// predicted from the catalog prices and asserted on the surfaces whose
		// bodies survive.
		const trail = {payments: [], history: []};
		page.on('response', async response => {
			if (response.status() >= 400) {
				console.log(`[http ${response.status()}] ${response.request().method()} ${response.url()}`);
			}
			const method = response.request().method();
			const url = response.url();
			try {
				if (method === 'GET' && response.status() === 200 && url.includes('/api/order/me')) {
					trail.history.push(await response.json());
				} else if (method === 'GET' && response.status() === 200 && url.includes('/api/payment/')) {
					trail.payments.push(await response.json());
				}
			} catch {
				// non-JSON bodies never join the money trail
			}
		});

		// Guest: shop grid with server paging, product modal, cart lines.
		await page.goto(`${CONFIG.baseUrl}/`);
		await page.waitForSelector('app-store .card');
		await waitForImages(page);
		// Viewport framing like the 2019 set; fullPage would stretch the grid
		// across three screens for no extra information.
		await shot(page, '01-shop-page.png');

		const pageSize = 12;
		const pageTwoRange = `${pageSize + 1}-${Math.min(pageSize * 2, totalProducts)} / ${totalProducts}`;
		const pageOneRange = `1-${pageSize} / ${totalProducts}`;
		await page.locator('.store-pagination .page-item', {hasText: /^\s*2\s*$/}).click();
		await page.waitForFunction(expected => document.querySelector('[data-test="store-range"]')?.textContent?.trim() === expected,
			pageTwoRange, {timeout: 10_000});
		await page.locator('.store-pagination .page-item', {hasText: /^\s*1\s*$/}).click();
		await page.waitForFunction(expected => document.querySelector('[data-test="store-range"]')?.textContent?.trim() === expected,
			pageOneRange, {timeout: 10_000});

		await page.locator('[data-test="store-card-image"]').first().click();
		await page.waitForSelector('.modal.show [data-test="modal-image"]');
		await waitForImages(page);
		await waitForModalSettled(page);
		await shot(page, '11-product-details.png');
		await page.locator('[data-test="modal-qty-plus"]').click();
		await page.waitForFunction(() => document.querySelector('[data-test="modal-qty"]')?.textContent?.trim() === '2',
			null, {timeout: 5000});
		await page.locator('[data-test="modal-add"]').click();
		await page.waitForSelector('.modal.show', {state: 'detached', timeout: 5000});
		await waitForCartBadge(page, 2);
		await page.locator('[data-test="store-add"]').nth(2).click();
		await waitForCartBadge(page, 3);

		// Member: register a fresh account, wishlist one product from the grid.
		await register(page, CONFIG.member);
		await page.locator('[data-test="store-heart"]').nth(1).click();
		await page.waitForFunction(() => document.querySelectorAll('[data-test="store-heart"]')[1]
			?.classList.contains('text-danger') === true, null, {timeout: 10_000});

		// First checkout pays through the gateway and leaves one PAID order.
		await page.locator('[data-test="nav-cart"]').click();
		await page.waitForSelector('[data-test="cart-checkout"]');
		await fillCheckoutForm(page);
		await shot(page, '02-shopping-cart.png');
		await page.fill('[data-test="cart-coupon"]', CONFIG.couponCode);
		await page.locator('[data-test="cart-coupon-apply"]').click();
		await page.waitForSelector('[data-test="cart-coupon-preview"]');
		await shot(page, '12-checkout-coupon.png');
		await page.locator('[data-test="cart-checkout"]').click();
		await page.waitForURL(/\/pay\//, {timeout: 20_000});
		await page.waitForSelector('[data-test="pay-amount"]');
		await page.waitForFunction(() => (document.querySelector('[data-test="pay-status"]')?.textContent ?? '').includes('PENDING'),
			null, {timeout: 10_000});
		await shot(page, '13-pay-gateway.png');
		assertMoney('couponed pay view amount', couponedMoney.total, trail.payments.at(-1).amount);
		const couponedPayment = trail.payments.at(-1);
		await page.locator('[data-test="pay-confirm"]').click();
		await page.waitForURL(/\/info/, {timeout: 15_000});
		await page.waitForSelector('[data-test="order-card"]');
		await shot(page, '14-info-order-history.png');

		// Second checkout stays PENDING so the member cancel has a live target.
		await page.locator('a[href="/shop"]').click();
		await page.waitForSelector('[data-test="store-range"]');
		await page.locator('[data-test="store-add"]').first().click();
		await waitForCartBadge(page, 1);
		await page.locator('[data-test="nav-cart"]').click();
		await page.waitForSelector('[data-test="cart-checkout"]');
		await fillCheckoutForm(page);
		await page.locator('[data-test="cart-checkout"]').click();
		await page.waitForURL(/\/pay\//, {timeout: 20_000});
		await page.waitForSelector('[data-test="pay-amount"]');
		await page.waitForFunction(() => (document.querySelector('[data-test="pay-status"]')?.textContent ?? '').includes('PENDING'),
			null, {timeout: 10_000});
		assertMoney('plain pay view amount', plainMoney.total, trail.payments.at(-1).amount);
		await page.locator('a[href="/info"]').click();
		await page.waitForFunction(() => document.querySelectorAll('[data-test="order-card"]').length === 2,
			null, {timeout: 10_000});
		// The history view must carry exactly the predicted money: the couponed
		// order is the one that used the coupon, the plain one is not.
		const history = trail.history.at(-1).content;
		if (history.length !== 2) {
			throw new Error(`history view answered ${history.length} orders, expected the 2 walked`);
		}
		const couponedOrder = history.find(order => order.couponCode === CONFIG.couponCode);
		const plainOrder = history.find(order => order.couponCode == null);
		if (!couponedOrder || !plainOrder) {
			throw new Error('history view is missing one of the two walked orders');
		}
		assertOrderMoney('couponed history order', couponedOrder, couponedMoney);
		assertOrderMoney('plain history order', plainOrder, plainMoney);
		assertMoney('history total vs the pay view amount', couponedOrder.total, couponedPayment.amount);
		await page.locator('[data-test="order-cancel"]').first().click();
		await page.waitForFunction(() => document.querySelectorAll('[data-test="order-cancel"]').length === 0,
			null, {timeout: 10_000});

		await page.locator('[data-test="info-tab-wishlist"]').click();
		await page.waitForSelector('[data-test="wishlist-heart"]');
		await waitForImages(page);
		await shot(page, '15-info-wishlist.png');

		await page.locator('[data-test="info-tab-profile"]').click();
		await page.waitForFunction(() => (document.querySelector('[data-test="profile-name"]')?.value ?? '').length > 0,
			null, {timeout: 10_000});
		await shot(page, '03-member-account-details.png');

		// Admin: product table, create, import, edit, batch delete, export.
		await logout(page);
		await login(page, CONFIG.admin);
		await page.locator('a[href="/admin"]').click();
		await page.waitForSelector('.table-product tbody tr');
		await waitForImages(page);
		await page.mouse.move(800, 450); // drop the navbar tooltip before shooting
		await page.waitForTimeout(300);
		await shot(page, '04-admin-products.png');

		await page.locator('[data-test="admin-products-create"]').click();
		await page.waitForSelector('.modal.show [data-test="admin-product-name"]');
		await waitForModalSettled(page);
		await shot(page, '06-admin-create-product.png');
		await closeModal(page);

		await page.locator('[data-test="admin-products-import"]').click();
		await page.waitForSelector('.modal.show #inputGroupFile');
		await waitForModalSettled(page);
		await shot(page, '07-admin-import-excel.png');
		await closeModal(page);

		await page.locator('[data-test="admin-products-edit"]').first().click();
		await page.waitForFunction(() => (document.querySelector('.modal.show [data-test="admin-product-name"]')?.value ?? '')
			.trim().length > 0, null, {timeout: 5000});
		await waitForModalSettled(page);
		await shot(page, '09-admin-edit-product.png');
		await closeModal(page);

		const productRows = page.locator('.table-product tbody tr');
		await productRows.nth(0).locator('th').click();
		await productRows.nth(1).locator('th').click();
		await page.waitForFunction(() => document.querySelectorAll('[data-test="admin-products-delete"]').length === 2,
			null, {timeout: 5000});
		await page.locator('[data-test="admin-products-delete"]').first().click();
		await page.waitForSelector('.modal.show .wrapper-delete-table');
		await page.waitForFunction(() => document.querySelectorAll('.modal.show .wrapper-delete-table tbody tr').length >= 2,
			null, {timeout: 5000});
		await waitForModalSettled(page);
		await shot(page, '10-admin-batch-delete.png');
		await closeModal(page);

		await page.locator('[data-test="admin-products-export"]').hover();
		await page.waitForSelector('.tooltip.show', {timeout: 5000});
		await shot(page, '08-admin-export-excel.png');
		await page.mouse.move(800, 450);

		// Admin orders: the list replaces the old transaction summary, then the
		// capture member's PAID order ships.
		await page.locator('[data-test="admin-tab-orders"]').click();
		await page.waitForSelector('[data-test="admin-order-status"]');
		await shot(page, '05-admin-transaction-summary.png');
		await page.locator('[data-test="admin-orders-status"]').selectOption('PAID');
		await page.waitForFunction(() => {
			const badges = Array.from(document.querySelectorAll('[data-test="admin-order-status"]'));
			return badges.length > 0 && badges.every(badge => (badge.textContent ?? '').trim() === 'PAID');
		}, null, {timeout: 10_000});
		await page.locator('[data-test="admin-order-transition"]').first().click();
		await page.waitForFunction(() => (document.querySelector('[data-test="admin-order-status"]')?.textContent ?? '')
			.trim() === 'SHIPPED', null, {timeout: 10_000});

		// Coupons: create one, the table shows it next to the three seeds.
		await page.locator('[data-test="admin-tab-coupons"]').click();
		await page.waitForSelector('[data-test="admin-coupon-save"]');
		await page.fill('[data-test="admin-coupon-code"]', CONFIG.newCoupon.code);
		await page.locator('[data-test="admin-coupon-kind"]').selectOption(CONFIG.newCoupon.kind);
		await page.fill('[data-test="admin-coupon-value"]', String(CONFIG.newCoupon.value));
		await page.locator('[data-test="admin-coupon-save"]').click();
		await page.waitForFunction(code => Array.from(document.querySelectorAll('tbody tr'))
			.some(tr => (tr.textContent ?? '').includes(code)), CONFIG.newCoupon.code, {timeout: 10_000});
		await shot(page, '16-admin-coupons.png');

		// Branch stock editor: set an absolute quantity on the first branch.
		await page.locator('[data-test="admin-tab-branches"]').click();
		await page.waitForSelector('[data-test="admin-branch-stock"]');
		await page.locator('[data-test="admin-branch-stock"]').first().click();
		await page.waitForSelector('.modal.show .wrapper-stock-table');
		await page.waitForFunction(() => Array.from(document.querySelectorAll('.modal.show [data-test="admin-stock-quantity"]'))
			.some(input => Number(input.value) > 0), null, {timeout: 10_000});
		const stockRow = page.locator('.modal.show .wrapper-stock-table tbody tr').first();
		await stockRow.locator('[data-test="admin-stock-quantity"]').fill(String(CONFIG.stockQuantity));
		await stockRow.locator('[data-test="admin-stock-save"]').click();
		await page.waitForFunction(value => {
			const save = document.querySelector('.modal.show [data-test="admin-stock-save"]');
			const input = document.querySelector('.modal.show [data-test="admin-stock-quantity"]');
			return save !== null && !save.disabled && input?.value === value;
		}, String(CONFIG.stockQuantity), {timeout: 10_000});
		await waitForModalSettled(page);
		await shot(page, '17-admin-branch-stock.png');
		await closeModal(page);

		// Dashboard: tiles and CSS bars over the report aggregates.
		await page.locator('[data-test="admin-tab-dashboard"]').click();
		await page.waitForFunction(() => document.querySelectorAll('[data-test="admin-dashboard-tile"]').length === 3
			&& document.querySelectorAll('[data-test="admin-status-bar"]').length > 0, null, {timeout: 10_000});
		await shot(page, '18-admin-dashboard.png');

		// Users: disable the capture member instead of deleting (they own orders).
		await page.locator('[data-test="admin-tab-users"]').click();
		await page.waitForSelector('[data-test="admin-user-enable"]');
		const captureRow = page.locator('tbody tr', {hasText: CONFIG.member.email});
		await captureRow.locator('[data-test="admin-user-enable"]').click();
		await page.waitForFunction(email => Array.from(document.querySelectorAll('tbody tr'))
			.find(tr => (tr.textContent ?? '').includes(email))
			?.querySelector('[data-test="admin-user-enable"]')
			?.classList.contains('btn-secondary') === true, CONFIG.member.email, {timeout: 10_000});

		// Taxonomy: one new category row proves the create path.
		await page.locator('[data-test="admin-tab-taxonomy"]').click();
		await page.waitForSelector('[data-test="admin-category-name"]');
		await page.fill('[data-test="admin-category-name"]', CONFIG.taxonomyName);
		await page.locator('[data-test="admin-category-save"]').click();
		await page.waitForFunction(name => Array.from(document.querySelectorAll('tbody tr'))
			.some(tr => (tr.textContent ?? '').includes(`DATA.${name}`)), CONFIG.taxonomyName, {timeout: 10_000});

		// Wildcard route: the SPA 404 page on a junk deep link.
		await page.goto(`${CONFIG.baseUrl}/${CONFIG.junkRoute}`);
		await page.waitForSelector('h1.display-1');
		await shot(page, '19-not-found.png');

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
