import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DECK,
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

// ---- the cards ----------------------------------------------------------------------------------

test('the deck: 60 different cards in box order, 13 per suit, four Wizards, four Jesters', () => {
  assert.equal(DECK.length, 60);
  assert.equal(new Set(DECK).size, 60);
  assert.ok(Object.isFrozen(DECK));
  assert.deepEqual(SUITS, ['fire', 'water', 'earth', 'air']);
  assert.deepEqual(DECK.slice(0, 3), ['fire-1', 'fire-2', 'fire-3']);
  assert.equal(DECK[12], 'fire-13');
  assert.equal(DECK[13], 'water-1');
  assert.equal(DECK[51], 'air-13');
  assert.deepEqual(DECK.slice(52), ['z-fire', 'z-water', 'z-earth', 'z-air', 'n-fire', 'n-water', 'n-earth', 'n-air']);
  for (const s of SUITS) assert.equal(DECK.filter((id) => id.startsWith(`${s}-`)).length, 13);
  assert.equal(DECK.filter(isWizard).length, 4);
  assert.equal(DECK.filter(isJester).length, 4);
});

test('parseCard reads every card back to its id and refuses anything else', () => {
  const id = (c) => (c.k === 'num' ? `${c.s}-${c.v}` : `${c.k}-${c.s}`);
  for (const card of DECK) assert.equal(id(parseCard(card)), card);
  assert.deepEqual(parseCard('air-13'), { k: 'num', s: 'air', v: 13 });
  assert.deepEqual(parseCard('fire-7'), { k: 'num', s: 'fire', v: 7 });
  assert.deepEqual(parseCard('z-water'), { k: 'z', s: 'water' });
  assert.deepEqual(parseCard('n-earth'), { k: 'n', s: 'earth' });
  for (const bad of ['fire-0', 'fire-14', 'fire-07', 'Fire-7', 'gold-3', 'z-gold', 'n-', 'z-fire-1', 'wizard', '', null, undefined, 7, {}]) {
    throws(() => parseCard(bad), 'card');
  }
  assert.equal(isWizard('z-air'), true);
  assert.equal(isWizard('n-air'), false);
  assert.equal(isWizard('air-13'), false);
  assert.equal(isWizard('z-gold'), false);
  assert.equal(isJester('n-fire'), true);
  assert.equal(isJester('z-fire'), false);
  assert.equal(isJester(null), false);
});

test('rounds: 60 / players for 3 to 6 players, refused outside', () => {
  assert.deepEqual([3, 4, 5, 6].map(roundsFor), [20, 15, 12, 10]);
  for (const bad of [0, 1, 2, 7, 3.5, '4', null]) throws(() => roundsFor(bad), 'players');
});

test('shuffled: a new array with the same cards, the same order for the same seed', () => {
  const before = [...DECK];
  const a = shuffled(DECK, seeded(1));
  assert.deepEqual(DECK, before);
  assert.deepEqual([...a].sort(), [...DECK].sort());
  assert.notDeepEqual(a, DECK);
  assert.deepEqual(shuffled(DECK, seeded(1)), a);
  assert.notDeepEqual(shuffled(DECK, seeded(2)), a);
  assert.deepEqual(shuffled(DECK, inOrder), DECK);
});

test('sortHand: Wizards, then the suits (trump first), each ascending, Jesters last', () => {
  const hand = ['n-fire', 'water-3', 'z-earth', 'fire-10', 'fire-2', 'air-1', 'z-fire', 'n-air', 'water-13'];
  assert.deepEqual(sortHand(hand), ['z-fire', 'z-earth', 'fire-2', 'fire-10', 'water-3', 'water-13', 'air-1', 'n-fire', 'n-air']);
  assert.deepEqual(sortHand(hand, 'water'), ['z-fire', 'z-earth', 'water-3', 'water-13', 'fire-2', 'fire-10', 'air-1', 'n-fire', 'n-air']);
  assert.deepEqual(sortHand(hand, 'air'), ['z-fire', 'z-earth', 'air-1', 'fire-2', 'fire-10', 'water-3', 'water-13', 'n-fire', 'n-air']);
  assert.equal(hand[0], 'n-fire', 'the hand passed in stays as it was');
  assert.deepEqual(sortHand([]), []);
});

