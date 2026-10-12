// The rules of Wizard (Amigo's original game, nothing from the expansions) as a pure state machine.
// No I/O, no clock and no randomness of its own: the game layer (server/game.mjs) owns a round's state,
// passes it in and streams each seat its own view; tests deal fixed hands or pass a seeded randomInt.
// Nothing here needs Node, so the page may import it too (to mark the cards it may play).
//
// A game is roundsFor(players) rounds; round r deals r cards to each seat, the dealer moves one seat
// on each round. A round's phases: trump (only when the turned card is a Wizard: the dealer picks the
// suit) → bid → play → done.
//
// Cards are strings, here and on the wire: "fire-7" (a suit and a value 1–13), "z-water" (a Wizard),
// "n-earth" (a Jester, "Narr"). A Wizard's or a Jester's element is only its look: the four of each
// behave the same.

export class RuleError extends Error {
  /** @param {string} code */
  constructor(code) {
    super(code);
    this.name = 'RuleError';
    this.code = code;
  }
}

/** The four suits, named after the elements, in the order they're sorted and dealt from the box. */
export const SUITS = Object.freeze(['fire', 'water', 'earth', 'air']);

/** All 60 cards: fire 1–13, water, earth, air, then the four Wizards, then the four Jesters. */
export const DECK = Object.freeze([
  ...SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => `${s}-${i + 1}`)),
  ...SUITS.map((s) => `z-${s}`),
  ...SUITS.map((s) => `n-${s}`),
]);

const CARD = /^(?:(fire|water|earth|air)-(1[0-3]|[1-9])|([zn])-(fire|water|earth|air))$/;

/**
 * How the bids go (a house rule, R2): `open` is the original (in turn, any total); `uneven` the same,
 * but the last bidder mayn't make the bids add up to the cards, so someone always misses; `secret`
 * everyone at once, unseen until all are in (the game's views hide them).
 * @typedef {'open' | 'uneven' | 'secret'} Bidding
 */
export const BIDDINGS = Object.freeze(['open', 'uneven', 'secret']);

/**
 * @typedef {{ k: 'num', s: string, v: number } | { k: 'z', s: string } | { k: 'n', s: string }} Card
 * @typedef {{ seat: number, card: string }} Played
 * @typedef {{ lead: number, cards: Played[] }} Trick
 * @typedef {{
 *   players: number, round: number, dealer: number,
 *   hands: string[][], trumpCard: string | null, trump: string | null,
 *   phase: 'trump' | 'bid' | 'play' | 'done', turn: number,
 *   bidding: Bidding, bids: (number | null)[], won: number[],
 *   trick: Trick, tricks: (Trick & { winner: number })[],
 *   points: number[] | null,
 * }} RoundState
 */

/** @param {unknown} id  @returns {Card} */
export function parseCard(id) {
  const m = typeof id === 'string' ? CARD.exec(id) : null;
  if (!m) throw new RuleError('card');
  if (m[1]) return { k: 'num', s: m[1], v: Number(m[2]) };
  return { k: /** @type {'z' | 'n'} */ (m[3]), s: m[4] };
}

/** @param {unknown} id */
export function isWizard(id) {
  return typeof id === 'string' && CARD.test(id) && id.startsWith('z-');
}

/** @param {unknown} id */
export function isJester(id) {
  return typeof id === 'string' && CARD.test(id) && id.startsWith('n-');
}

/** Rounds in a game: every card is dealt in the last one. */
export function roundsFor(players) {
  if (!Number.isInteger(players) || players < 3 || players > 6) throw new RuleError('players');
  return DECK.length / players;
}

/**
 * Fisher–Yates. Returns a new array.
 * @template T  @param {readonly T[]} cards  @param {(n: number) => number} randomInt 0..n-1
 */
export function shuffled(cards, randomInt) {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A hand in the order it's held: Wizards, the trump suit, the other suits in SUITS order (each
 * ascending), Jesters last. Returns a new array.
 * @param {readonly string[]} hand  @param {string | null} [trump]
 */
export function sortHand(hand, trump = null) {
  const order = trump ? [trump, ...SUITS.filter((s) => s !== trump)] : SUITS;
  /** @param {string} id */
  const key = (id) => {
    const c = parseCard(id);
    if (c.k === 'z') return SUITS.indexOf(c.s);
    if (c.k === 'n') return 1000 + SUITS.indexOf(c.s);
    return 100 + order.indexOf(c.s) * 20 + c.v;
  };
  return [...hand].sort((a, b) => key(a) - key(b));
}

const nextSeat = (seat, players) => (seat + 1) % players;

