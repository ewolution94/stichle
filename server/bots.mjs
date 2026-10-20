// Bots: they fill a table for trying the game alone, and play for someone who's away. Three ranks,
// as in a guild (the user, 2026-10-14), and each bot a temperament of its own:
//
//   apprentice  today's rules with small, human slips: a bid off by a trick now and then; now and
//               then the wrong one of two cards that do the same job (never a Wizard thrown away,
//               never a trick taken it meant to lose).
//   journeyman  the rules: a bid from Wizards, trumps and high cards, then play that tries to meet it
//               (take a trick as cheaply as is safe while it still needs one, duck under the winner
//               once it has enough), counting the cards: a card nothing unseen can beat is a sure one.
//   master      deals out the cards it can't see, many times over (as they could lie, given who
//               couldn't follow suit), plays each card it might play to the end of the round in all
//               of them with the journeyman's rules, and plays the one that scores best on average;
//               it chooses its bid the same way, among the journeyman's and its neighbours.
//
// A temperament (cautious, steady, bold) moves every bid a little down or up. No bot ever reads a
// hand but its own: what they know is what that seat sees (tests/bots.sim.mjs → "honest").
//
// Pure functions over a round state from rules.mjs, deterministic: the same state gives the same
// move (a slip or a sample draws from a generator seeded by the position). Equal cards (two off-suit
// 9s) go from the shorter suit first, to make a void sooner.

import { RuleError, SUITS, deckFor, forbiddenBid, isJester, isWizard, legalCards, parseCard, play, scoreRound, suitToFollow, trickWinner } from './rules.mjs';

/** The ranks, weakest first, and the temperaments. */
export const LEVELS = Object.freeze(['apprentice', 'journeyman', 'master']);
export const TEMPERS = Object.freeze(['cautious', 'steady', 'bold']);
/** How far a temperament moves a bid's estimate, in tricks. */
const LEAN = { cautious: -0.3, steady: 0, bold: 0.3 };

/** @typedef {{ level?: string, temper?: string }} Style */

/** @typedef {import('./rules.mjs').RoundState} RoundState */

/** How much a card is worth keeping: Wizards, then trumps, then the rest by value, Jesters last. */
function strength(id, trump) {
  const c = parseCard(id);
  // The special cards: the Drache above everything; the Fee and the Dieb as cheap as a Jester.
  if (c.k === 'x') return c.name === 'dragon' ? 110 : 0;
  if (c.k === 'z') return 100;
  if (c.k === 'n') return 0;
  return c.s === trump ? 50 + c.v : c.v;
}

/** Likely to hold a trick with players still to come: a high trump, or a 12 or 13 of another suit. */
function solid(id, trump) {
  const c = parseCard(id);
  return c.k === 'num' && (c.s === trump ? c.v >= 10 : c.v >= 12);
}

/**
 * After a turned Wizard: the suit the dealer's hand is strongest in (every card counts, high ones
 * up to twice). A tie goes to the earlier suit.
 * @param {RoundState} state  @param {number} seat
 */
export function botTrump(state, seat) {
  /** @type {Record<string, number>} */
  const score = Object.fromEntries(SUITS.map((s) => [s, 0]));
  for (const id of state.hands[seat]) {
    const c = parseCard(id);
    if (c.k === 'num') score[c.s] += 1 + Math.max(0, c.v - 7) / 6;
  }
  return SUITS.reduce((best, s) => (score[s] > score[best] ? s : best), SUITS[0]);
}

/**
 * What a card is worth in tricks: a Wizard about one, trumps by value, another suit's 13 or 12 a
 * little (times offScale, which shrinks as hands grow: more players can trump it), a Jester nothing.
 */
function worth(id, trump, offScale) {
  const c = parseCard(id);
  // The Drache takes its trick unless the Fee comes to it; the Fee and the Dieb take none.
  if (c.k === 'x') return c.name === 'dragon' ? 0.95 : 0;
  if (c.k === 'z') return 1;
  if (c.k === 'n') return 0;
  if (c.s === trump) return c.v === 13 ? 0.9 : c.v >= 10 ? 0.7 : c.v >= 7 ? 0.35 : 0.15;
  // No trump: only a Wizard beats a 13, but its suit has to be led.
  if (!trump) return c.v === 13 ? 0.7 : c.v === 12 ? 0.35 : c.v === 11 ? 0.1 : 0;
  return (c.v === 13 ? 0.5 : c.v === 12 ? 0.3 : 0) * offScale;
}

