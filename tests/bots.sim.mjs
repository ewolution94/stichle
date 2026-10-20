// Simulated games for the bots: whole games and rounds played out by bots or random players, many deals sampled.
// Not in CI (the user, 2026-10-20: "rely on simpler (unit) tests there"); run them with `npm run test:sim`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, TEMPERS, botBid, botBidForehead, botPlay, botTrump } from '../server/bots.mjs';
import { DECK, SUITS, bid, deal, forbiddenBid, isJester, isWizard, legalCards, pickTrump, play, roundsFor, trickWinner } from '../server/rules.mjs';

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

/**
 * A fixed deal with the dealer in the last seat (so seat 0 bids first and leads), bid through in
 * seat order, and `played` cards played in turn. Fire is trump unless said otherwise.
 */
function at(hands, { trumpCard = 'fire-5', bids, played = [] } = {}) {
  const s = deal({ players: hands.length, round: hands[0].length, dealer: hands.length - 1, hands, trumpCard });
  for (const b of bids) bid(s, s.turn, b);
  for (const card of played) play(s, s.turn, card);
  return s;
}

/** `hand` for `seat`, the other seats filled from the rest of the box, for bids and trump picks. */
function holding(seat, hand, { players = 4, trumpCard = 'earth-7' } = {}) {
  const rest = DECK.filter((id) => !hand.includes(id) && id !== trumpCard);
  const hands = Array.from({ length: players }, (_, i) => (i === seat ? hand : rest.splice(0, hand.length)));
  return deal({ players, round: hand.length, dealer: (seat + players - 1) % players, hands, trumpCard });
}

/** Plays a round with bots everywhere (or the given bidder and player), checking every move. */
function round(players, roundNo, dealer, seed, { bidder = botBid, player = botPlay, check = true } = {}) {
  const s = deal({ players, round: roundNo, dealer, randomInt: seeded(seed) });
  if (s.phase === 'trump') {
    const suit = botTrump(s, dealer);
    if (check) assert.ok(SUITS.includes(suit));
    pickTrump(s, dealer, suit);
  }
  while (s.phase === 'bid') {
    const n = bidder(s, s.turn);
    if (check) assert.ok(Number.isInteger(n) && n >= 0 && n <= roundNo, `bid ${n} in round ${roundNo}`);
    bid(s, s.turn, n);
  }
  while (s.phase === 'play') {
    const seat = s.turn;
    const before = JSON.stringify(s);
    const card = player(s, seat);
    if (check) {
      assert.ok(legalCards(s, seat).includes(card), `${card} is legal`);
      assert.equal(JSON.stringify(s), before, 'a bot only looks');
      assert.equal(player(s, seat), card, 'the same state, the same card');
    }
    play(s, seat, card);
  }
  return s;
}

test('bots play whole games at every table size: legal cards, bids within the round, a real trump', () => {
  for (const players of [3, 4, 5, 6]) {
    for (const seed of [1, 2, 3, 4]) {
      const first = seed % players;
      for (let r = 1; r <= roundsFor(players); r++) {
        const s = round(players, r, (first + r - 1) % players, seed * 1000 + players * 50 + r);
        assert.equal(s.phase, 'done');
        assert.equal(s.won.reduce((a, b) => a + b, 0), r);
      }
    }
  }
});

test('botBid: in a long round the bids still roughly add up to the tricks', () => {
  for (const players of [3, 4]) {
    let bids = 0;
    let tricks = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = roundsFor(players) - 2;
      const s = deal({ players, round: r, dealer: 0, randomInt: seeded(seed) });
      if (s.phase === 'trump') pickTrump(s, 0, botTrump(s, 0));
      for (let seat = 0; seat < players; seat++) bids += botBid(s, seat);
      tricks += r;
    }
    assert.ok(bids > tricks * 0.75 && bids < tricks * 1.25, `${players} players bid ${bids} for ${tricks} tricks`);
  }
});

test('bots meet their bids far more often than random players, and play better than random cards', () => {
  const rand = seeded(99);
  const randomCard = (s, seat) => {
    const legal = legalCards(s, seat);
    return legal[rand(legal.length)];
  };
  const randomBid = (s) => rand(s.round + 1);
  const met = { bots: 0, randomPlay: 0, random: 0 };
  let seats = 0;
  for (let i = 0; i < 200; i++) {
    const players = 3 + (i % 4);
    const r = 1 + (i % roundsFor(players));
    const count = (s) => s.bids.filter((b, seat) => b === s.won[seat]).length;
    // The same deal three times: bots; bots' bids with random cards; random bids and cards.
    met.bots += count(round(players, r, i % players, 10_000 + i, { check: false }));
    met.randomPlay += count(round(players, r, i % players, 10_000 + i, { player: randomCard, check: false }));
    met.random += count(round(players, r, i % players, 10_000 + i, { bidder: randomBid, player: randomCard, check: false }));
    seats += players;
  }
  const rate = Object.fromEntries(Object.entries(met).map(([k, v]) => [k, v / seats]));
  assert.ok(rate.bots > 2 * rate.random, JSON.stringify(rate));
  assert.ok(rate.bots > rate.randomPlay + 0.03, JSON.stringify(rate));
});

test('with "mustn\'t add up" a bot dealer never bids the forbidden number', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const randomInt = seeded(seed);
    const players = 3 + (seed % 4);
    const round = 1 + (seed % roundsFor(players));
    const s = deal({ players, round, dealer: seed % players, randomInt, bidding: 'uneven' });
    if (s.phase === 'trump') pickTrump(s, s.dealer, botTrump(s, s.dealer));
    while (s.phase === 'bid') {
      const n = botBid(s, s.turn);
      assert.notEqual(n, forbiddenBid(s, s.turn));
      bid(s, s.turn, n);
    }
  }
});

