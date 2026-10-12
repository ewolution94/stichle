// Shared by the game tests: a fake clock, a seeded random, and rooms set up the way pages use them.

import { createGames } from '../server/game.mjs';

/** A clock that only moves when the test says so. */
export function fakeClock(start = 1_000_000) {
  let t = start;
  let timers = [];
  return {
    now: () => t,
    setTimeout(fn, ms) {
      const handle = { at: t + ms, fn };
      timers.push(handle);
      return handle;
    },
    clearTimeout(handle) {
      timers = timers.filter((h) => h !== handle);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((h) => h.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((h) => h !== due);
        t = due.at;
        due.fn();
      }
      t = end;
    },
  };
}

/** A repeatable random integer below n. */
export function seededInt(seed = 1) {
  let s = seed >>> 0;
  return (n) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 2 ** 32) * n);
  };
}

export function setup(seed = 7) {
  const clock = fakeClock();
  const games = createGames({ clock, randomInt: seededInt(seed) });
  return { clock, games };
}

/** A page on the room's stream, keeping the latest view. */
export function watch(games, code, playerId = null) {
  const page = { view: null };
  page.close = games.subscribe(code, playerId, (event, data) => {
    if (event === 'view') page.view = JSON.parse(data);
  });
  return page;
}

const NAMES = ['Ben', 'Lea', 'Mia', 'Jonas', 'Emre', 'Sofia'];

/** A host and `others` more players, all on the stream and at the table, in that order. */
export function room(games, others = 2) {
  const host = games.create({ name: 'Anna', avatar: [1, 0, 0] });
  const seats = [host];
  for (let i = 0; i < others; i++) seats.push(games.join(host.code, { name: NAMES[i] }));
  const pages = seats.map((s) => watch(games, host.code, s.player));
  const act = (seat, action, body = {}) => games.act(host.code, seat.token, action, body);
  return { code: host.code, seats, pages, host, act };
}

/** Whose page belongs to the seat whose move it is. */
export function turnOf(r) {
  const g = r.pages[0].view.game;
  const id = g.seats[g.turn];
  return r.seats.findIndex((s) => s.player === id);
}