/**
 * The tricks this hand should take, as a fraction: its cards' worth, scaled in long rounds.
 * @param {RoundState} state  @param {number} seat
 */
function estimate(state, seat, { beginner = false } = {}) {
  const { round, players, trump, trumpCard } = state;
  const hand = state.hands[seat];
  const offScale = trump ? 1 / (1 + ((round - 1) * players) / 20) : 1;
  const mine = hand.reduce((sum, id) => sum + worth(id, trump, offScale), 0);
  // In long rounds the values claim fewer tricks than there are, but every trick goes to someone
  // (with 3 players the bots underbid by about two). So guess what the other hands claim, from the
  // cards this seat can't see, and scale up so that all claims add up to the round.
  const seen = new Set(trumpCard ? [...hand, trumpCard] : hand);
  const unseen = deckFor(state.specials).filter((id) => !seen.has(id));
  const mean = unseen.reduce((sum, id) => sum + worth(id, trump, offScale), 0) / unseen.length;
  const claimed = mine + (players - 1) * round * mean;
  const scale = claimed > 0 ? Math.max(1, round / claimed) : 1;
  // A beginner counts the cards that look like tricks and doesn't see that every trick goes to
  // someone: in long rounds they bid low (half the scaling).
  return mine * (beginner ? 1 + (scale - 1) / 2 : scale);
}

/** An estimate made a bid: rounded, within 0..round, and never the forbidden number ("mustn't add up"). */
function settle(state, seat, expected) {
  const { round } = state;
  const n = Math.max(0, Math.min(round, Math.round(expected)));
  const no = forbiddenBid(state, seat);
  if (n !== no) return n;
  // The forbidden number is out: take the neighbour nearer to the estimate.
  const up = n + 1 <= round, down = n - 1 >= 0;
  return up && (!down || expected >= n) ? n + 1 : n - 1;
}

/**
 * The bid: the tricks this hand should take (a journeyman's estimate), leaned by temperament; an
 * apprentice's a little off now and then; a master's tried out (masterBid).
 * @param {RoundState} state  @param {number} seat  @param {Style} [style]
 */
export function botBid(state, seat, { level = 'journeyman', temper = 'steady' } = {}) {
  let expected = estimate(state, seat, { beginner: level === 'apprentice' }) + (LEAN[temper] ?? 0);
  if (level === 'apprentice') {
    // Most of a trick either way (a bell curve from three draws): more bids are off by one than not.
    const r = rngFor(state, seat, 'bid');
    expected += (r() + r() + r() - 1.5) * 1.7;
  }
  const n = settle(state, seat, expected);
  return level === 'master' ? masterBid(state, seat, n, temper) : n;
}

/**
 * The forehead round (R3, the one-card round played blind): the bot can't see its own card, only
 * the others'. Every card it might hold (any that isn't on a forehead or turned up) is tried against
 * them in play order from the lead; it bids one when it would take the trick with at least half.
 * The same at every rank: the count is exact.
 * @param {RoundState} state  @param {number} seat
 */
export function botBidForehead(state, seat) {
  const { players, trump, trumpCard, trick } = state;
  const others = state.hands.map((h, i) => (i === seat ? null : h[0]));
  const seen = new Set([...others.filter((id) => id !== null), ...(trumpCard ? [trumpCard] : [])]);
  const mine = deckFor(state.specials).filter((id) => !seen.has(id));
  let wins = 0;
  for (const id of mine) {
    const cards = Array.from({ length: players }, (_, k) => (trick.lead + k) % players).map((s) => ({ seat: s, card: s === seat ? id : others[s] }));
    // A trick with the Dieb in it is nobody's.
    if (!cards.some((p) => p.card === 'thief') && cards[trickWinner(cards, trump)].seat === seat) wins++;
  }
  const n = wins * 2 >= mine.length ? 1 : 0;
  return n === forbiddenBid(state, seat) ? 1 - n : n;
}

