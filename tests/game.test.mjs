import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAY_MS, GameError, ROUND_WAIT, TRICK_PAUSE } from '../server/game.mjs';
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

test('a new table seats its host; joiners sit down until six, then watch', () => {
  const { games } = setup();
  const r = room(games, 5);
  assert.equal(r.pages[0].view.order.length, 6);
  const seventh = games.join(r.code, { name: 'Zoe' });
  const page = watch(games, r.code, seventh.player);
  assert.equal(page.view.order.includes(seventh.player), false);
  assert.equal(code(() => games.act(r.code, seventh.token, 'sit', { seated: true })), 'table-full');
  r.act(r.seats[5], 'sit', { seated: false });
  games.act(r.code, seventh.token, 'sit', { seated: true });
  assert.ok(page.view.order.includes(seventh.player));
});

test('it takes three at the table to deal; bots fill chairs', () => {
  const { games } = setup();
  const r = room(games, 1);
  assert.equal(code(() => r.act(r.host, 'start')), 'too-few');
  assert.equal(code(() => r.act(r.seats[1], 'bot', { add: true })), 'not-host');
  r.act(r.host, 'bot', { add: true });
  r.act(r.host, 'start');
  const g = r.pages[0].view.game;
  assert.equal(r.pages[0].view.phase, 'play');
  assert.equal(g.seats.length, 3);
  assert.equal(g.rounds, 20);
  assert.equal(g.round, 1);
});

test("a hand reaches only its own page; others, watchers and the big screen see how many", () => {
  const { games } = setup(3);
  const r = room(games, 2);
  const watcher = games.join(r.code, { name: 'Zoe' });
  r.act(r.host, 'move', { player: watcher.player, seated: false });
  const zoe = watch(games, r.code, watcher.player);
  const screen = watch(games, r.code);
  r.act(r.host, 'start');
  for (const [i, page] of r.pages.entries()) {
    const g = page.view.game;
    const mine = g.seats.indexOf(r.seats[i].player);
    assert.equal(g.hand.length, 1);
    assert.deepEqual(g.counts, [1, 1, 1]);
    // Nobody else's cards anywhere in this page's stream.
    const others = r.pages.filter((_, j) => j !== i).map((p) => p.view.game.hand[0]);
    const text = JSON.stringify(page.view);
    for (const card of others) if (card !== g.trumpCard) assert.equal(text.includes(`"${card}"`), false, `seat ${mine} saw ${card}`);
  }
  assert.equal(zoe.view.game.hand, null);
  assert.equal(screen.view.game.hand, null);
  assert.deepEqual(screen.view.game.legal, []);
});

test('a round: bids in order from left of the dealer, tricks, the pause, the result, the next deal', () => {
  const { games, clock } = setup(5);
  const r = room(games, 2);
  r.act(r.host, 'start');
  const g0 = r.pages[0].view.game;
  assert.equal(g0.stage, g0.trumpCard?.startsWith('z-') ? 'trump' : 'bid');
  if (g0.stage === 'trump') move(r);
  assert.equal(r.pages[0].view.game.turn, (g0.dealer + 1) % 3);
  // Out of turn is refused.
  const notTurn = r.seats.findIndex((_, i) => i !== turnOf(r));
  assert.equal(code(() => r.act(r.seats[notTurn], 'bid', { n: 0 })), 'turn');
  for (let i = 0; i < 3; i++) move(r);
  assert.equal(r.pages[0].view.game.stage, 'play');
  for (let i = 0; i < 3; i++) move(r);
  const g = r.pages[0].view.game;
  // Round 1 is a single trick: it's done, the trick stays on view for its pause.
  assert.equal(g.stage, 'done');
  assert.equal(g.lastTrick.cards.length, 3);
  assert.equal(g.phase, 'round');
  clock.advance(TRICK_PAUSE);
  const s = r.pages[0].view.game;
  assert.equal(s.phase, 'scored');
  assert.equal(s.pad.length, 1);
  assert.equal(s.pad[0].won.reduce((a, b) => a + b, 0), 1);
  // Everyone taps on: round 2 deals two cards each, the next dealer.
  for (const seat of r.seats) r.act(seat, 'next');
  const n = r.pages[0].view.game;
  assert.equal(n.phase, 'round');
  assert.equal(n.round, 2);
  assert.equal(n.dealer, (g0.dealer + 1) % 3);
  assert.equal(n.hand.length, 2);
});

