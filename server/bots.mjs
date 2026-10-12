// Bots: they fill a table for trying the game alone, and play for someone who's away. Simple but not
// random: a bid from Wizards, trumps and high cards, then play that tries to meet it (take a trick as
// cheaply as is safe while it still needs one, duck under the winner once it has enough).
//
// Pure functions over a round state from rules.mjs, deterministic: the same state gives the same
// move. Equal cards (two off-suit 9s) go from the shorter suit first, to make a void sooner.

import { DECK, RuleError, SUITS, isWizard, legalCards, parseCard, trickWinner } from './rules.mjs';

/** @typedef {import('./rules.mjs').RoundState} RoundState */

/** How much a card is worth keeping: Wizards, then trumps, then the rest by value, Jesters last. */
function strength(id, trump) {
  const c = parseCard(id);
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
  if (c.k === 'z') return 1;
  if (c.k === 'n') return 0;
  if (c.s === trump) return c.v === 13 ? 0.9 : c.v >= 10 ? 0.7 : c.v >= 7 ? 0.35 : 0.15;
  // No trump: only a Wizard beats a 13, but its suit has to be led.
  if (!trump) return c.v === 13 ? 0.7 : c.v === 12 ? 0.35 : c.v === 11 ? 0.1 : 0;
  return (c.v === 13 ? 0.5 : c.v === 12 ? 0.3 : 0) * offScale;
}

/**
 * The tricks this hand should take: its cards' worth, rounded and kept within 0..round.
 * @param {RoundState} state  @param {number} seat
 */
export function botBid(state, seat) {
  const { round, players, trump, trumpCard } = state;
  const hand = state.hands[seat];
  const offScale = trump ? 1 / (1 + ((round - 1) * players) / 20) : 1;
  const mine = hand.reduce((sum, id) => sum + worth(id, trump, offScale), 0);
  // In long rounds the values claim fewer tricks than there are, but every trick goes to someone
  // (with 3 players the bots underbid by about two). So guess what the other hands claim, from the
  // cards this seat can't see, and scale up so that all claims add up to the round.
  const seen = new Set(trumpCard ? [...hand, trumpCard] : hand);
  const unseen = DECK.filter((id) => !seen.has(id));
  const mean = unseen.reduce((sum, id) => sum + worth(id, trump, offScale), 0) / unseen.length;
  const claimed = mine + (players - 1) * round * mean;
  const expected = claimed > 0 ? mine * Math.max(1, round / claimed) : 0;
  return Math.max(0, Math.min(round, Math.round(expected)));
}

/**
 * A legal card for `seat`, whose turn it is to play.
 * @param {RoundState} state  @param {number} seat
 */
export function botPlay(state, seat) {
  const legal = legalCards(state, seat);
  if (!legal.length) throw new RuleError('turn');
  if (legal.length === 1) return legal[0];

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

  if (!trick.cards.length) return lead(legal, trump, needs, lowest, highest);

  const wins = (id) => trickWinner([...trick.cards, { seat, card: id }], trump) === trick.cards.length;
  const winners = legal.filter(wins);
  const losers = legal.filter((id) => !wins(id));
  const last = trick.cards.length === state.players - 1;

  if (needs) {
    // Can't take it: throw the cheapest card (a Jester, else a low card of another suit).
    if (!winners.length) return lowest(losers);
    // Last to play, a winner now is a winner: the cheapest one.
    if (last) return lowest(winners);
    // Others still to come: a card that only just wins is easily beaten. Take it with a solid card,
    // else a Wizard (a sure trick), else the best there is.
    const safe = winners.filter((id) => solid(id, trump));
    if (safe.length) return lowest(safe);
    return winners.find(isWizard) ?? highest(winners);
  }

  // Enough tricks: get rid of the highest card that still loses (a card that loses now never wins).
  if (losers.length) return highest(losers);
  // Every card wins. Last to play, the trick is ours anyway: shed the card most likely to win
  // another one. Otherwise the cheapest, hoping someone goes over it.
  return last ? highest(winners) : lowest(winners);
}

/** Leading a trick: strength when tricks are still needed, the weakest card when not. */
function lead(legal, trump, needs, lowest, highest) {
  const numbers = legal.filter((id) => parseCard(id).k === 'num');
  const trumps = numbers.filter((id) => trump && id.startsWith(`${trump}-`));
  const others = numbers.filter((id) => !trumps.includes(id));
  if (needs) {
    const wizard = legal.find(isWizard);
    if (wizard) return wizard;
    const highTrumps = trumps.filter((id) => parseCard(id).v >= 10);
    if (highTrumps.length) return highest(highTrumps);
    // Another suit's best card has a chance; low trumps wait to take a trick by trumping.
    if (others.length) return highest(others);
    return highest(legal);
  }
  // A low card of another suit loses almost surely; with only high ones, a Jester loses for sure.
  const low = others.filter((id) => parseCard(id).v <= 7);
  if (low.length) return lowest(low);
  const jester = legal.find((id) => parseCard(id).k === 'n');
  if (jester) return jester;
  return lowest(legal);
}