/**
 * A legal card for `seat`, whose turn it is to play.
 * @param {RoundState} state  @param {number} seat  @param {Style} [style]
 */
export function botPlay(state, seat, { level = 'journeyman' } = {}) {
  const legal = legalCards(state, seat);
  if (!legal.length) throw new RuleError('turn');
  if (legal.length === 1) return legal[0];
  if (level === 'master') return masterPlay(state, seat, legal);
  // ('plain' is the rules without counting and without slips: the bots before the ranks, for tools/ladder.mjs.)
  const card = rulePlay(state, seat, legal, level !== 'apprentice' && level !== 'plain');
  return level === 'apprentice' ? slip(state, seat, legal, card) : card;
}

/**
 * The rules' card. `counting`: remember what's been played, so a card nothing unseen can beat is
 * known to be sure (a journeyman's; an apprentice goes by the cards' look alone).
 */
function rulePlay(state, seat, legal, counting) {
  const { trump, trick } = state;
  const hand = state.hands[seat];
  const needs = state.won[seat] < (state.bids[seat] ?? 0);
  const suitLength = (id) => {
    const c = parseCard(id);
    return c.k === 'num' ? hand.filter((h) => h.startsWith(`${c.s}-`)).length : 0;
  };
  const order = (dir) => (a, b) => dir * (strength(a, trump) - strength(b, trump)) || suitLength(a) - suitLength(b);
  const lowest = (cards) => [...cards].sort(order(1))[0];
  const highest = (cards) => [...cards].sort(order(-1))[0];
  const unseen = counting ? unseenBy(state, seat) : null;

  if (!trick.cards.length) return lead(state, seat, legal, needs, lowest, highest, unseen);

  // A card wins when the trick would be ours, and the Dieb isn't in it (a stolen trick is nobody's).
  const wins = (id) => {
    const cards = [...trick.cards, { seat, card: id }];
    return !cards.some((p) => p.card === 'thief') && trickWinner(cards, trump) === trick.cards.length;
  };
  const winners = legal.filter(wins);
  const losers = legal.filter((id) => !wins(id));
  const last = trick.cards.length === state.players - 1;

  if (needs) {
    // Can't take it: throw the cheapest card (a Jester, else a low card of another suit).
    if (!winners.length) return lowest(losers);
    // Last to play, a winner now is a winner: the cheapest one.
    if (last) return lowest(winners);
    // Others still to come: a number card none of the unseen cards can beat is as good as the trick
    // (a Wizard is kept for when nothing else will do, below).
    if (unseen) {
      const sure = winners.filter((id) => parseCard(id).k === 'num' && holds([...trick.cards, { seat, card: id }], trump, unseen));
      if (sure.length) return lowest(sure);
    }
    // A card that only just wins is easily beaten. Take it with a solid card, else a Wizard (a sure
    // trick), else the best there is.
    const safe = winners.filter((id) => solid(id, trump));
    if (safe.length) return lowest(safe);
    return winners.find((id) => id === 'dragon') ?? winners.find(isWizard) ?? highest(winners);
  }

  // Enough tricks: get rid of the highest card that still loses (a card that loses now never wins).
  if (losers.length) return highest(losers);
  // Every card wins. Last to play, the trick is ours anyway: shed the card most likely to win
  // another one. Otherwise the cheapest, hoping someone goes over it.
  return last ? highest(winners) : lowest(winners);
}

