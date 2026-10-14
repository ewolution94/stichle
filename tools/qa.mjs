// Stichle QA: two people in separate WebKit contexts and a bot, a few rounds played through the
// page like a person would (bid with the dial, tap a card twice), screenshots at each new phase,
// overflow and console checks, a reload mid-trick (the same hand must come back), and the host
// ending the game. Not part of CI: Playwright isn't a dependency here; it's borrowed from Folio's
// checkout next door (the workspace's `folio/node_modules`, WebKit already installed).
//
//   npm run build && node server/server.mjs --port 6311     (or the stichle-prod preview)
//   node tools/qa.mjs [base] [outdir]          ROUNDS=3 W=390 H=844 by default
//   CLOCK=quick (a clock per move), SLOWFONT=2000 (the display face arrives late), BIDDING=secret,
//   LENGTH=half|short, TEMPO=fast, FOREHEAD=1
import { webkit } from '../../folio/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:6311';
const OUT = process.argv[3] ?? '/tmp/stichle-qa/';
const ROUNDS = Number(process.env.ROUNDS ?? 3);
/** The house rule for bids: open, uneven or secret. */
const BIDDING = process.env.BIDDING ?? 'open';
/** The clock per move: off, relaxed or quick. */
const CLOCK = process.env.CLOCK ?? 'off';
/** The length (full, half, short) and the pace (normal, fast), R3. */
const LENGTH = process.env.LENGTH ?? 'full';
const TEMPO = process.env.TEMPO ?? 'normal';
/** FOREHEAD=1: the one-card round played blind (R3). */
const FOREHEAD = process.env.FOREHEAD === '1';
/** Hold the display face back this many ms, so the page starts in the fallback (a slow phone). */
const SLOWFONT = Number(process.env.SLOWFONT ?? 0);
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
      // The how-to opens on a first visit (Guide.svelte); these players have read it.
      localStorage.setItem('stichle:guide', '1');
    } catch {}
    // Every press, for the stall report: what it landed on, and whether that's inside the hand.
    window.__downs = [];
    document.addEventListener('pointerdown', (e) => {
      const t = e.target;
      window.__downs.push(`${Math.round(e.clientX)},${Math.round(e.clientY)} ${t?.tagName?.toLowerCase()}.${t?.classList ? [...t.classList].join('.') : ''} hand:${Boolean(t?.closest?.('.hand'))} slot:${t?.closest?.('.slot')?.getAttribute('aria-label') ?? '-'}`);
      if (window.__downs.length > 12) window.__downs.shift();
    }, true);
    // The stream, watched: what each page has heard, for the stall report below.
    window.__es = { opens: 0, views: 0, pings: 0, errors: 0, last: 0, lastView: '' };
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(url, init) {
        super(url, init);
        window.__es.opens++;
        this.addEventListener('view', (e) => {
          window.__es.views++;
          window.__es.last = Date.now();
          try {
            const v = JSON.parse(e.data);
            window.__es.lastView = v.game ? `no ${v.game.no} stage ${v.game.stage} turn ${v.game.turn} trick ${v.game.trick?.cards?.length}` : v.phase;
          } catch {}
        });
        this.addEventListener('ping', () => {
          window.__es.pings++;
          window.__es.last = Date.now();
        });
        this.addEventListener('error', () => window.__es.errors++);
      }
    };
    // The table never changes size or place while you play (the user, 2026-10-13: "it cannot jump"):
    // every frame, the cloth, the trick's area, your place card and your hand's box are measured, and
    // any move is written down with what the status line said.
    const watched = ['.table .cloth', '.table .middle', '.table .dock > div.mine', '.table .hand'];
    const last = new Map();
    window.__jumps = [];
    const look = () => {
      for (const sel of watched) {
        const el = document.querySelector(sel);
        if (!el) {
          last.delete(sel);
          continue;
        }
        const r = el.getBoundingClientRect();
        const now = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
        const was = last.get(sel);
        if (was && was !== now) window.__jumps.push(`${sel}: ${was} → ${now} (${document.querySelector('.status, .toast')?.textContent ?? (document.querySelector('.panel') ? 'panel' : '-')})`);
        last.set(sel, now);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  if (SLOWFONT) await context.route('**/stichle-display-*.woff2', async (route) => {
    await new Promise((r) => setTimeout(r, SLOWFONT));
    await route.continue();
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
/** The big screen, when SCREEN=WxH is set: a third page on /<code>/screen, shot beside the host. */
let screen = null;
async function snap(p, label) {
  if (screen && p === host) await snapOne(screen, label);
  await snapOne(p, label);
}
async function snapOne(p, label) {
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
if (process.env.SCREEN) {
  const [sw, sh] = process.env.SCREEN.split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: sw, height: sh } });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`screen console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`screen pageerror: ${e.message}`));
  await page.goto(`${BASE}/${seat.code}/screen`, { waitUntil: 'load' });
  await page.waitForSelector('.screen');
  screen = { name: 'screen', context, page };
}
await api(host.page, `/api/rooms/${seat.code}/bot`, { add: true }, seat.token);
await api(host.page, `/api/rooms/${seat.code}/settings`, { bidding: BIDDING, clock: CLOCK, length: LENGTH, tempo: TEMPO, forehead: FOREHEAD }, seat.token);
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
    // "Mustn't add up": the forbidden number can't be sent; one down (or up) instead.
    const send = p.page.locator('.panel.bid .btn.primary');
    if (await send.isDisabled({ timeout: 1500 }).catch(() => false)) {
      const less = p.page.getByRole('button', { name: 'Einen weniger' });
      if (await less.isEnabled({ timeout: 1000 }).catch(() => false)) await less.click();
      else await plus.click({ timeout: 1000 });
      if (!seen[p.name].has('forbidden')) {
        seen[p.name].add('forbidden');
        say(p.name, 'stepped past a forbidden bid');
      }
    }
    try {
      await send.click({ timeout: 3000 });
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
    // The second tap goes where the lifted card now is, as a person's would. A fixed 24 px up missed
    // a card tilted to the left and landed beside the hand, which drops the lift (2026-10-14).
    const lifted = await p.page.locator('.hand .slot.lifted').first().boundingBox().catch(() => null);
    if (lifted) await p.page.mouse.click(lifted.x + lifted.width / 2, lifted.y + lifted.height / 2);
    else await p.page.mouse.click(box.x, box.y - 24);
    return true;
  }
  return false;
}

let reloaded = false;
// A time limit, not a count of steps: during a trick's pause a refused tap is a step too, and at the
// fast tempo two thousand of them ran out in round 2 (2026-10-14).
const deadline = Date.now() + 30 * 60_000;
let stillKey = '';
let stillSince = Date.now();
for (;;) {
  if (Date.now() > deadline) {
    problems.push(`no end after 30 min, at round "${await round(host)}"`);
    break;
  }
  const label = await round(host);
  const r = Number(label.split('/')[0]) || 0;
  // A stall: nothing on either page changes for 45 s. Say what each page shows and has heard, then stop.
  const now = JSON.stringify(await Promise.all([host, guest].map((p) => p.page.evaluate(() => [document.querySelector('.status, .toast')?.textContent, document.querySelectorAll('.hand .slot').length, document.querySelectorAll('.trick .played').length, document.querySelector('.round .display')?.textContent]))));
  if (now !== stillKey) {
    stillKey = now;
    stillSince = Date.now();
  } else if (Date.now() - stillSince > 45_000) {
    for (const p of [host, guest]) {
      const d = await p.page.evaluate(() => ({
        status: document.querySelector('.status, .toast')?.textContent ?? '',
        pill: document.querySelector('ewo-connection')?.getAttribute('state') ?? '',
        pending: Boolean(document.querySelector('[data-pending]')),
        hand: document.querySelectorAll('.hand .slot').length,
        lifted: document.querySelectorAll('.hand .slot.lifted').length,
        dim: document.querySelectorAll('.hand .slot.dim').length,
        // A card still in the air keeps the hand's gestures off; aria-disabled says the page won't play.
        air: document.querySelectorAll('.hand .slot.air').length,
        disabled: document.querySelectorAll('.hand .slot[aria-disabled="true"]').length,
        trick: [...document.querySelectorAll('.trick .played')].map((el) => `${el.className.replace(/svelte-\S+/g, '').trim()} op ${getComputedStyle(el).opacity}`),
        // What a tap on the first card would hit.
        under: (() => {
          const el = document.querySelector('.hand .slot');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + 12, r.top + 22);
          return hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')} in ${hit.closest('.trick') ? 'trick' : hit.closest('.hand') ? 'hand' : 'elsewhere'}` : null;
        })(),
        slots: [...document.querySelectorAll('.hand .slot')].map((el) => `${el.getAttribute('aria-label')}${el.classList.contains('air') ? ' (air)' : ''} ${el.style.transform.slice(0, 40)}`),
        stream: { ...window.__es, since: Math.round((Date.now() - window.__es.last) / 1000) },
      }));
      problems.push(`${p.name} stalled 45 s: ${JSON.stringify(d)}`);
      // On the page whose move it is: tap the first card twice, then try the keyboard, and say what happened.
      if (d.status && (await p.page.locator('.status.mine').count())) {
        const box = await p.page.locator('.hand .slot').first().boundingBox();
        const state = () => p.page.evaluate(() => ({ lifted: document.querySelectorAll('.hand .slot.lifted').length, air: document.querySelectorAll('.hand .slot.air').length, hand: document.querySelectorAll('.hand .slot').length, toast: document.querySelector('.toast')?.textContent ?? '' }));
        await p.page.mouse.click(box.x + 12, box.y + 22);
        await p.page.waitForTimeout(250);
        const one = await state();
        await p.page.mouse.click(box.x + 12, box.y - 2);
        await p.page.waitForTimeout(900);
        const two = await state();
        await p.page.locator('.hand .slot').first().focus();
        await p.page.keyboard.press('Enter');
        await p.page.waitForTimeout(900);
        const key = await state();
        problems.push(`${p.name} taps at the stall: after one ${JSON.stringify(one)}, after two ${JSON.stringify(two)}, after Enter ${JSON.stringify(key)}`);
        problems.push(`${p.name} presses: ${JSON.stringify(await p.page.evaluate(() => window.__downs))}`);
        problems.push(`${p.name} hand box: ${JSON.stringify(await p.page.evaluate(() => { const r = document.querySelector('.hand').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); }))}`);
      }
    }
    break;
  }
  if (r > ROUNDS || (await phaseOf(host)) === 'final') {
    say(`played to round "${label}" (${r > ROUNDS ? `past ROUNDS=${ROUNDS}` : 'the final'})`);
    break;
  }
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

for (const p of [host, guest]) {
  const jumps = await p.page.evaluate(() => window.__jumps);
  if (jumps.length) problems.push(`${p.name}: the table moved ${jumps.length}×:\n  ${[...new Set(jumps)].slice(0, 12).join('\n  ')}`);
}

say(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no problems');
await browser.close();
