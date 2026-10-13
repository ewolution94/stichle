// Where things are around the table, from your own seat: you sit at the bottom, and play goes on to
// your left, across the top, and round to your right (clockwise, as at a real table). Spectators see
// it from the first seat.

import type { Game } from './api';
import { cardTwist, pileCardWidth, placeOf as kitPlaceOf, seatAngle, sweepTo, trickSlot } from '../../vendor/ewo/elements/card-pile.js';

/** Who plays the round's first card (left of the dealer), from the deal until that card is on the
 *  table; -1 after it, and between rounds. Shown on their place card and in the empty middle. */
export function opener(game: Game) {
  if (game.phase !== 'round' || game.stage === 'done') return -1;
  if (game.trick.cards.length || game.won.some((w) => w > 0)) return -1;
  return game.trick.lead;
}

/**
 * The end of a trick, in beats counted back from the server's holdUntil (its TRICK_PAUSE, 2600 ms,
 * starts when the last card is played): first the table rests with every card where it landed, then
 * the winner lifts and catches the light while the others dim, then the cards gather under the
 * winner, then the stack sweeps off to the winner's seat (the user, 2026-10-13: "it feels very
 * rushed"). Every page reads the same beats from the same holdUntil.
 */
export const TRICK_REVEAL = 1900; // ms before holdUntil: the winner shows (700 ms after the last card)
export const TRICK_GATHER = 420; // ms before holdUntil: the cards gather under the winner
export const TRICK_SWEEP = 560; // ms after holdUntil: the stack sweeps off, then it's gone
export type TrickPhase = 'rest' | 'reveal' | 'gather' | 'sweep' | 'gone';
/** The finished trick's beat, from the time left until holdUntil (negative after it). */
export function trickPhase(left: number): TrickPhase {
  if (left > TRICK_REVEAL) return 'rest';
  if (left > TRICK_GATHER) return 'reveal';
  if (left > 0) return 'gather';
  if (left > -TRICK_SWEEP) return 'sweep';
  return 'gone';
}

let uid = 0;
/** A fresh id for one drawn card, so its foil gradients never clash with another card's. */
export const nextUid = () => ++uid;

/** The seat at the bottom of this page's table. */
export const homeSeat = (mine: number) => (mine >= 0 ? mine : 0);

// The table's geometry comes from Folio's card kit (vendor/ewo/elements/card-pile.js), under the names
// Stichle's components use.

/** A seat's place: 0 is you, then 1, 2 … in the order play goes. */
export const placeOf = (seat: number, mine: number, n: number) => kitPlaceOf(seat, homeSeat(mine), n);

/** The direction a seat sits in, in degrees (0 = right, 90 = down): you at 90, the others from the left over the top to the right. */
export const angleOf = (seat: number, mine: number, n: number) => seatAngle(seat, mine, n);

/** A steady twist for a card on the pile (from its id, so every page agrees), so a trick looks dropped. */
export const twist = (card: string, seat: number) => cardTwist(card, seat).toFixed(1);

/** How big a card is on the pile in the middle, for a trick area of w × h px. */
export const trickCardWidth = (w: number, h: number, cap?: number) => pileCardWidth(w, h, cap);

/** Where a seat's card lies on the pile, from the area's centre (nudged a third of a card towards its seat). */
export const slotOffset = (angle: number, cardWidth: number) => trickSlot(angle, cardWidth);

/** Off the table towards a seat: where a taken trick sweeps to. */
export const sweepOffset = (angle: number, w: number, h: number) => sweepTo(angle, w, h);