/** Leading a trick: strength when tricks are still needed, the weakest card when not. */
function lead(state, seat, legal, needs, lowest, highest, unseen) {
  const { trump } = state;
  const numbers = legal.filter((id) => parseCard(id).k === 'num');
  const trumps = numbers.filter((id) => trump && id.startsWith(`${trump}-`));
  const others = numbers.filter((id) => !trumps.includes(id));
  if (needs) {
    const wizard = legal.find((id) => id === 'dragon') ?? legal.find(isWizard);
    if (wizard) return wizard;
    // Counting: a number card nothing unseen can beat takes the trick for sure (the cheapest such).
    if (unseen) {
      const sure = numbers.filter((id) => holds([{ seat, card: id }], trump, unseen));
      if (sure.length) return lowest(sure);
    }
    const highTrumps = trumps.filter((id) => parseCard(id).v >= 10);
    if (highTrumps.length) return highest(highTrumps);
    // Another suit's best card has a chance; low trumps wait to take a trick by trumping.
    if (others.length) return highest(others);
    return highest(legal);
  }
  // A low card of another suit loses almost surely; with only high ones, a Jester loses for sure.
  const low = others.filter((id) => parseCard(id).v <= 7);
  if (low.length) return lowest(low);
  // A Jester, or the Fee or the Dieb, loses for sure.
  const jester = legal.find((id) => parseCard(id).k === 'n' || id === 'fairy' || id === 'thief');
  if (jester) return jester;
  return lowest(legal);
}

/**
 * The trick so far (ending with our card, which wins it now) stays ours whatever one of the unseen
 * cards is played after it. One card at a time, any card at all (a void may let a trump in), so a
 * "sure" card is surely sure. The Dieb unseen makes nothing sure.
 */
function holds(cards, trump, unseen) {
  const ours = cards.length - 1;
  for (const id of unseen) {
    if (id === 'thief') return false;
    if (trickWinner([...cards, { seat: -1, card: id }], trump) !== ours) return false;
  }
  return true;
}

/** The cards this seat hasn't seen: not in its hand, not turned up, not played this round. */
function unseenBy(state, seat) {
  const seen = new Set(state.hands[seat]);
  if (state.trumpCard) seen.add(state.trumpCard);
  for (const t of state.tricks) for (const p of t.cards) seen.add(p.card);
  for (const p of state.trick.cards) seen.add(p.card);
  return deckFor(state.specials).filter((id) => !seen.has(id));
}

/**
 * An apprentice's slip, every other move: the wrong one of two cards that do the same job. If the
 * rules' card wins this trick the slip wins it too, if it loses so does the slip; never a Wizard or
 * the Drache thrown away, never a Jester kept back: a high card kept that should have gone, a winner
 * spent that a cheaper one would have done.
 */
function slip(state, seat, legal, card) {
  const r = rngFor(state, seat, 'slip');
  if (r() >= 0.5) return card;
  const { trump, trick } = state;
  const big = (id) => id === 'dragon' || isWizard(id);
  const nothing = (id) => isJester(id) || id === 'fairy' || id === 'thief';
  if (big(card) || nothing(card)) return card;
  const takes = (id) => {
    if (!trick.cards.length) return null;
    const cards = [...trick.cards, { seat, card: id }];
    return !cards.some((p) => p.card === 'thief') && trickWinner(cards, trump) === trick.cards.length;
  };
  const same = takes(card);
  const like = legal.filter((id) => id !== card && !big(id) && !nothing(id) && takes(id) === same);
  if (!like.length) return card;
  return like[Math.floor(r() * like.length)];
}

// ---- the master: many deals, played to the end ------------------------------------------------

/** How much play a master's decision may cost, in cards played across all its trial deals
 *  (STICHLE_MASTER_PLAYS overrides it, for tools/ladder.mjs). */
const MASTER_PLAYS = Number(globalThis.process?.env?.STICHLE_MASTER_PLAYS ?? 8000);
/** Each choice is tried in this many deals at least (time allowing), and at most in this many. */
const MASTER_DEALS = [8, 120];
/** A hard stop in wall-clock time, for a slow machine (the NAS's two cores can take 3 to 5 times
 *  as long): no new deal starts after it, and one deal is a few ms; every choice has at least one. */
const MASTER_MS = 150;

/**
 * The card that scores best on average: the unseen cards dealt out many times (as they could lie:
 * whoever couldn't follow a suit holds none of it), each card it might play tried in every deal
 * and played to the end with the journeyman's rules for everyone. Cards that do the same thing
 * (the 7 and the 8 of a suit when nothing lies between them) are tried once.
 */
