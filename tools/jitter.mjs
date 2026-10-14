// The lock-up hunt (the user, 2026-10-13: "the game locks up"): one person and two bots, every other
// view arriving as if JITTER ms (250) slower (a phone's network jitter, made by skewing Date.now while that
// view is handled). The person taps a legal card whenever it's their turn. Stuck = their turn, a
// legal card tapped, and nothing changed for 12 s.
//
//   npm run build && (the stichle-prod preview, port 6311)
//   ROUNDS=6 JITTER=250 node tools/jitter.mjs [base]
import { webkit } from '../../folio/node_modules/playwright/index.mjs';

const BASE = process.argv[2] ?? 'http://localhost:6311';
const ROUNDS = Number(process.env.ROUNDS ?? 6);
const browser = await webkit.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const JITTER = Number(process.env.JITTER ?? 250);
await context.addInitScript((jitter) => {
  try {
    localStorage.setItem('ewo:lang', 'de');
    localStorage.setItem('stichle:guide', '1');
  } catch {}
  // Every other view is handled as if it had taken 250 ms longer to arrive.
  const realNow = Date.now.bind(Date);
  let skew = 0;
  Date.now = () => realNow() + skew;
  const add = EventSource.prototype.addEventListener;
  let count = 0;
  EventSource.prototype.addEventListener = function (type, fn, opts) {
    if (type !== 'view') return add.call(this, type, fn, opts);
    return add.call(this, type, (event) => {
      skew = ++count % 2 ? jitter : 0;
      try {
        fn(event);
      } finally {
        skew = 0;
      }
    }, opts);
  };
}, JITTER);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: 'load' });
const api = (path, body, token) => page.evaluate(async ([path, body, token]) => {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-stichle-token': token } : {}) }, body: JSON.stringify(body ?? {}) });
  return r.status === 204 ? null : r.json();
}, [path, body, token]);
const seat = await api('/api/rooms', { name: 'Anna', avatar: [1, 2, 3] });
await api(`/api/rooms/${seat.code}/bot`, { add: true }, seat.token);
await api(`/api/rooms/${seat.code}/bot`, { add: true }, seat.token);
await page.evaluate(([code, s]) => localStorage.setItem(`stichle:seat:${code}`, JSON.stringify({ ...s, at: Date.now() })), [seat.code, seat]);
await page.goto(`${BASE}/${seat.code}`, { waitUntil: 'load' });
await page.getByRole('button', { name: 'Karten geben' }).click();
await page.waitForSelector('.table');

const snapshot = () => page.evaluate(() => ({
  round: document.querySelector('.round .display')?.textContent ?? '',
  status: document.querySelector('.status, .toast')?.textContent ?? '',
  mine: Boolean(document.querySelector('.status.turn')),
  hand: document.querySelectorAll('.hand .slot').length,
  trick: document.querySelectorAll('.trick .played').length,
  bid: Boolean(document.querySelector('.panel.bid')),
  trump: Boolean(document.querySelector('.suitbtn')),
  scored: Boolean(document.querySelector('.result')),
  final: Boolean(document.querySelector('.final')),
}));
let last = '';
let since = Date.now();
let stuck = null;
for (let i = 0; i < 4000; i++) {
  const s = await snapshot();
  const r = Number(s.round.split('/')[0]) || 0;
  if (s.final || r > ROUNDS) break;
  const key = JSON.stringify(s);
  if (key !== last) {
    last = key;
    since = Date.now();
  } else if (Date.now() - since > 12_000) {
    stuck = s;
    break;
  }
  if (s.bid) {
    const send = page.locator('.panel.bid .btn.primary');
    if (await send.isDisabled().catch(() => false)) await page.getByRole('button', { name: 'Einen mehr' }).click().catch(() => {});
    await send.click({ timeout: 1000 }).catch(() => {});
  } else if (s.trump) {
    await page.locator('.suitbtn').first().click().catch(() => {});
  } else if (s.scored) {
    await page.getByRole('button', { name: /Weiter zu Runde/ }).click({ timeout: 1000 }).catch(() => {});
  } else if (s.mine) {
    // Tap a card the rules allow, twice (lift, then play), like a person would.
    const box = await page.evaluate(() => {
      const legal = [...document.querySelectorAll('.hand .slot')].filter((el) => !el.classList.contains('dim'));
      const el = legal[legal.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + 14, y: r.top + 26 };
    });
    if (box) {
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(90);
      await page.mouse.click(box.x, box.y - 24);
    }
  }
  await page.waitForTimeout(250);
}
console.log(stuck ? `STUCK for 12 s: ${JSON.stringify(stuck)}` : `no lock-up through round ${ROUNDS}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
process.exit(stuck ? 1 : 0);
