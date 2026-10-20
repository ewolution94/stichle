// Simulated games for the room: whole games played to the final by bots, through the room on a fake clock.
// Not in CI (the user, 2026-10-20: "rely on simpler (unit) tests there"); run them with `npm run test:sim`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAY_MS, GameError, ROUND_WAIT, TRICK_PAUSE, TRICK_PAUSE_FAST } from '../server/game.mjs';
import { room, setup, turnOf, watch } from './helpers.mjs';

// The room around the rules (server/rules.mjs has its own tests): seats, the flow of rounds, what
// each page may see, the bots and the absent, and the host's moves.

const code = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof GameError, `not a GameError: ${error}`);
    return error.code;
  }
  assert.fail('expected a refusal');
};

/** Plays the move a bot would, from the page of whoever's turn it is. */
function move(r) {
  const page = r.pages[turnOf(r)];
  const g = page.view.game;
  const seat = g.turn;
  if (g.stage === 'bid') {
    r.act(r.seats[turnOf(r)], 'bid', { n: 0 });
    return;
  }
  if (g.stage === 'trump') {
    r.act(r.seats[turnOf(r)], 'trump', { suit: 'fire' });
    return;
  }
  r.act(r.seats[turnOf(r)], 'play', { card: g.legal[0] });
  return seat;
}

test('bots play whole games with a human who always passes the move on, to the final', () => {
  for (const players of [3, 4, 5, 6]) {
    const { games, clock } = setup(players * 13);
    const r = room(games, 0);
    for (let i = 1; i < players; i++) r.act(r.host, 'bot', { add: true });
    r.act(r.host, 'start');
    let guard = 0;
    while (r.pages[0].view.phase === 'play' && guard++ < 20000) {
      const g = r.pages[0].view.game;
      const me = g.seats.indexOf(r.host.player);
      if (g.phase === 'scored') r.act(r.host, 'next');
      else if (g.phase === 'round' && g.stage !== 'done' && g.turn === me) {
        if (g.stage === 'trump') r.act(r.host, 'trump', { suit: 'air' });
        else if (g.stage === 'bid') r.act(r.host, 'bid', { n: 0 });
        else if (g.legal.length && clock.now() >= g.holdUntil) r.act(r.host, 'play', { card: g.legal[0] });
        else clock.advance(500);
      } else clock.advance(500);
    }
    const v = r.pages[0].view;
    assert.equal(v.phase, 'final', `${players} players`);
    assert.equal(v.game.ended, 'done');
    assert.equal(v.game.pad.length, 60 / players);
    // Every round's tricks add up to its number of cards.
    for (const row of v.game.pad) assert.equal(row.won.reduce((a, b) => a + b, 0), row.round);
    // A full game: the rounds are its cards, and only the last one is the final.
    assert.deepEqual(v.game.pad.map((row) => row.no), v.game.pad.map((row) => row.round));
    assert.deepEqual(v.game.pad.map((row) => row.final), v.game.pad.map((_, i) => i === v.game.pad.length - 1));
    assert.deepEqual(v.game.totals, v.game.seats.map((_, i) => v.game.pad.reduce((s, row) => s + row.points[i], 0)));
    games.close();
  }
});

// ---- house rules (R2) --------------------------------------------------------------------

/** Plays a host with two bots to the final, the host passing every move on (as the bots test). */
function playToFinal(r, clock) {
  let guard = 0;
  while (r.pages[0].view.phase === 'play' && guard++ < 20000) {
    const g = r.pages[0].view.game;
    const me = g.seats.indexOf(r.host.player);
    if (g.phase === 'scored') r.act(r.host, 'next');
    else if (g.phase === 'round' && g.stage !== 'done' && g.turn === me) {
      if (g.stage === 'trump') r.act(r.host, 'trump', { suit: 'air' });
      else if (g.stage === 'bid') r.act(r.host, 'bid', { n: 0 });
      else if (g.legal.length && clock.now() >= g.holdUntil) r.act(r.host, 'play', { card: g.legal[0] });
      else clock.advance(500);
    } else clock.advance(500);
  }
  return r.pages[0].view;
}

test('the length: a half game deals every other round, a short one the first half; rounds and cards come apart', () => {
  for (const [length, cards] of [
    ['half', [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]],
    ['short', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ]) {
    const { games, clock } = setup(23);
    const r = room(games, 0);
    r.act(r.host, 'bot', { add: true });
    r.act(r.host, 'bot', { add: true });
    r.act(r.host, 'settings', { length });
    r.act(r.host, 'start');
    const first = r.pages[0].view.game;
    assert.equal(first.length, length);
    assert.equal(first.rounds, 10);
    assert.equal(first.no, 1);
    const v = playToFinal(r, clock);
    assert.equal(v.phase, 'final', length);
    assert.deepEqual(v.game.pad.map((row) => row.round), cards, length);
    assert.deepEqual(v.game.pad.map((row) => row.no), cards.map((_, i) => i + 1));
    for (const row of v.game.pad) assert.equal(row.won.reduce((a, b) => a + b, 0), row.round);
    // Only a full game has a final round (the achievements' "lastRound").
    assert.ok(v.game.pad.every((row) => !row.final));
    games.close();
  }
});

test('the forehead round with bots: they bid on the others\' cards and the game goes on', () => {
  const { games, clock } = setup(41);
  const r = room(games, 0);
  r.act(r.host, 'bot', { add: true });
  r.act(r.host, 'bot', { add: true });
  r.act(r.host, 'settings', { forehead: true, length: 'short' });
  r.act(r.host, 'start');
  const v = playToFinal(r, clock);
  assert.equal(v.phase, 'final');
  assert.equal(v.game.pad[0].round, 1);
  for (const row of v.game.pad) assert.equal(row.won.reduce((a, b) => a + b, 0), row.round);
  games.close();
});

test('the special cards: a game with them plays to the final; a stolen trick counts for nobody', () => {
  for (const players of [3, 4]) {
    const { games, clock } = setup(players * 7 + 1);
    const r = room(games, 0);
    for (let i = 1; i < players; i++) r.act(r.host, 'bot', { add: true });
    r.act(r.host, 'settings', { specials: true });
    r.act(r.host, 'start');
    assert.equal(r.pages[0].view.game.specials, true);
    assert.equal(r.pages[0].view.game.rounds, players === 3 ? 21 : 15);
    const v = playToFinal(r, clock);
    assert.equal(v.phase, 'final', `${players} players`);
    assert.equal(v.game.pad.length, players === 3 ? 21 : 15);
    // Every round: the tricks taken and the ones the Dieb stole add up to its cards (the Dieb steals at most one).
    for (const row of v.game.pad) {
      const taken = row.won.reduce((a, b) => a + b, 0);
      assert.ok(taken === row.round || taken === row.round - 1, `round ${row.round}: ${taken}`);
    }
    games.close();
  }
});
