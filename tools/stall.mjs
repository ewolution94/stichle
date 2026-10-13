// The stall test (plans/live-connection.md): two pages in a room, the server paused with SIGSTOP for
// 60 s: the connection pill must say "reconnecting" within ~45–55 s and be back soon after SIGCONT.
// Then a page hidden while the server is paused > 25 s, shown again while its stream is still dead:
// it must reopen at once. Pauses only the PID it's given (the stichle-prod preview's), never by name.
//
//   npm run build && (the stichle-prod preview, port 6311)
//   node tools/stall.mjs $(lsof -ti :6311 -sTCP:LISTEN)
import { webkit } from '../../folio/node_modules/playwright/index.mjs';
const BASE = 'http://localhost:6311';
const PID = Number(process.argv[2]);
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
const browser = await webkit.launch();
async function person(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ewo:lang', 'de'); localStorage.setItem('stichle:guide', '1'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  return page;
}
const a = await person('a');
const b = await person('b');
const api = (page, path, body, token) => page.evaluate(async ([path, body, token]) => {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-stichle-token': token } : {}) }, body: JSON.stringify(body ?? {}) });
  return r.status === 204 ? null : r.json();
}, [path, body, token]);
const seat = await api(a, '/api/rooms', { name: 'Anna', avatar: [1, 2, 3] });
const gseat = await api(b, `/api/rooms/${seat.code}/join`, { name: 'Ben', avatar: [4, 5, 6] });
for (const [p, s] of [[a, seat], [b, gseat]]) {
  await p.evaluate(([code, s]) => localStorage.setItem(`stichle:seat:${code}`, JSON.stringify({ ...s, at: Date.now() })), [seat.code, s]);
  await p.goto(`${BASE}/${seat.code}`, { waitUntil: 'load' });
  await p.waitForSelector('.lobby');
}
const pill = (p) => p.evaluate(() => document.querySelector('ewo-connection')?.getAttribute('state') ?? 'none');
const both = async () => `${await pill(a)}/${await pill(b)}`;
console.log(at(), 'start', await both());

// 1. The server stops answering for 60 s.
process.kill(PID, 'SIGSTOP');
console.log(at(), 'server stopped');
let seen = null;
const stoppedAt = Date.now();
while (Date.now() - stoppedAt < 60_000) {
  const s = await both();
  if (!seen && s.includes('reconnecting')) {
    seen = (Date.now() - stoppedAt) / 1000;
    console.log(at(), `reconnecting after ${seen.toFixed(1)} s:`, s);
  }
  await a.waitForTimeout(1000);
}
process.kill(PID, 'SIGCONT');
const contAt = Date.now();
console.log(at(), 'server continued', await both());
let back = null;
while (Date.now() - contAt < 30_000) {
  if ((await both()) === 'online/online') { back = (Date.now() - contAt) / 1000; break; }
  await a.waitForTimeout(250);
}
console.log(at(), back !== null ? `both online ${back.toFixed(1)} s after SIGCONT` : 'NOT back within 30 s', await both());
const lobbyOk = await a.locator('.lobby').count() && await b.locator('.lobby').count();
console.log(at(), 'lobby shown on both:', Boolean(lobbyOk));

// 2. A hidden page while the server is paused for 30 s, shown again while the stream is still dead:
// it reopens at once ("reconnecting" right away), and is online as soon as the server answers.
await a.waitForTimeout(3000);
const setVisible = (p, visible) => p.evaluate((visible) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !visible });
  document.dispatchEvent(new Event('visibilitychange'));
}, visible);
await setVisible(a, false);
process.kill(PID, 'SIGSTOP');
console.log(at(), 'page A hidden, server stopped');
await a.waitForTimeout(30_000);
console.log(at(), 'A before showing:', await pill(a));
const shownAt = Date.now();
await setVisible(a, true);
let blip = null;
while (Date.now() - shownAt < 5_000) {
  if ((await pill(a)) === 'reconnecting') { blip = (Date.now() - shownAt) / 1000; break; }
  await a.waitForTimeout(50);
}
console.log(at(), blip !== null ? `A reopened ${blip.toFixed(2)} s after being shown` : 'A did NOT reopen on show', await pill(a));
process.kill(PID, 'SIGCONT');
const contAt2 = Date.now();
let online = null;
while (Date.now() - contAt2 < 20_000) {
  if ((await pill(a)) === 'online') { online = (Date.now() - contAt2) / 1000; break; }
  await a.waitForTimeout(100);
}
console.log(at(), online !== null ? `A online ${online.toFixed(1)} s after SIGCONT` : 'A NOT online within 20 s');
await browser.close();