// ---- the ranks (the user, 2026-10-14: Apprentice, Journeyman, Master) ---------------------------

const ranked = (level, temper = 'steady') => ({
  bidder: (s, seat) => botBid(s, seat, { level, temper }),
  player: (s, seat) => botPlay(s, seat, { level, temper }),
});

test('every rank plays legal cards and bids within the round, the same move from the same position', () => {
  for (const level of LEVELS) {
    // The master thinks for a while: short rounds for it.
    const last = level === 'master' ? 4 : 10;
    for (const players of [3, 5]) {
      for (let r = 1; r <= last; r++) {
        const s = round(players, r, r % players, 7000 + players * 50 + r, ranked(level));
        assert.equal(s.phase, 'done');
      }
    }
  }
});

test('no rank looks at another hand: shuffle the other seats\' cards among them and nothing changes', () => {
  const rand = seeded(42);
  for (const level of LEVELS) {
    for (let k = 0; k < 24; k++) {
      const players = 3 + (k % 3);
      const r = 2 + (k % 4);
      const s = deal({ players, round: r, dealer: k % players, randomInt: seeded(900 + k) });
      if (s.phase === 'trump') pickTrump(s, s.dealer, botTrump(s, s.dealer));
      // Some bids, then a card or two, so there's a trick to follow.
      while (s.phase === 'bid') bid(s, s.turn, botBid(s, s.turn));
      for (let i = 0; i < k % players; i++) play(s, s.turn, botPlay(s, s.turn));
      const seat = s.turn;
      const card = botPlay(s, seat, { level });
      // The other hands, dealt again from the same cards (each keeps its size).
      const others = s.hands.flatMap((h, i) => (i === seat ? [] : h));
      for (let i = others.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [others[i], others[j]] = [others[j], others[i]];
      }
      const t = { ...s, hands: s.hands.map((h, i) => (i === seat ? h : others.splice(0, h.length))) };
      assert.equal(botPlay(t, seat, { level }), card, `${level} plays the same without seeing other hands`);
    }
  }
});

test('the ranks keep their order: master over journeyman over apprentice, all over random play', () => {
  const rand = seeded(5);
  const lineup = ['apprentice', 'journeyman', 'master', 'random'];
  const points = Object.fromEntries(lineup.map((l) => [l, 0]));
  for (let d = 0; d < 160; d++) {
    const players = 4;
    const r = 1 + rand(5);
    const levelAt = (seat) => lineup[(seat + d) % players];
    const s = deal({ players, round: r, dealer: rand(players), randomInt: rand });
    if (s.phase === 'trump') pickTrump(s, s.dealer, botTrump(s, s.dealer));
    while (s.phase === 'bid') {
      const level = levelAt(s.turn);
      bid(s, s.turn, level === 'random' ? (forbiddenBid(s, s.turn) === 0 ? 1 : 0) : botBid(s, s.turn, { level }));
    }
    while (s.phase === 'play') {
      const level = levelAt(s.turn);
      const legal = legalCards(s, s.turn);
      play(s, s.turn, level === 'random' ? legal[rand(legal.length)] : botPlay(s, s.turn, { level }));
    }
    s.points.forEach((p, seat) => (points[levelAt(seat)] += p));
  }
  assert.ok(points.master > points.journeyman, `master ${points.master} > journeyman ${points.journeyman}`);
  assert.ok(points.journeyman > points.apprentice, `journeyman ${points.journeyman} > apprentice ${points.apprentice}`);
  assert.ok(points.apprentice > points.random, `apprentice ${points.apprentice} > random ${points.random}`);
});

test('temperament: a bold bot bids higher than a steady one, a cautious one lower, over many hands', () => {
  const sum = { cautious: 0, steady: 0, bold: 0 };
  for (let k = 0; k < 200; k++) {
    const s = deal({ players: 4, round: 3 + (k % 10), dealer: k % 4, randomInt: seeded(3000 + k) });
    if (s.phase === 'trump') pickTrump(s, s.dealer, botTrump(s, s.dealer));
    for (const temper of TEMPERS) sum[temper] += botBid(s, s.turn, { temper });
  }
  assert.ok(sum.bold > sum.steady && sum.steady > sum.cautious, JSON.stringify(sum));
});

test("an apprentice's slips stay small: the same trick won or lost, never a Wizard or a Jester instead", () => {
  let slips = 0;
  for (let k = 0; k < 400; k++) {
    const players = 3 + (k % 4);
    const s = deal({ players, round: 4 + (k % 6), dealer: k % players, randomInt: seeded(5000 + k) });
    if (s.phase === 'trump') pickTrump(s, s.dealer, botTrump(s, s.dealer));
    while (s.phase === 'bid') bid(s, s.turn, botBid(s, s.turn));
    for (let i = 0; i < k % 5; i++) play(s, s.turn, botPlay(s, s.turn));
    if (s.phase !== 'play') continue;
    const seat = s.turn;
    const meant = botPlay(s, seat, { level: 'plain' });
    const played = botPlay(s, seat, { level: 'apprentice' });
    if (meant === played) continue;
    slips++;
    assert.ok(!isWizard(played) && !isJester(played) && played !== 'dragon', `${played} is no Wizard or Jester`);
    if (s.trick.cards.length) {
      const takes = (id) => trickWinner([...s.trick.cards, { seat, card: id }], s.trump) === s.trick.cards.length;
      assert.equal(takes(played), takes(meant), `${played} wins or loses as ${meant} would`);
    }
  }
  assert.ok(slips > 40, `the apprentice slips now and then (${slips})`);
});