/**
 * Deals round `round` for `players` seats with `dealer`, as a fresh round state (plain JSON).
 * randomInt(n) returns 0..n-1. For tests, `hands` (per seat) and `trumpCard` instead of randomInt
 * give a fixed deal.
 * @param {{ players: number, round: number, dealer: number, randomInt?: (n: number) => number,
 *   hands?: string[][], trumpCard?: string | null, bidding?: Bidding }} options
 * @returns {RoundState}
 */
export function deal({ players, round, dealer, randomInt, hands: fixed, trumpCard: fixedTrump, bidding = 'open' }) {
  if (!BIDDINGS.includes(bidding)) throw new RuleError('bidding');
  const rounds = roundsFor(players);
  if (!Number.isInteger(round) || round < 1 || round > rounds) throw new RuleError('round');
  // A dealer who isn't a seat at this table.
  if (!Number.isInteger(dealer) || dealer < 0 || dealer >= players) throw new RuleError('players');

  /** @type {string[][]} */
  let hands;
  /** @type {string | null} */
  let trumpCard;
  if (fixed) {
    ({ hands, trumpCard } = fixedDeal(fixed, fixedTrump ?? null, players, round));
  } else {
    if (typeof randomInt !== 'function') throw new TypeError('deal needs randomInt or hands');
    const deck = shuffled(DECK, randomInt);
    hands = Array.from({ length: players }, () => []);
    // One card at a time, starting left of the dealer.
    for (let i = 0; i < players * round; i++) hands[(dealer + 1 + i) % players].push(deck[i]);
    // The next card turns up; the last round deals every card, so there's none.
    trumpCard = deck[players * round] ?? null;
  }

  const turned = trumpCard ? parseCard(trumpCard) : null;
  // A number card: its suit. A Jester (or no card): no trump. A Wizard: the dealer picks.
  const trump = turned?.k === 'num' ? turned.s : null;
  const pick = turned?.k === 'z';
  const left = nextSeat(dealer, players);
  return {
    players,
    round,
    dealer,
    hands: hands.map((h) => sortHand(h, trump)),
    trumpCard,
    trump,
    phase: pick ? 'trump' : 'bid',
    turn: pick ? dealer : left,
    bidding,
    bids: Array(players).fill(null),
    won: Array(players).fill(0),
    trick: { lead: left, cards: [] },
    tricks: [],
    points: null,
  };
}

/** A test's fixed deal: the right number of hands and cards, real cards, none twice. */
function fixedDeal(hands, trumpCard, players, round) {
  if (!Array.isArray(hands) || hands.length !== players) throw new RuleError('round');
  if (hands.some((h) => !Array.isArray(h) || h.length !== round)) throw new RuleError('round');
  const all = [...hands.flat(), ...(trumpCard === null ? [] : [trumpCard])];
  for (const id of all) parseCard(id);
  // In the last round every card is in a hand, so a turned card would be one of them.
  if (new Set(all).size !== all.length) throw new RuleError('card');
  return { hands: hands.map((h) => [...h]), trumpCard };
}

/** After a turned Wizard: the dealer names the trump suit, having seen their hand. */
export function pickTrump(state, seat, suit) {
  if (state.phase !== 'trump') throw new RuleError('phase');
  if (seat !== state.dealer) throw new RuleError('not-dealer');
  if (!SUITS.includes(suit)) throw new RuleError('suit');
  state.trump = suit;
  state.hands = state.hands.map((h) => sortHand(h, suit));
  state.phase = 'bid';
  state.turn = nextSeat(state.dealer, state.players);
}

/** Whose bid is awaited: the one in turn, or with secret bids everyone who hasn't bid yet. */
export function bidders(state) {
  if (state.phase !== 'bid') return [];
  if (state.bidding === 'secret') return state.bids.flatMap((b, seat) => (b === null ? [seat] : []));
  return [state.turn];
}

/**
 * The one bid `seat` mayn't make with the "mustn't add up" rule: as the last to bid, the number that
 * would make all bids equal the cards dealt. Null when there's none (another rule, not the last
 * bidder, or the number is out of reach).
 */
export function forbiddenBid(state, seat) {
  if (state.bidding !== 'uneven' || state.phase !== 'bid') return null;
  const others = state.bids.filter((b, i) => i !== seat);
  if (others.some((b) => b === null)) return null;
  const n = state.round - others.reduce((sum, b) => sum + b, 0);
  return n >= 0 && n <= state.round ? n : null;
}

