// Stichle QA: two people in separate WebKit contexts and a bot, a few rounds played through the
// page like a person would (bid with the dial, tap a card twice), screenshots at each new phase,
// overflow and console checks, a reload mid-trick (the same hand must come back), and the host
// ending the game. Not part of CI: Playwright isn't a dependency here; it's borrowed from Folio's
// checkout next door (the workspace's `folio/node_modules`, WebKit already installed).
//
//   npm run build && node server/server.mjs --port 6311     (or the stichle-prod preview)
//   node tools/qa.mjs [base] [outdir]          ROUNDS=3 W=390 H=844 by default
import { webkit } from '../../folio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:6311';
const OUT = process.argv[3] ?? '/tmp/stichle-qa/';
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844);
mkdirSync(OUT, { recursive: true });

const problems = [];
const say = (...a) => console.log(...a);

const browser = await webkit.launch();
async function person(name) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('ewo:lang', 'de');
    } catch {}
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name} console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name} pageerror: ${e.message}`));
  return { name, context, page };
}

async function api(page, path, body, token) {
  return page.evaluate(
    async ([path, body, token]) => {
      const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-stichle-token': token } : {}) }, body: JSON.stringify(body ?? {}) });
      return r.status === 204 ? null : r.json();
    },
    [path, body, token],
  );
}

async function overflow(p, label) {
  const wide = await p.page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > w + 1 && !el.closest('.hand, .trick, svg');
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → ${Math.round(el.getBoundingClientRect().right)}`);
  });
  if (wide.length) problems.push(`${p.name} overflow at ${label}: ${wide.join(', ')}`);
}

let shot = 0;
async function snap(p, label) {
  await p.page.waitForTimeout(450);
  await p.page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${p.name}-${label}.png` });
  await overflow(p, label);
}

// ---- the table ----
const host = await person('host');
const guest = await person('guest');
await host.page.goto(BASE);
await guest.page.goto(BASE);
const seat = await api(host.page, '/api/rooms', { name: 'Anna', avatar: [1, 2, 3] });
const gseat = await api(guest.page, `/api/rooms/${seat.code}/join`, { name: 'Ben', avatar: [4, 5, 6] });
for (const [p, s] of [[host, seat], [guest, gseat]]) {
  await p.page.evaluate(([code, s]) => localStorage.setItem(`stichle:seat:${code}`, JSON.stringify({ ...s, at: Date.now() })), [seat.code, s]);
  await p.page.goto(`${BASE}/${seat.code}`, { waitUntil: 'load' });
}
await host.page.waitForSelector('.lobby');
await api(host.page, `/api/rooms/${seat.code}/bot`, { add: true }, seat.token);
await snap(host, 'lobby');
await snap(guest, 'lobby');
await host.page.getByRole('button', { name: 'Karten geben' }).click();
await host.page.waitForSelector('.table');
say('dealt', seat.code);

// ---- playing like a person ----
const seen = { host: new Set(), guest: new Set() };
async function phaseOf(p) {
  return p.page.evaluate(() => {
    if (document.querySelector('.final')) return 'final';
    if (document.querySelector('.result')) return 'scored';
    if (document.querySelector('[data-pending]')) return 'wait';
    if (document.querySelector('.panel.bid')) return 'bid';
    if (document.querySelector('.suitbtn')) return 'trump';
    const status = document.querySelector('.status.mine');
    if (status) return 'play';
    return 'wait';
  });
}
async function round(p) {
  return p.page.evaluate(() => document.querySelector('.round .display')?.textContent ?? '');
}

async function act(p) {
  const phase = await phaseOf(p);
  const key = `${phase}:${await round(p)}`;
  if (!seen[p.name].has(key) && phase !== 'wait') {
    seen[p.name].add(key);
    await snap(p, key.replace(/[/:]/g, '-'));
  }
  if (phase === 'bid') {
    // One up with the dial when the round allows, then send.
    const plus = p.page.getByRole('button', { name: 'Einen mehr' });
    if (await plus.isEnabled({ timeout: 1500 }).catch(() => false)) await plus.click({ timeout: 1500 });
    try {
      await p.page.getByRole('button', { name: /ansagen$/ }).click({ timeout: 3000 });
    } catch (e) {
      await p.page.screenshot({ path: `${OUT}fail-${p.name}-${Date.now()}.png` });
      const info = await p.page.evaluate(() => ({ panel: Boolean(document.querySelector('.panel.bid')), buttons: [...document.querySelectorAll('.panel.bid button')].map((b) => b.textContent.trim() + (b.disabled ? ' (disabled)' : '') + (b.getAttribute('aria-label') ? ` [${b.getAttribute('aria-label')}]` : '')), status: document.querySelector('.status, .toast')?.textContent }));
      problems.push(`${p.name} bid: ${JSON.stringify(info)}`);
      return false;
    }
    return true;
  }
  if (phase === 'trump') {
    await p.page.locator('.suitbtn').first().click();
    return true;
  }
  if (phase === 'scored') {
    const next = p.page.getByRole('button', { name: /Weiter zu Runde/ });
    if (await next.isEnabled().catch(() => false)) {
      await next.click();
      return true;
    }
    return false;
  }
  if (phase === 'play') {
    const box = await p.page.evaluate(() => {
      const slots = [...document.querySelectorAll('.hand .slot')];
      const legal = slots.filter((s) => !s.classList.contains('dim'));
      const el = legal[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + 12, y: r.top + 22 };
    });
    if (!box) return false;
    await p.page.mouse.click(box.x, box.y);
    await p.page.waitForTimeout(120);
    await p.page.mouse.click(box.x, box.y - 24);
    return true;
  }
  return false;
}

let reloaded = false;
for (let i = 0; i < 2000; i++) {
  const r = Number((await round(host)).split('/')[0]) || 0;
  if (r > ROUNDS || (await phaseOf(host)) === 'final') break;
  let moved = false;
  for (const p of [host, guest]) moved = (await act(p).catch((e) => (problems.push(`${p.name} act: ${e.message}`), false))) || moved;
  // Once, in round 2 with cards on the table: the guest reloads mid-trick and must get the same hand back.
  if (!reloaded && r === 2) {
    await guest.page.waitForTimeout(900);
    const hand = () => guest.page.evaluate(() => [...document.querySelectorAll('.hand .slot:not(.air)')].map((s) => s.getAttribute('aria-label')).join(' | '));
    const before = await hand();
    const onTable = await guest.page.evaluate(() => document.querySelectorAll('.trick .played').length);
    if (onTable > 0 && before && !(await guest.page.evaluate(() => document.querySelector('.status.mine')))) {
      reloaded = true;
      await guest.page.reload({ waitUntil: 'load' });
      await guest.page.waitForSelector('.hand .slot', { timeout: 10000 });
      await guest.page.waitForTimeout(600);
      const after = await hand();
      say('reload mid-trick: hand', before, '→', after);
      if (after !== before) problems.push(`reload changed the hand: ${before} → ${after}`);
      await snap(guest, 'after-reload');
    }
  }
  if (!moved) await host.page.waitForTimeout(400);
}

// ---- the host ends it ----
await host.page.locator('ewo-settings-button').click();
await host.page.getByRole('button', { name: 'Partie beenden' }).click();
await host.page.getByRole('button', { name: 'Ja, beenden' }).click();
await host.page.waitForSelector('.final', { timeout: 10000 });
await guest.page.waitForSelector('.final', { timeout: 10000 });
await snap(host, 'final');
await snap(guest, 'final');

say(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no problems');
await browser.close();
