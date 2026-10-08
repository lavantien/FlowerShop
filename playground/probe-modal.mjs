import pw from '../scripts/screenshots/node_modules/playwright-core/index.js';
const {chromium} = pw;

const BASE = 'http://localhost:8080';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({viewport: {width: 1600, height: 900}, locale: 'en'});
const page = await context.newPage();
await page.goto(`${BASE}/`);
await page.waitForSelector('app-store .card');
await page.locator('[data-test="store-card-image"]').first().click();
await page.waitForSelector('.modal.show [data-test="modal-image"]');
await page.waitForFunction(() => {
	const modal = document.querySelector('.modal.show');
	const dialog = modal?.querySelector('.modal-dialog');
	if (!modal || !dialog) {
		return false;
	}
	const snap = `${getComputedStyle(modal).opacity}|${getComputedStyle(dialog).transform}`;
	const settled = window.__snap === snap && getComputedStyle(modal).opacity === '1';
	window.__snap = snap;
	return settled;
}, null, {timeout: 5000});
const geom = await page.evaluate(() => {
	const dialog = document.querySelector('.modal.show .modal-dialog');
	const body = dialog.querySelector('.modal-body');
	const img = dialog.querySelector('[data-test="modal-image"]');
	const add = dialog.querySelector('[data-test="modal-add"]');
	const footer = document.querySelector('[data-test="app-footer"]');
	const rect = el => {
		const r = el.getBoundingClientRect();
		return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width)};
	};
	const imgStyle = getComputedStyle(img);
	const bodyStyle = getComputedStyle(body);
	return {
		dialog: rect(dialog),
		body: rect(body),
		img: rect(img),
		add: rect(add),
		footer: footer ? rect(footer) : null,
		imgMaxHeight: imgStyle.maxHeight,
		bodyPadding: `${bodyStyle.paddingTop} ${bodyStyle.paddingBottom}`,
		natural: {w: img.naturalWidth, h: img.naturalHeight},
		contentWidth: Math.round(dialog.getBoundingClientRect().width
			- parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight))
	};
});
console.log(JSON.stringify(geom, null, 2));
const catalog = await (await fetch(`${BASE}/api/product?page=0&size=48&sort=name-asc`)).json();
const aspects = await page.evaluate(async urls => Promise.all(urls.map(async url => {
	const image = new Image();
	image.src = url;
	await image.decode().catch(() => {});
	return {url, w: image.naturalWidth, h: image.naturalHeight};
})), catalog.content.map(p => p.imgUrl));
const capPx = Math.round(0.62 * 900);
const rendered = aspects.map(a => {
	const h = a.w > 0 ? Math.min(capPx, geom.contentWidth * a.h / a.w) : 0;
	return {aspect: (a.h / Math.max(a.w, 1)).toFixed(3), renderedH: Math.round(h)};
}).sort((a, b) => b.renderedH - a.renderedH);
console.log(`cap 62vh = ${capPx}px, content width ${geom.contentWidth}px`);
console.log(`worst rendered image heights: ${JSON.stringify(rendered.slice(0, 5))}`);
const chrome = geom.dialog.height - geom.img.height;
console.log(`chrome ${chrome}px, worst-case box ${chrome + rendered[0].renderedH}px vs 900 viewport`);
await browser.close();