/** A seat's bid: 0 up to the cards in hand; with `uneven`, never the number that makes it add up. */
export function bid(state, seat, n) {
  if (state.phase !== 'bid') throw new RuleError('phase');
  if (!bidders(state).includes(seat)) throw new RuleError('turn');
  if (!Number.isInteger(n) || n < 0 || n > state.round) throw new RuleError('bid');
  if (n === forbiddenBid(state, seat)) throw new RuleError('uneven');
  state.bids[seat] = n;
  const left = nextSeat(state.dealer, state.players);
  state.turn = state.bidding === 'secret' ? left : nextSeat(seat, state.players);
  // Everyone has bid (back to the first bidder, or the last secret bid is in): they lead the first trick.
  if (state.bids.every((b) => b !== null)) {
    state.phase = 'play';
    state.turn = left;
    state.trick = { lead: left, cards: [] };
  }
}

/**
 * The suit the next card must follow, or null: nothing played yet, only Jesters so far, or a
 * Wizard set the tone (led, or the first card after the Jesters).
 * @param {readonly Played[]} cards
 */
export function suitToFollow(cards) {
  for (const { card } of cards) {
    const c = parseCard(card);
    if (c.k === 'n') continue;
    return c.k === 'num' ? c.s : null;
  }
  return null;
}

/**
 * The cards `seat` may play now: its hand's cards of the suit to follow plus its Wizards and
 * Jesters, or its whole hand when there's nothing to follow or it has none of that suit. Empty when
 * it's not that seat's turn to play.
 * @param {RoundState} state  @param {number} seat
 */
export function legalCards(state, seat) {
  if (state.phase !== 'play' || seat !== state.turn) return [];
  const hand = state.hands[seat];
  const suit = suitToFollow(state.trick.cards);
  if (!suit) return [...hand];
  const ofSuit = (id) => {
    const c = parseCard(id);
    return c.k === 'num' && c.s === suit;
  };
  if (!hand.some(ofSuit)) return [...hand];
  return hand.filter((id) => ofSuit(id) || isWizard(id) || isJester(id));
}

/**
 * Which entry of a trick (in play order) takes it, as an index into `cards`: the first Wizard;
 * else the highest trump; else the highest card of the suit led. Only Jesters: the first Jester.
 * -1 for an empty trick.
 * @param {readonly Played[]} cards  @param {string | null} trump
 */
export function trickWinner(cards, trump) {
  if (!cards.length) return -1;
  const parsed = cards.map((p) => parseCard(p.card));
  const wizard = parsed.findIndex((c) => c.k === 'z');
  if (wizard >= 0) return wizard;
  // No Wizard, so the first card that isn't a Jester is a number card and sets the suit.
  const led = parsed.find((c) => c.k === 'num')?.s ?? null;
  /** @param {Card} c */
  const rank = (c) => (c.k !== 'num' ? 0 : c.s === trump ? 100 + c.v : c.s === led ? c.v : 0);
  // Jesters and other suits rank 0: with only Jesters, the first one stays the winner.
  let best = 0;
  for (let i = 1; i < parsed.length; i++) if (rank(parsed[i]) > rank(parsed[best])) best = i;
  return best;
}

/**
 * Plays a card. When the trick is full it's decided, kept in `tricks`, and its winner leads the
 * next one; when the hands are empty the round is done and scored.
 * @param {RoundState} state  @param {number} seat  @param {string} card
 * @returns {{ trick: (Trick & { winner: number }) | null, done: boolean }}
 */
export function play(state, seat, card) {
  if (state.phase !== 'play') throw new RuleError('phase');
  if (seat !== state.turn) throw new RuleError('turn');
  const hand = state.hands[seat];
  const at = hand.indexOf(card);
  if (at < 0) throw new RuleError('card');
  if (!legalCards(state, seat).includes(card)) throw new RuleError('follow');

  hand.splice(at, 1);
  state.trick.cards.push({ seat, card });
  if (state.trick.cards.length < state.players) {
    state.turn = nextSeat(seat, state.players);
    return { trick: null, done: false };
  }

  const winner = state.trick.cards[trickWinner(state.trick.cards, state.trump)].seat;
  const finished = { lead: state.trick.lead, cards: state.trick.cards, winner };
  state.tricks.push(finished);
  state.won[winner] += 1;
  state.trick = { lead: winner, cards: [] };
  state.turn = winner;
  const done = state.hands.every((h) => h.length === 0);
  if (done) {
    state.phase = 'done';
    state.points = scoreRound(state.bids, state.won);
  }
  return { trick: finished, done };
}

/**
 * A round's points per seat: the bid met exactly, 20 plus 10 per trick; missed, minus 10 per trick
 * over or under.
 * @param {readonly (number | null)[]} bids  @param {readonly number[]} won
 */
export function scoreRound(bids, won) {
  return bids.map((b, i) => {
    const want = b ?? 0;
    return want === won[i] ? 20 + 10 * want : -10 * Math.abs(won[i] - want);
  });
}
