// Simulated games for the rules: whole games at every table size, played out by random legal players.
// Not in CI (the user, 2026-10-20: "rely on simpler (unit) tests there"); run them with `npm run test:sim`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DECK,
  DECK_SPECIAL,
  RuleError,
  SUITS,
  bid,
  deal,
  isJester,
  isWizard,
  legalCards,
  parseCard,
  pickTrump,
  play,
  roundsFor,
  schedule,
  scoreRound,
  shuffled,
  sortHand,
  suitToFollow,
  trickWinner,
  bidders,
  forbiddenBid,
} from '../server/rules.mjs';

const throws = (fn, code) => assert.throws(fn, (e) => e instanceof RuleError && e.code === code, code);

/** mulberry32: a repeatable random integer below n. */
function seeded(seed) {
  let a = seed >>> 0;
  return (n) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

/** A "random" that never swaps, so shuffled() keeps the box order. */
const inOrder = (n) => n - 1;

/** A trick in play order, seats 0, 1, 2, … */
const trick = (...cards) => cards.map((card, seat) => ({ seat, card }));

/** A fixed deal, bid through (bids in bidding order, from the seat left of the dealer). */
function table(hands, { trumpCard = 'earth-7', dealer = hands.length - 1, bids } = {}) {
  const s = deal({ players: hands.length, round: hands[0].length, dealer, hands, trumpCard });
  for (const b of bids ?? hands.map(() => 0)) bid(s, s.turn, b);
  return s;
}

// Three players, four cards each, earth is trump (the turned earth-7); seat 0 bids first and leads.
const HANDS = [
  ['water-5', 'air-2', 'n-fire', 'z-earth'],
  ['water-9', 'air-7', 'z-fire', 'n-air'],
  ['air-10', 'earth-3', 'fire-1', 'n-water'],
];

// ---- whole games ------------------------------------------------------------------------------

test('whole games at 3, 4, 5 and 6 players: every round played out with legal cards', () => {
  let picked = 0;
  let jesters = 0;
  let refused = 0;
  for (const players of [3, 4, 5, 6]) {
    for (const seed of [1, 2, 3]) {
      const rand = seeded(seed * 100 + players);
      const first = rand(players);
      const totals = Array(players).fill(0);
      for (let round = 1; round <= roundsFor(players); round++) {
        const dealer = (first + round - 1) % players;
        const s = deal({ players, round, dealer, randomInt: rand });
        assert.equal(s.dealer, dealer);
        if (s.trumpCard && isJester(s.trumpCard)) jesters++;
        if (s.phase === 'trump') {
          picked++;
          assert.equal(s.turn, dealer);
          pickTrump(s, dealer, SUITS[rand(4)]);
        }
        const bidders = [];
        while (s.phase === 'bid') {
          bidders.push(s.turn);
          bid(s, s.turn, rand(round + 1));
        }
        assert.deepEqual(bidders, Array.from({ length: players }, (_, i) => (dealer + 1 + i) % players));
        assert.equal(s.trick.lead, (dealer + 1) % players);

        const seen = new Set(s.trumpCard ? [s.trumpCard] : []);
        while (s.phase === 'play') {
          const seat = s.turn;
          const legal = legalCards(s, seat);
          assert.ok(legal.length > 0);
          // Every other card in hand breaks the follow rule (tried on a copy; seed 1 only, it's slow).
          if (seed === 1) {
            for (const card of s.hands[seat]) {
              if (legal.includes(card)) continue;
              throws(() => play(structuredClone(s), seat, card), 'follow');
              refused++;
            }
          }
          const card = legal[rand(legal.length)];
          assert.ok(!seen.has(card), `${card} twice`);
          seen.add(card);
          const { trick: done } = play(s, seat, card);
          if (done) {
            assert.equal(done.cards.length, players);
            done.cards.forEach((p, i) => assert.equal(p.seat, (done.lead + i) % players));
            assert.equal(s.turn, done.winner);
          }
        }
        assert.equal(s.phase, 'done');
        assert.equal(s.tricks.length, round);
        assert.equal(s.won.reduce((a, b) => a + b, 0), round);
        for (let seat = 0; seat < players; seat++) {
          assert.equal(s.won[seat], s.tricks.filter((t) => t.winner === seat).length);
        }
        assert.ok(s.hands.every((h) => h.length === 0));
        assert.deepEqual(s.points, scoreRound(s.bids, s.won));
        assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
        s.points.forEach((p, i) => (totals[i] += p));
      }
      assert.ok(totals.every(Number.isInteger));
    }
  }
  // The seeds above turn up a Wizard (the dealer's pick) and a Jester (no trump) along the way.
  assert.ok(picked > 0, 'a turned Wizard came up');
  assert.ok(jesters > 0, 'a turned Jester came up');
  assert.ok(refused > 100, 'the follow rule came up');
});