function masterPlay(state, seat, legal) {
  const choices = distinct(state, seat, legal);
  if (choices.length === 1) return choices[0];
  const left = state.hands.reduce((sum, h) => sum + h.length, 0);
  const deals = clamp(Math.floor(MASTER_PLAYS / (choices.length * left)), MASTER_DEALS[0], MASTER_DEALS[1]);
  const r = rngFor(state, seat, 'deals');
  const unseen = unseenBy(state, seat);
  const voids = voidsOf(state);
  const total = new Map(choices.map((id) => [id, 0]));
  const until = Date.now() + MASTER_MS;
  for (let d = 0; d < deals; d++) {
    const hands = dealOut(state, seat, unseen, voids, r);
    for (const id of choices) total.set(id, total.get(id) + playOut(state, seat, hands, id));
    if (Date.now() > until) break;
  }
  // The best total; a tie goes to the rules' own card, then to the cheaper one.
  const rules = rulePlay(state, seat, legal, true);
  return choices.reduce((best, id) => {
    const a = total.get(id), b = total.get(best);
    if (a !== b) return a > b ? id : best;
    if (best === rules) return best;
    if (id === rules) return id;
    return strength(id, state.trump) < strength(best, state.trump) ? id : best;
  });
}

/**
 * A master's bid: the journeyman's, and the numbers either side of it, each tried in many deals of
 * the unseen cards (the others bid as journeymen would on what they hold, unless their bid is already
 * on the table), played to the end; the best average wins, leaned a little by temperament.
 */
function masterBid(state, seat, n, temper) {
  const { round } = state;
  const no = forbiddenBid(state, seat);
  const choices = [n - 1, n, n + 1].filter((b) => b >= 0 && b <= round && b !== no);
  if (choices.length === 1) return choices[0];
  const left = round * state.players;
  const deals = clamp(Math.floor(MASTER_PLAYS / (choices.length * left)), MASTER_DEALS[0], MASTER_DEALS[1]);
  const r = rngFor(state, seat, 'bids');
  const unseen = deckFor(state.specials).filter((id) => id !== state.trumpCard && !state.hands[seat].includes(id));
  const known = visibleBids(state, seat);
  const total = new Map(choices.map((b) => [b, 0]));
  const until = Date.now() + MASTER_MS;
  let dealt = 0;
  for (let d = 0; d < deals; d++) {
    const hands = dealOut(state, seat, unseen, new Map(), r);
    // What the others bid: what's on the table, else what a journeyman would on that hand.
    const trial = { ...state, hands };
    const bids = state.bids.map((b, i) => (i === seat ? null : known[i] ?? settle(trial, i, estimate(trial, i))));
    for (const b of choices) total.set(b, total.get(b) + playRound(state, seat, hands, bids.map((x, i) => (i === seat ? b : x))));
    dealt++;
    if (Date.now() > until) break;
  }
  // A bold bot leans up, a cautious one down: about four points a trick, on average per deal.
  const lean = (LEAN[temper] ?? 0) * 13 * dealt;
  return choices.reduce((best, b) => (total.get(b) + lean * (b - n) > total.get(best) + lean * (best - n) ? b : best));
}

/** The bids this seat can see: all of them, except the others' secret bids while bidding goes on. */
function visibleBids(state, seat) {
  return state.bids.map((b, i) => (i === seat || !(state.bidding === 'secret' && state.phase === 'bid') ? b : null));
}

/** Who can't follow which suit: they played another card (not a Wizard or Jester) to a suit led. */
function voidsOf(state) {
  /** @type {Map<number, Set<string>>} */
  const voids = new Map();
  const note = (cards) => {
    for (let i = 0; i < cards.length; i++) {
      const suit = suitToFollow(cards.slice(0, i));
      const c = parseCard(cards[i].card);
      if (suit && c.k === 'num' && c.s !== suit) {
        if (!voids.has(cards[i].seat)) voids.set(cards[i].seat, new Set());
        voids.get(cards[i].seat).add(suit);
      }
    }
  };
  for (const t of state.tricks) note(t.cards);
  note(state.trick.cards);
  return voids;
}

/**
 * One way the unseen cards could lie: each other seat gets as many as it holds, none of a suit it
 * has shown it can't follow (when the cards allow; else any), the rest stay in the box.
 */
