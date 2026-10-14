import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botBid, botBidForehead, botPlay, botTrump } from '../server/bots.mjs';
import { DECK, SUITS, bid, deal, forbiddenBid, legalCards, pickTrump, play, roundsFor } from '../server/rules.mjs';

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

test('botBid: Wizards and high trumps count, Jesters and low cards do not', () => {
  // Earth is trump (the turned earth-7).
  assert.equal(botBid(holding(1, ['z-fire', 'z-water', 'earth-13']), 1), 3);
  assert.equal(botBid(holding(1, ['n-fire', 'fire-2', 'water-3']), 1), 0);
  assert.equal(botBid(holding(2, ['z-air', 'n-water', 'air-4']), 2), 1);
  assert.equal(botBid(holding(0, ['z-fire']), 0), 1);
  assert.equal(botBid(holding(0, ['n-fire']), 0), 0);
  // All four Wizards: all four tricks.
  assert.equal(botBid(holding(0, ['z-fire', 'z-water', 'z-earth', 'z-air'], { players: 3 }), 0), 4);
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

test('botTrump: the suit the hand is strongest in', () => {
  const wizard = { trumpCard: 'z-earth' };
  assert.equal(botTrump(holding(0, ['air-13', 'air-11', 'air-4', 'fire-2', 'water-9', 'z-water'], wizard), 0), 'air');
  // Four low earth cards beat one high water card.
  assert.equal(botTrump(holding(0, ['earth-2', 'earth-3', 'earth-5', 'earth-6', 'water-13'], wizard), 0), 'earth');
  // Same length: the higher cards.
  assert.equal(botTrump(holding(0, ['fire-2', 'fire-3', 'water-12', 'water-11'], wizard), 0), 'water');
  // A tie: the earlier suit.
  assert.equal(botTrump(holding(0, ['water-5', 'air-5'], wizard), 0), 'water');
  // Nothing but Wizards and Jesters: still a suit.
  assert.ok(SUITS.includes(botTrump(holding(0, ['z-fire', 'n-air'], wizard), 0)));
});

test('enough tricks: the bot ducks under the winner with its highest card that loses', () => {
  const s = at(
    [
      ['water-10', 'air-1', 'air-2', 'air-3'],
      ['water-12', 'water-8', 'water-3', 'fire-13'],
      ['earth-1', 'earth-2', 'earth-3', 'earth-4'],
    ],
    { bids: [1, 0, 1], played: ['water-10'] },
  );
  assert.equal(botPlay(s, 1), 'water-8');
});

test('enough tricks: a Wizard after a Wizard is shed (it cannot win any more)', () => {
  const s = at(
    [
      ['z-air', 'air-1', 'air-2', 'air-3'],
      ['z-water', 'water-3', 'fire-13', 'n-fire'],
      ['earth-1', 'earth-2', 'earth-3', 'earth-4'],
    ],
    { bids: [1, 0, 1], played: ['z-air'] },
  );
  assert.equal(botPlay(s, 1), 'z-water');
});

test('enough tricks but every card wins: last to play sheds the most dangerous one, otherwise the cheapest', () => {
  const hands = [
    ['water-2', 'air-1', 'air-2', 'air-3'],
    ['water-3', 'earth-1', 'earth-2', 'earth-3'],
    ['water-9', 'water-13', 'z-air', 'fire-1'],
  ];
  const last = at(hands, { bids: [1, 1, 0], played: ['water-2', 'water-3'] });
  assert.equal(botPlay(last, 2), 'z-air');

  const middle = at([hands[0], hands[2], hands[1]], { bids: [1, 0, 1], played: ['water-2'] });
  assert.equal(botPlay(middle, 1), 'water-9');
});

test('needs a trick and plays last: takes it with the cheapest card that wins', () => {
  const lead = ['water-10', 'air-1', 'air-2', 'air-3'];
  const second = ['water-12', 'earth-1', 'earth-2', 'earth-3'];
  // Must follow water: the 13 takes it, the Wizard stays in hand.
  const follow = at([lead, second, ['water-13', 'z-air', 'water-2', 'air-13']], {
    bids: [0, 0, 1],
    played: ['water-10', 'water-12'],
  });
  assert.equal(botPlay(follow, 2), 'water-13');
  // No water: the lowest trump that wins.
  const trumping = at([lead, second, ['fire-3', 'fire-12', 'z-air', 'earth-5']], {
    bids: [0, 0, 1],
    played: ['water-10', 'water-12'],
  });
  assert.equal(botPlay(trumping, 2), 'fire-3');
});

test('needs a trick with players still to come: a solid card, not one that only just wins', () => {
  const s = at(
    [
      ['water-2', 'air-1', 'air-2', 'air-3'],
      ['water-3', 'water-13', 'z-fire', 'earth-4'],
      ['earth-1', 'earth-2', 'earth-3', 'water-11'],
    ],
    { bids: [0, 1, 0], played: ['water-2'] },
  );
  assert.equal(botPlay(s, 1), 'water-13');
});

test('needs a trick but cannot win this one: throws a Jester, else its lowest card off trump', () => {
  const others = [
    ['z-earth', 'earth-9', 'earth-10', 'earth-11'],
    ['earth-1', 'earth-2', 'earth-3', 'earth-4'],
  ];
  const jester = at([others[0], ['n-water', 'water-2', 'fire-13', 'air-9'], others[1]], { bids: [1, 1, 1], played: ['z-earth'] });
  assert.equal(botPlay(jester, 1), 'n-water');
  // Two 2s: the one from the shorter suit, to be void in it sooner.
  const low = at([others[0], ['air-2', 'water-2', 'air-9', 'fire-13'], others[1]], { bids: [1, 1, 1], played: ['z-earth'] });
  assert.equal(botPlay(low, 1), 'water-2');
});

test('leading: a Wizard or a high trump when tricks are needed; a low card or a Jester when not', () => {
  const rest = [
    ['earth-1', 'earth-2', 'earth-3', 'earth-4'],
    ['earth-5', 'earth-6', 'earth-7', 'earth-8'],
  ];
  const lead = (hand, b) => botPlay(at([hand, ...rest], { bids: [b, 0, 0] }), 0);
  assert.equal(lead(['z-fire', 'fire-13', 'water-2', 'n-air'], 2), 'z-fire');
  assert.equal(lead(['fire-13', 'fire-4', 'water-12', 'water-2'], 2), 'fire-13');
  assert.equal(lead(['fire-4', 'water-12', 'water-2', 'n-air'], 1), 'water-12');
  assert.equal(lead(['z-fire', 'water-12', 'water-2', 'n-air'], 0), 'water-2');
  assert.equal(lead(['z-fire', 'water-12', 'air-11', 'n-air'], 0), 'n-air');
  assert.equal(lead(['z-fire', 'fire-9', 'water-12', 'air-11'], 0), 'air-11');
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

test('the forehead round: a bot bids from the others\' cards, never its own', () => {
  // Three seats, the bot in seat 2; the others hold their cards up. Seat 0 leads (left of dealer 2).
  const base = deal({ players: 3, round: 1, dealer: 2, hands: [['z-fire'], ['water-3'], ['earth-13']], trumpCard: 'earth-5' });
  // A Wizard on someone's forehead, played before it: nothing it holds can take the trick.
  assert.equal(botBidForehead(base, 2), 0);
  // Two Jesters before it: almost anything it might hold takes the trick.
  const weak = deal({ players: 3, round: 1, dealer: 2, hands: [['n-fire'], ['n-water'], ['air-1']], trumpCard: 'earth-5' });
  assert.equal(botBidForehead(weak, 2), 1);
  // Its own card doesn't change the bid: it can't see it.
  const same = deal({ players: 3, round: 1, dealer: 2, hands: [['n-fire'], ['n-water'], ['z-air']], trumpCard: 'earth-5' });
  assert.equal(botBidForehead(same, 2), botBidForehead(weak, 2));
});
