import pw from '../scripts/screenshots/node_modules/playwright-core/index.js';
const {chromium} = pw;

const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1600, height: 900}, locale: 'en'});
const page = await context.newPage();
await page.goto('http://localhost:8080/');
await page.waitForSelector('app-store .card');
await page.locator('[data-test="store-card-image"]').first().click();
await page.waitForSelector('.modal.show [data-test="modal-image"]', {state: 'attached'});
await page.waitForTimeout(800);
const diag = await page.evaluate(() => {
	const dialog = document.querySelector('.modal.show .modal-dialog');
	const content = dialog.querySelector('.modal-content');
	const body = dialog.querySelector('.modal-body');
	const wrap = dialog.querySelector('.modal-image-wrap');
	const img = dialog.querySelector('[data-test="modal-image"]');
	const cs = el => {
		const s = getComputedStyle(el);
		return {
			display: s.display,
			flexDirection: s.flexDirection,
			height: s.height,
			minHeight: s.minHeight,
			flex: `${s.flexGrow} ${s.flexShrink} ${s.flexBasis}`,
			position: s.position
		};
	};
	const classes = el => el.className;
	const rect = el => {
		const r = el.getBoundingClientRect();
		return `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} h=${Math.round(r.height)}`;
	};
	const dialogAncestors = [];
	let node = dialog.parentElement;
	for (let i = 0; i < 3 && node; i++) {
		dialogAncestors.push(`${node.tagName}.${classes(node)} ${rect(node)} ${JSON.stringify(cs(node))}`);
		node = node.parentElement;
	}
	const chain = [];
	node = body;
	for (let i = 0; i < 4 && node && node !== dialog; i++) {
		chain.push(`${node.tagName}.${classes(node)} ${rect(node)} ${JSON.stringify(cs(node))}`);
		node = node.parentElement;
	}
	return {
		bodyToDialogChain: chain,
		dialog: `${classes(dialog)} ${rect(dialog)} ${JSON.stringify(cs(dialog))}`,
		content: `${classes(content)} ${rect(content)} ${JSON.stringify(cs(content))}`,
		body: `${classes(body)} ${rect(body)} ${JSON.stringify(cs(body))}`,
		wrap: `${classes(wrap)} ${rect(wrap)} ${JSON.stringify(cs(wrap))}`,
		img: `${classes(img)} ${rect(img)} ${JSON.stringify(cs(img))}`,
		dialogAncestors,
		ruleHit: Array.from(document.styleSheets)
			.flatMap(sheet => {
				try {
					return Array.from(sheet.cssRules);
				} catch {
					return [];
				}
			})
			.filter(rule => rule.cssText?.includes('product-modal-fit'))
			.map(rule => rule.cssText)
	};
});
console.log(JSON.stringify(diag, null, 2));
await browser.close();
