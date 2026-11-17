#!/usr/bin/env node
/* Serves ./dist (optionally under a sub-path) and smoke-tests every page in a headless browser. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', process.env.OUT || 'dist');
const PREFIX = process.env.PREFIX || '';
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
	let p = decodeURIComponent(req.url.split('?')[0]);
	if (PREFIX && !p.startsWith(PREFIX)) { res.writeHead(404); return res.end('outside prefix'); }
	p = p.slice(PREFIX.length) || '/';
	let f = path.join(DIST, p);
	if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
	if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
	res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
	res.end(fs.readFileSync(f));
});
(async () => {
	await new Promise((r) => server.listen(0, r));
	const base = 'http://127.0.0.1:' + server.address().port + PREFIX + '/';
	const maps = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'maps.json'), 'utf8'));
	const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
	const problems = [];
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	let where = '';
	page.on('console', (m) => { if (m.type() === 'error' && !/does-not-exist/.test(where)) problems.push(where + ': console: ' + m.text()); });
	page.on('pageerror', (e) => problems.push(where + ': error: ' + e.message));
	page.on('requestfailed', (r) => problems.push(where + ': failed: ' + r.url()));
	page.on('response', (r) => { if (r.status() >= 400 && !/does-not-exist/.test(r.url())) problems.push(where + ': ' + r.status() + ' ' + r.url()); });
	const shot = async (name, full) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full }); };
	const go = async (p) => { where = p || '/'; await page.goto(base + p, { waitUntil: 'networkidle' }); };
	const expect = (ok, msg) => { if (!ok) problems.push(where + ': ' + msg); };

	await go('');
	expect(await page.locator('.map-card').count() === maps.length, 'home map cards');
	expect(await page.locator('.role-card').count() === 4, 'home role cards');
	await shot('home', true);
	// Every internal link on every top page resolves.
	const seen = new Set();
	for (const p of ['', 'maps/', 'ranked-loadouts/', 'warzone/', 'roles/', 'my-plans/', 'credits/']) {
		await go(p);
		for (const href of await page.$$eval('a[href]', (as) => as.map((a) => a.href))) if (href.startsWith(base)) seen.add(href.split('#')[0]);
		await shot(p.replace(/\//g, '') || 'index', true);
	}
	for (const href of seen) { const r = await ctx.request.get(href); if (r.status() !== 200) problems.push('broken link ' + href); }

	await go('ranked-loadouts/');
	const pro = await page.locator('[data-panel=pro] .lo-card').count();
	expect(pro > 0, 'pro cards');
	await page.click('[data-seg] [data-tab=meta]');
	expect(await page.locator('[data-panel=meta]').isVisible(), 'meta panel shows');
	await page.fill('[data-filter-search]', 'zzzz-nothing');
	expect(await page.locator('.lo-none').isVisible(), 'empty filter message');
	await page.fill('[data-filter-search]', '');
	await shot('loadouts-meta', true);

	await go('warzone/');
	await page.click('[data-seg] [data-tab=maps]');
	expect(await page.locator('.wz-map').first().isVisible(), 'warzone maps panel');
	await shot('warzone-maps', true);

	for (const m of maps) {
		await go('maps/' + m.slug + '/');
		expect(await page.locator('.mw4-planner.is-ready').count() === 1, 'planner ready');
		expect(await page.locator('.pl-title').innerText() === m.name, 'planner title');
		expect(await page.locator('.mk-hill').count() === ((m.hp && m.hp.hills) || []).length, 'hill markers');
		expect(await page.evaluate(() => { const i = document.getElementById('pl-img'); return !!i && i.naturalWidth > 0; }), 'map image loaded');
	}
	// Draw a route on the first map, check it persists and shows on My Plans.
	const m0 = maps[0];
	await go('maps/' + m0.slug + '/');
	await page.click('.pl-tabs [data-tab=plan]');
	await page.click('.pl-tools [data-tool=route]');
	const box = await page.locator('#pl-stage').boundingBox();
	await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
	await page.mouse.down();
	for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.3 + i * 0.03), box.y + box.height * (0.3 + i * 0.02));
	await page.mouse.up();
	await page.waitForTimeout(500);
	expect(await page.locator('.it-route').count() >= 1, 'route drawn');
	expect(await page.locator('[data-save]').count() === 0 && await page.locator('text=Sign in to save').count() === 0, 'no sign-in button');
	await shot('planner-plan');
	if (m0.snd && m0.snd.sites) { await page.click('[data-mode=snd]'); expect(await page.locator('.mk-site').count() === 2, 'snd sites'); await shot('planner-snd'); }
	await go('my-plans/');
	expect(await page.locator('.plan-row').count() === 1, 'plan listed on My Plans');
	const share = await page.locator('[data-copy]').first().getAttribute('data-copy');
	await shot('my-plans-with-plan');
	const ctx2 = await browser.newContext();
	const p2 = await ctx2.newPage();
	await p2.goto(share, { waitUntil: 'networkidle' });
	if (await p2.locator('.it-route').count() < 1) problems.push('share link did not load the plan');
	await ctx2.close();
	await go('this-page-does-not-exist/deeper/');
	expect(await page.locator('.notfound').count() === 1, '404 page');
	if (PREFIX || true) { const href = await page.locator('.notfound a').getAttribute('href'); const r = await ctx.request.get(new URL(href, base).href); if (r.status() !== 200) problems.push('404 home link broken: ' + href); }
	// Mobile layout
	const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const mp = await mob.newPage();
	await mp.goto(base, { waitUntil: 'networkidle' });
	await mp.click('.nav-toggle');
	if (!(await mp.locator('#mobile-nav').isVisible())) problems.push('mobile nav does not open');
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-home.png') });
	await mp.goto(base + 'maps/' + m0.slug + '/', { waitUntil: 'networkidle' });
	if (SHOTS) await mp.screenshot({ path: path.join(SHOTS, 'mobile-planner.png') });
	await browser.close(); server.close();
	console.log('Checked ' + (9 + maps.length) + ' pages and ' + seen.size + ' internal links at ' + (PREFIX || '/'));
	console.log(problems.length ? 'PROBLEMS (' + problems.length + '):\n  ' + [...new Set(problems)].join('\n  ') : 'All checks passed.');
	process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