test('a finished trick holds the table: the next card waits for the pause', () => {
  const { games, clock } = setup(11);
  const r = room(games, 2);
  r.act(r.host, 'start');
  // Into round 2, where a trick is followed by another.
  while (r.pages[0].view.game.round === 1) {
    const g = r.pages[0].view.game;
    if (g.phase === 'scored') for (const seat of r.seats) r.act(seat, 'next');
    else if (g.stage === 'done') clock.advance(TRICK_PAUSE);
    else move(r);
  }
  while (r.pages[0].view.game.stage !== 'play') move(r);
  for (let i = 0; i < 3; i++) move(r);
  const g = r.pages[0].view.game;
  assert.equal(g.lastTrick.n, 1);
  const leader = r.seats[turnOf(r)];
  const card = r.pages[turnOf(r)].view.game.legal[0];
  assert.equal(code(() => r.act(leader, 'play', { card })), 'wait');
  clock.advance(TRICK_PAUSE);
  r.act(leader, 'play', { card });
  assert.equal(r.pages[0].view.game.trick.cards.length, 1);
});

test('the round result deals on by itself after a while', () => {
  const { games, clock } = setup(2);
  const r = room(games, 2);
  r.act(r.host, 'start');
  while (r.pages[0].view.game.phase !== 'scored') {
    if (r.pages[0].view.game.stage === 'done') clock.advance(TRICK_PAUSE);
    else move(r);
  }
  r.act(r.host, 'next');
  clock.advance(ROUND_WAIT);
  assert.equal(r.pages[0].view.game.round, 2);
});

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
    assert.deepEqual(v.game.totals, v.game.seats.map((_, i) => v.game.pad.reduce((s, row) => s + row.points[i], 0)));
    games.close();
  }
});

test('someone who closed the page on their move: the bot moves for them after a while', () => {
  const { games, clock } = setup(4);
  const r = room(games, 2);
  r.act(r.host, 'start');
  if (r.pages[0].view.game.stage === 'trump') move(r);
  const away = turnOf(r);
  r.pages[away].close();
  const before = r.pages[0].view.game.bids.filter((b) => b !== null).length;
  clock.advance(AWAY_MS - 1000);
  assert.equal(r.pages[0].view.game.bids.filter((b) => b !== null).length, before);
  clock.advance(3000);
  assert.equal(r.pages[0].view.game.bids.filter((b) => b !== null).length, before + 1);
});

test('the clock: when it runs out, the bot moves for you', () => {
  const { games, clock } = setup(6);
  const r = room(games, 2);
  r.act(r.host, 'settings', { clock: 'quick' });
  r.act(r.host, 'start');
  if (r.pages[0].view.game.stage === 'trump') move(r);
  const g = r.pages[0].view.game;
  assert.ok(g.endsAt > clock.now());
  const before = g.bids.filter((b) => b !== null).length;
  clock.advance(26_000);
  assert.equal(r.pages[0].view.game.bids.filter((b) => b !== null).length, before + 1);
});

test('a seat whose player left is played by the bot; the host is handed on', () => {
  const { games, clock } = setup(8);
  const r = room(games, 2);
  r.act(r.host, 'start');
  r.act(r.host, 'leave');
  assert.equal(r.pages[1].view.host, r.seats[1].player);
  assert.ok(r.pages[1].view.game.gone.some(Boolean));
  let guard = 0;
  // Only Ben and Lea move; Anna's seat plays itself.
  while (r.pages[1].view.game.round === 1 && guard++ < 200) {
    const g = r.pages[1].view.game;
    if (g.phase === 'scored') {
      r.act(r.seats[1], 'next');
      r.act(r.seats[2], 'next');
      continue;
    }
    const at = g.seats[g.turn];
    const who = r.seats.findIndex((s) => s.player === at);
    if (who > 0 && g.stage !== 'done' && clock.now() >= g.holdUntil) move(r);
    else clock.advance(1000);
  }
  assert.equal(r.pages[1].view.game.round, 2);
});

test('the host ends a game early; again at the same table, or back to the lobby', () => {
  const { games } = setup(9);
  const r = room(games, 2);
  r.act(r.host, 'start');
  assert.equal(code(() => r.act(r.seats[1], 'stop')), 'not-host');
  r.act(r.host, 'stop');
  const v = r.pages[0].view;
  assert.equal(v.phase, 'final');
  assert.equal(v.game.ended, 'stopped');
  assert.equal(v.game.stoppedBy, r.host.player);
  // Hands stay private, even at the end.
  assert.equal(r.pages[1].view.game.hand, null);
  r.act(r.host, 'rematch');
  assert.equal(r.pages[0].view.phase, 'play');
  assert.equal(r.pages[0].view.game.n, 2);
  r.act(r.host, 'stop');
  r.act(r.host, 'rematch', { lobby: true });
  assert.equal(r.pages[0].view.phase, 'lobby');
  assert.equal(r.pages[0].view.game, null);
});