// ---- the deal ---------------------------------------------------------------------------------

test('the deal goes one card at a time from the seat left of the dealer; the next card turns up', () => {
  const s = deal({ players: 4, round: 2, dealer: 3, randomInt: inOrder });
  assert.deepEqual(s.hands, [
    ['fire-1', 'fire-5'],
    ['fire-2', 'fire-6'],
    ['fire-3', 'fire-7'],
    ['fire-4', 'fire-8'],
  ]);
  assert.equal(s.trumpCard, 'fire-9');
  assert.equal(s.trump, 'fire');
  assert.deepEqual(
    { players: s.players, round: s.round, dealer: s.dealer, phase: s.phase, turn: s.turn },
    { players: 4, round: 2, dealer: 3, phase: 'bid', turn: 0 },
  );
  assert.deepEqual(s.bids, [null, null, null, null]);
  assert.deepEqual(s.won, [0, 0, 0, 0]);
  assert.deepEqual(s.trick, { lead: 0, cards: [] });
  assert.deepEqual(s.tricks, []);
  assert.equal(s.points, null);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('every round of every table size: r cards each, sorted, none twice; the last round deals all 60 and has no trump', () => {
  for (const players of [3, 4, 5, 6]) {
    const last = roundsFor(players);
    for (let round = 1; round <= last; round++) {
      const s = deal({ players, round, dealer: round % players, randomInt: seeded(round * 10 + players) });
      assert.equal(s.hands.length, players);
      for (const h of s.hands) {
        assert.equal(h.length, round);
        assert.deepEqual(h, sortHand(h, s.trump));
      }
      const all = [...s.hands.flat(), ...(s.trumpCard ? [s.trumpCard] : [])];
      assert.equal(new Set(all).size, all.length);
      if (round === last) {
        assert.equal(s.trumpCard, null);
        assert.equal(s.trump, null);
        assert.equal(s.phase, 'bid');
        assert.deepEqual([...s.hands.flat()].sort(), [...DECK].sort());
      } else {
        assert.ok(DECK.includes(s.trumpCard));
        const turned = parseCard(s.trumpCard);
        assert.equal(s.trump, turned.k === 'num' ? turned.s : null);
        assert.equal(s.phase, turned.k === 'z' ? 'trump' : 'bid');
      }
    }
  }
  // 4 players, round 15: every card in a hand.
  const s = deal({ players: 4, round: 15, dealer: 0, randomInt: seeded(3) });
  assert.equal(s.trumpCard, null);
  assert.equal(s.hands.flat().length, 60);
});

test('a turned Wizard: the dealer picks trump first; a turned Jester: no trump', () => {
  const hands = [['fire-1'], ['water-2'], ['earth-3']];
  const w = deal({ players: 3, round: 1, dealer: 1, hands, trumpCard: 'z-fire' });
  assert.equal(w.phase, 'trump');
  assert.equal(w.turn, 1);
  assert.equal(w.trump, null);
  throws(() => bid(w, 2, 0), 'phase');

  const j = deal({ players: 3, round: 1, dealer: 1, hands, trumpCard: 'n-air' });
  assert.equal(j.phase, 'bid');
  assert.equal(j.trump, null);
  assert.equal(j.turn, 2);
});

test('the same seed deals the same round; another seed another', () => {
  const a = deal({ players: 5, round: 7, dealer: 2, randomInt: seeded(42) });
  const b = deal({ players: 5, round: 7, dealer: 2, randomInt: seeded(42) });
  const c = deal({ players: 5, round: 7, dealer: 2, randomInt: seeded(43) });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.hands, c.hands);
});

test('a fixed deal is sorted too, and checked', () => {
  const s = deal({ players: 3, round: 2, dealer: 0, hands: [['n-air', 'fire-3'], ['water-2', 'z-air'], ['earth-9', 'earth-1']], trumpCard: 'water-7' });
  assert.deepEqual(s.hands, [['fire-3', 'n-air'], ['z-air', 'water-2'], ['earth-1', 'earth-9']]);
  assert.equal(s.trump, 'water');
  assert.equal(s.turn, 1);

  const ok = { players: 3, round: 1, dealer: 0, hands: [['fire-1'], ['fire-2'], ['fire-3']], trumpCard: 'fire-4' };
  throws(() => deal({ ...ok, hands: [['fire-1'], ['fire-2']] }), 'round');
  throws(() => deal({ ...ok, hands: [['fire-1'], ['fire-2'], ['fire-3', 'fire-5']] }), 'round');
  throws(() => deal({ ...ok, hands: [['fire-1'], ['fire-1'], ['fire-3']] }), 'card');
  throws(() => deal({ ...ok, trumpCard: 'fire-3' }), 'card');
  throws(() => deal({ ...ok, hands: [['fire-1'], ['fire-2'], ['fire-99']] }), 'card');
});

test('deal refuses a table size, round or dealer that does not fit', () => {
  const randomInt = seeded(1);
  throws(() => deal({ players: 2, round: 1, dealer: 0, randomInt }), 'players');
  throws(() => deal({ players: 7, round: 1, dealer: 0, randomInt }), 'players');
  throws(() => deal({ players: 4, round: 0, dealer: 0, randomInt }), 'round');
  throws(() => deal({ players: 4, round: 16, dealer: 0, randomInt }), 'round');
  throws(() => deal({ players: 4, round: 1.5, dealer: 0, randomInt }), 'round');
  throws(() => deal({ players: 4, round: 1, dealer: 4, randomInt }), 'players');
  throws(() => deal({ players: 4, round: 1, dealer: -1, randomInt }), 'players');
  assert.throws(() => deal({ players: 4, round: 1, dealer: 0 }), TypeError);
});

// ---- trump and bids ---------------------------------------------------------------------------

test('pickTrump: only the dealer, only after a turned Wizard; then the bids start left of the dealer', () => {
  const hands = [['fire-4', 'air-9', 'z-water'], ['earth-2', 'air-1', 'n-fire'], ['water-13', 'fire-12', 'air-3']];
  const s = deal({ players: 3, round: 3, dealer: 0, hands, trumpCard: 'z-earth' });
  throws(() => pickTrump(s, 1, 'air'), 'not-dealer');
  throws(() => pickTrump(s, 0, 'gold'), 'suit');
  throws(() => pickTrump(s, 0, null), 'suit');
  assert.equal(s.phase, 'trump');
  pickTrump(s, 0, 'air');
  assert.equal(s.trump, 'air');
  assert.equal(s.phase, 'bid');
  assert.equal(s.turn, 1);
  // The hands are sorted again, the new trump first.
  assert.deepEqual(s.hands[0], ['z-water', 'air-9', 'fire-4']);
  assert.deepEqual(s.hands[2], ['air-3', 'fire-12', 'water-13']);
  throws(() => pickTrump(s, 0, 'fire'), 'phase');

  const plain = deal({ players: 3, round: 1, dealer: 0, randomInt: inOrder });
  throws(() => pickTrump(plain, 0, 'fire'), 'phase');
});

test('bids go round from the seat left of the dealer; the last one starts play with that seat leading', () => {
  const s = deal({ players: 4, round: 3, dealer: 2, randomInt: seeded(5) });
  if (s.phase === 'trump') pickTrump(s, 2, 'fire');
  assert.equal(s.turn, 3);
  throws(() => bid(s, 0, 1), 'turn');
  bid(s, 3, 1);
  assert.equal(s.turn, 0);
  bid(s, 0, 0);
  bid(s, 1, 3);
  assert.equal(s.phase, 'bid');
  assert.equal(s.turn, 2);
  bid(s, 2, 3); // any total is allowed: 7 bid for 3 tricks
  assert.deepEqual(s.bids, [0, 3, 3, 1]);
  assert.equal(s.phase, 'play');
  assert.equal(s.turn, 3);
  assert.deepEqual(s.trick, { lead: 3, cards: [] });
  throws(() => bid(s, 3, 1), 'phase');
});

test('the dealer in the last seat: the first bidder and leader is seat 0', () => {
  const s = deal({ players: 5, round: 1, dealer: 4, randomInt: seeded(8) });
  if (s.phase === 'trump') pickTrump(s, 4, 'water');
  assert.equal(s.turn, 0);
  for (const seat of [0, 1, 2, 3, 4]) bid(s, seat, 0);
  assert.equal(s.phase, 'play');
  assert.equal(s.turn, 0);
  assert.equal(s.trick.lead, 0);
});

test('a bid is a whole number from 0 to the cards in hand', () => {
  const s = deal({ players: 3, round: 4, dealer: 2, hands: HANDS, trumpCard: 'earth-7' });
  for (const bad of [-1, 5, 1.5, '1', null, undefined, NaN]) throws(() => bid(s, 0, bad), 'bid');
  assert.equal(s.turn, 0);
  assert.deepEqual(s.bids, [null, null, null]);
  bid(s, 0, 0);
  bid(s, 1, 4);
  assert.deepEqual(s.bids, [0, 4, null]);
});

// ---- who takes the trick ------------------------------------------------------------------------

test('trick winner: the first Wizard, even after another Wizard', () => {
  assert.equal(trickWinner(trick('water-3', 'z-air', 'z-fire', 'water-13'), 'fire'), 1);
  assert.equal(trickWinner(trick('z-earth', 'fire-13'), 'fire'), 0);
  assert.equal(trickWinner(trick('n-earth', 'fire-13', 'z-water'), 'fire'), 2);
});

test('trick winner: the highest trump beats a led 13', () => {
  assert.equal(trickWinner(trick('water-13', 'fire-2', 'water-12'), 'fire'), 1);
  assert.equal(trickWinner(trick('water-13', 'fire-2', 'fire-9'), 'fire'), 2);
  assert.equal(trickWinner(trick('fire-3', 'fire-10', 'water-13'), 'fire'), 1);
});

test('trick winner: without trumps the highest of the suit led; another suit never wins', () => {
  assert.equal(trickWinner(trick('water-5', 'water-11', 'air-13', 'water-9'), 'fire'), 1);
  assert.equal(trickWinner(trick('water-5', 'air-13', 'earth-12'), 'fire'), 0);
  assert.equal(trickWinner(trick('earth-2', 'fire-13', 'earth-3'), null), 2);
  assert.equal(trickWinner(trick('water-2', 'n-air'), 'fire'), 0);
  assert.equal(trickWinner(trick('air-7'), 'fire'), 0);
});

test('trick winner: only Jesters, the first one; a Jester led, the first number card sets the suit', () => {
  assert.equal(trickWinner(trick('n-fire', 'n-water', 'n-earth'), 'fire'), 0);
  assert.equal(trickWinner(trick('n-fire', 'n-water', 'n-earth', 'n-air'), null), 0);
  assert.equal(trickWinner(trick('n-fire', 'air-4', 'air-9', 'water-13'), null), 2);
  assert.equal(trickWinner(trick('n-earth', 'n-air', 'water-2'), 'fire'), 2);
  assert.equal(trickWinner(trick('n-earth', 'water-2', 'earth-13', 'fire-1'), 'fire'), 3);
  assert.equal(trickWinner(trick('n-fire', 'z-water', 'fire-13'), 'fire'), 1);
  assert.equal(trickWinner([], 'fire'), -1);
});

// ---- following suit ---------------------------------------------------------------------------

test('suitToFollow: the first number card, unless a Wizard came first; nothing for only Jesters', () => {
  assert.equal(suitToFollow([]), null);
  assert.equal(suitToFollow(trick('water-5')), 'water');
  assert.equal(suitToFollow(trick('water-5', 'fire-13', 'z-air')), 'water');
  assert.equal(suitToFollow(trick('z-fire', 'water-5')), null);
  assert.equal(suitToFollow(trick('n-fire')), null);
  assert.equal(suitToFollow(trick('n-fire', 'n-air')), null);
  assert.equal(suitToFollow(trick('n-fire', 'n-air', 'earth-2')), 'earth');
  assert.equal(suitToFollow(trick('n-fire', 'z-air', 'earth-2')), null);
});

test('follow suit if you can; a Wizard or a Jester always; void in the suit: anything', () => {
  const s = table(HANDS);
  assert.equal(s.turn, 0);
  assert.deepEqual(legalCards(s, 0), s.hands[0], 'the lead may be any card');
  assert.deepEqual(legalCards(s, 1), [], 'not their turn');
  play(s, 0, 'water-5');
  assert.deepEqual(legalCards(s, 1), ['z-fire', 'water-9', 'n-air']);
  throws(() => play(s, 1, 'air-7'), 'follow');
  play(s, 1, 'water-9');
  assert.deepEqual(legalCards(s, 2), ['earth-3', 'fire-1', 'air-10', 'n-water'], 'no water: anything');
});

test('a Wizard led: anything goes', () => {
  const s = table(HANDS);
  play(s, 0, 'z-earth');
  assert.deepEqual(legalCards(s, 1), s.hands[1]);
  play(s, 1, 'air-7');
  assert.deepEqual(legalCards(s, 2), s.hands[2]);
});

test('a Jester led: the next card that is not a Jester sets the suit (a Wizard: anything)', () => {
  const s = table(HANDS);
  play(s, 0, 'n-fire');
  assert.deepEqual(legalCards(s, 1), s.hands[1], 'only a Jester so far: anything');
  play(s, 1, 'air-7');
  assert.deepEqual(legalCards(s, 2), ['air-10', 'n-water']);
  throws(() => play(s, 2, 'earth-3'), 'follow');

  const w = table(HANDS);
  play(w, 0, 'n-fire');
  play(w, 1, 'z-fire');
  assert.deepEqual(legalCards(w, 2), w.hands[2]);
});

// ---- playing ----------------------------------------------------------------------------------

test('play refuses the wrong phase, the wrong seat and a card not in hand, and changes nothing', () => {
  const fresh = deal({ players: 3, round: 4, dealer: 2, hands: HANDS, trumpCard: 'earth-7' });
  throws(() => play(fresh, 0, 'water-5'), 'phase');
  assert.deepEqual(legalCards(fresh, 0), []);

  const s = table(HANDS);
  throws(() => play(s, 1, 'water-9'), 'turn');
  throws(() => play(s, 0, 'water-9'), 'card');
  throws(() => play(s, 0, 'fire-13'), 'card');
  throws(() => play(s, 0, 'fire-99'), 'card');
  throws(() => play(s, 0, null), 'card');
  assert.equal(s.hands[0].length, 4);
  assert.deepEqual(s.trick.cards, []);
  assert.equal(s.turn, 0);
});

test('a full trick: decided, kept, counted, and its winner leads the next one', () => {
  const s = table(HANDS, { bids: [1, 1, 1] });
  assert.deepEqual(play(s, 0, 'water-5'), { trick: null, done: false });
  assert.equal(s.turn, 1);
  play(s, 1, 'water-9');
  const r = play(s, 2, 'earth-3'); // void in water: trumps it
  assert.equal(r.done, false);
  assert.deepEqual(r.trick, {
    lead: 0,
    cards: [
      { seat: 0, card: 'water-5' },
      { seat: 1, card: 'water-9' },
      { seat: 2, card: 'earth-3' },
    ],
    winner: 2,
  });
  assert.deepEqual(s.tricks, [r.trick]);
  assert.deepEqual(s.won, [0, 0, 1]);
  assert.equal(s.turn, 2);
  assert.deepEqual(s.trick, { lead: 2, cards: [] });
  assert.deepEqual(s.hands.map((h) => h.length), [3, 3, 3]);
  assert.deepEqual(legalCards(s, 2), s.hands[2]);
});

test('a whole round to the end: done, and scored', () => {
  // Earth is trump. Seat 0 bids 0, seat 1 bids 2, seat 2 bids 1.
  const s = table(
    [
      ['water-3', 'fire-2'],
      ['water-13', 'z-air'],
      ['n-earth', 'earth-1'],
    ],
    { bids: [0, 2, 1] },
  );
  play(s, 0, 'water-3');
  assert.deepEqual(legalCards(s, 1), ['z-air', 'water-13']);
  play(s, 1, 'water-13');
  const first = play(s, 2, 'n-earth');
  assert.equal(first.trick.winner, 1);
  assert.equal(s.turn, 1);
  play(s, 1, 'z-air');
  play(s, 2, 'earth-1');
  const end = play(s, 0, 'fire-2');
  assert.equal(end.done, true);
  assert.equal(end.trick.winner, 1);
  assert.equal(end.trick.lead, 1);
  assert.equal(s.phase, 'done');
  assert.deepEqual(s.won, [0, 2, 0]);
  assert.deepEqual(s.points, [20, 40, -10]);
  assert.equal(s.tricks.length, 2);
  throws(() => play(s, 1, 'fire-2'), 'phase');
  assert.deepEqual(legalCards(s, 1), []);
});

test('scoring: met, 20 plus 10 a trick; missed, minus 10 a trick off', () => {
  assert.deepEqual(scoreRound([0, 2, 3, 1], [0, 2, 1, 3]), [20, 40, -20, -20]);
  assert.deepEqual(scoreRound([0, 5], [1, 5]), [-10, 70]);
});

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

// ---- house rules (R2) --------------------------------------------------------------------

test("uneven: the dealer, bidding last, mayn't make the bids add up to the cards", () => {
  const s = deal({ players: 3, round: 3, dealer: 0, hands: [['fire-1', 'fire-2', 'fire-3'], ['water-1', 'water-2', 'water-3'], ['earth-1', 'earth-2', 'earth-3']], trumpCard: 'air-5', bidding: 'uneven' });
  assert.equal(forbiddenBid(s, 1), null);
  bid(s, 1, 1);
  bid(s, 2, 1);
  // 1 + 1 + 1 would be 3, the cards dealt.
  assert.equal(forbiddenBid(s, 0), 1);
  assert.throws(() => bid(s, 0, 1), (e) => e instanceof RuleError && e.code === 'uneven');
  bid(s, 0, 2);
  assert.equal(s.phase, 'play');
  assert.deepEqual(s.bids, [2, 1, 1]);
});

test('uneven: nothing is forbidden when the others already bid past the cards', () => {
  const s = deal({ players: 3, round: 1, dealer: 0, hands: [['fire-1'], ['water-1'], ['earth-1']], trumpCard: 'air-5', bidding: 'uneven' });
  bid(s, 1, 1);
  bid(s, 2, 1);
  assert.equal(forbiddenBid(s, 0), null);
  bid(s, 0, 0);
  assert.equal(s.phase, 'play');
});

test('open bids keep the original: any total, in turn', () => {
  const s = deal({ players: 3, round: 1, dealer: 0, hands: [['fire-1'], ['water-1'], ['earth-1']], trumpCard: 'air-5' });
  assert.equal(s.bidding, 'open');
  bid(s, 1, 0);
  bid(s, 2, 0);
  assert.equal(forbiddenBid(s, 0), null);
  bid(s, 0, 1);
  assert.equal(s.phase, 'play');
});

test('secret: everyone bids at once, in any order; the first trick is led left of the dealer', () => {
  const s = deal({ players: 4, round: 2, dealer: 1, hands: [['fire-1', 'fire-2'], ['water-1', 'water-2'], ['earth-1', 'earth-2'], ['air-1', 'air-2']], trumpCard: 'fire-9', bidding: 'secret' });
  assert.deepEqual(bidders(s), [0, 1, 2, 3]);
  bid(s, 3, 1);
  bid(s, 0, 0);
  assert.deepEqual(bidders(s), [1, 2]);
  assert.throws(() => bid(s, 3, 2), (e) => e.code === 'turn');
  bid(s, 1, 2);
  bid(s, 2, 0);
  assert.equal(s.phase, 'play');
  assert.equal(s.turn, 2);
  assert.equal(s.trick.lead, 2);
});

test('a bidding mode the rules do not know is refused', () => {
  assert.throws(() => deal({ players: 3, round: 1, dealer: 0, randomInt: () => 0, bidding: 'loud' }), (e) => e.code === 'bidding');
});