function dealOut(state, seat, unseen, voids, r) {
  const pool = shuffle([...unseen], r);
  const hands = state.hands.map((h, i) => (i === seat ? [...h] : []));
  const fits = (i, id) => {
    const c = parseCard(id);
    return c.k !== 'num' || !voids.get(i)?.has(c.s);
  };
  // The most constrained seats first.
  const order = state.hands.map((_, i) => i).filter((i) => i !== seat).sort((a, b) => (voids.get(b)?.size ?? 0) - (voids.get(a)?.size ?? 0));
  for (const i of order) {
    const need = state.hands[i].length;
    for (let k = 0; k < pool.length && hands[i].length < need; k++) {
      if (pool[k] !== null && fits(i, pool[k])) {
        hands[i].push(pool[k]);
        pool[k] = null;
      }
    }
    // Not enough that fit (voids the cards can't honour): any will do.
    for (let k = 0; k < pool.length && hands[i].length < need; k++) {
      if (pool[k] !== null) {
        hands[i].push(pool[k]);
        pool[k] = null;
      }
    }
  }
  return hands;
}

/** A copy of the round with these hands, `card` played for `seat`, and everyone's rules to the end: its points. */
function playOut(state, seat, hands, card) {
  const s = trialCopy(state, hands);
  play(s, seat, card);
  return finish(s, seat);
}

/** A whole round from its first lead, with these hands and these bids: the seat's points. */
function playRound(state, seat, hands, bids) {
  const s = trialCopy(state, hands);
  s.bids = bids;
  s.phase = 'play';
  const left = (state.dealer + 1) % state.players;
  s.turn = left;
  s.trick = { lead: left, cards: [] };
  return finish(s, seat);
}

function finish(s, seat) {
  while (s.phase === 'play') {
    const legal = legalCards(s, s.turn);
    play(s, s.turn, legal.length === 1 ? legal[0] : rulePlay(s, s.turn, legal, true));
  }
  return scoreRound(s.bids, s.won)[seat];
}

/** The round's state with other hands in it, safe to play on (the real one is never touched). */
function trialCopy(state, hands) {
  return {
    ...state,
    hands: hands.map((h) => [...h]),
    bids: [...state.bids],
    won: [...state.won],
    trick: { lead: state.trick.lead, cards: [...state.trick.cards] },
    tricks: [...state.tricks],
    points: null,
  };
}

/**
 * The cards worth trying: of number cards in one suit with nothing unseen between them, only the
 * lowest (they win and lose alike); one Wizard, one Jester. Every other card is its own choice.
 */
function distinct(state, seat, legal) {
  const unseen = new Set(unseenBy(state, seat));
  const kept = [];
  const seenKinds = new Set();
  const nums = legal.filter((id) => parseCard(id).k === 'num').sort((a, b) => parseCard(a).v - parseCard(b).v);
  for (const id of legal) {
    const c = parseCard(id);
    if (c.k === 'z' || c.k === 'n') {
      if (!seenKinds.has(c.k)) kept.push(id);
      seenKinds.add(c.k);
    } else if (c.k === 'x') kept.push(id);
  }
  /** @type {string | null} */
  let prev = null;
  for (const id of nums) {
    const c = parseCard(id);
    if (prev) {
      const p = parseCard(prev);
      let gap = false;
      if (p.s === c.s) for (let v = p.v + 1; v < c.v; v++) if (unseen.has(`${c.s}-${v}`)) gap = true;
      if (p.s === c.s && !gap) {
        prev = id;
        continue;
      }
    }
    kept.push(id);
    prev = id;
  }
  return kept;
}

// ---- small helpers -------------------------------------------------------------------------------

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function shuffle(cards, r) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * A repeatable random number generator for one decision: seeded by what the seat sees (the round,
 * the tricks so far, its hand) and what it's for, so the same position always gives the same move.
 */
function rngFor(state, seat, salt) {
  const key = `${salt}|${state.round}|${state.dealer}|${seat}|${state.hands[seat].join(',')}|${state.tricks.length}|${state.trick.cards.map((p) => p.card).join(',')}|${visibleBids(state, seat).join(',')}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