test('the host swaps seats; settings keep only what is valid', () => {
  const { games } = setup(12);
  const r = room(games, 4);
  const before = r.pages[0].view.order.join();
  let changed = false;
  for (let i = 0; i < 6 && !changed; i++) {
    r.act(r.host, 'shuffle');
    changed = r.pages[0].view.order.join() !== before;
  }
  assert.ok(changed);
  assert.equal(new Set(r.pages[0].view.order).size, 5);
  r.act(r.host, 'settings', { clock: 'never' });
  assert.equal(r.pages[0].view.settings.clock, 'off');
  r.act(r.host, 'settings', { clock: 'relaxed' });
  assert.equal(r.pages[0].view.settings.clock, 'relaxed');
});

// ---- house rules (R2) --------------------------------------------------------------------

/** A turned Wizard: the dealer (a person here) picks a suit. */
function pickIfAsked(r) {
  const g = r.pages[0].view.game;
  if (g.stage !== 'trump') return;
  const dealer = r.seats.findIndex((s) => s.player === g.seats[g.dealer]);
  r.act(r.seats[dealer], 'trump', { suit: 'earth' });
}

test('secret bids: everyone bids at once; no page sees another bid until all are in', () => {
  const { games } = setup(21);
  const r = room(games, 2);
  r.act(r.host, 'settings', { bidding: 'secret' });
  r.act(r.host, 'start');
  pickIfAsked(r);
  const g = r.pages[0].view.game;
  assert.equal(g.bidding, 'secret');
  assert.equal(g.waiting.length, 3);
  // Lea bids first, out of the old turn order.
  r.act(r.seats[2], 'bid', { n: 1 });
  const lea = g.seats.indexOf(r.seats[2].player);
  assert.equal(r.pages[2].view.game.bids[lea], 1);
  assert.equal(r.pages[0].view.game.bids[lea], null);
  assert.equal(r.pages[1].view.game.bids[lea], null);
  assert.equal(r.pages[0].view.game.bidIn[lea], true);
  assert.equal(r.pages[0].view.game.waiting.includes(lea), false);
  assert.equal(code(() => r.act(r.seats[2], 'bid', { n: 0 })), 'turn');
  r.act(r.seats[0], 'bid', { n: 0 });
  r.act(r.seats[1], 'bid', { n: 0 });
  const after = r.pages[0].view.game;
  assert.equal(after.stage, 'play');
  assert.equal(after.bids[lea], 1);
});

test('secret bids with bots: the bots bid on their own and the round goes on', () => {
  const { games, clock } = setup(22);
  const r = room(games, 0);
  r.act(r.host, 'bot', { add: true });
  r.act(r.host, 'bot', { add: true });
  r.act(r.host, 'settings', { bidding: 'secret' });
  r.act(r.host, 'start');
  const g0 = r.pages[0].view.game;
  if (g0.stage === 'trump' && g0.seats[g0.dealer] === r.host.player) r.act(r.host, 'trump', { suit: 'air' });
  clock.advance(5000);
  const g = r.pages[0].view.game;
  const me = g.seats.indexOf(r.host.player);
  assert.equal(g.stage, 'bid');
  assert.deepEqual(g.waiting, [me]);
  r.act(r.host, 'bid', { n: 0 });
  assert.equal(r.pages[0].view.game.stage, 'play');
});

test("mustn't add up: only the dealer's page is told the one bid it mayn't make, and the server refuses it", () => {
  const { games } = setup(23);
  const r = room(games, 2);
  r.act(r.host, 'settings', { bidding: 'uneven' });
  r.act(r.host, 'start');
  pickIfAsked(r);
  for (let i = 0; i < 2; i++) {
    const at = turnOf(r);
    r.act(r.seats[at], 'bid', { n: 0 });
  }
  const g = r.pages[0].view.game;
  const dealer = turnOf(r);
  assert.equal(g.seats[g.dealer], r.seats[dealer].player);
  assert.equal(r.pages[dealer].view.game.forbidden, 1);
  for (const [i, page] of r.pages.entries()) if (i !== dealer) assert.equal(page.view.game.forbidden, null);
  assert.equal(code(() => r.act(r.seats[dealer], 'bid', { n: 1 })), 'uneven');
  r.act(r.seats[dealer], 'bid', { n: 0 });
  assert.equal(r.pages[0].view.game.stage, 'play');
});

test('the bidding rule is a setting the host picks, and stays fixed for the game', () => {
  const { games } = setup(24);
  const r = room(games, 2);
  r.act(r.host, 'settings', { bidding: 'loud' });
  assert.equal(r.pages[0].view.settings.bidding, 'open');
  r.act(r.host, 'settings', { bidding: 'uneven' });
  r.act(r.host, 'start');
  assert.equal(code(() => r.act(r.host, 'settings', { bidding: 'secret' })), 'wrong-phase');
  assert.equal(r.pages[0].view.game.bidding, 'uneven');
});
