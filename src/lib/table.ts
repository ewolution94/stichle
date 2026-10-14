// Where things are around the table, from your own seat: you sit at the bottom, and play goes on to
// your left, across the top, and round to your right (clockwise, as at a real table). Spectators see
// it from the first seat.

import type { Game, Length, Tempo } from './api';
import { cardTwist, pileCardWidth, placeOf as kitPlaceOf, seatAngle, sweepTo, trickSlot } from '../../vendor/ewo/elements/card-pile.js';

/** Who plays the round's first card (left of the dealer), from the deal until that card is on the
 *  table; -1 after it, and between rounds. Shown on their place card and in the empty middle. */
export function opener(game: Game) {
  if (game.phase !== 'round' || game.stage === 'done') return -1;
  if (game.trick.cards.length || game.won.some((w) => w > 0)) return -1;
  return game.trick.lead;
}

/**
 * The end of a trick, in beats counted back from the server's holdUntil (its pause starts when the
 * last card is played): first the table rests with every card where it landed, then the winner lifts
 * and catches the light while the others dim, then the cards gather under the winner, then the stack
 * sweeps off to the winner's seat (the user, 2026-10-13: "it feels very rushed"). Every page reads the
 * same beats from the same holdUntil. The fast tempo (R3) plays the same ending in a shorter pause
 * (server/game.mjs: TRICK_PAUSE 2600 ms, TRICK_PAUSE_FAST 1500 ms).
 */
export const BEATS: Record<Tempo, { rest: number; reveal: number; gather: number; sweep: number }> = {
  // ms: `rest` after the last card the winner shows; `reveal` and `gather` before holdUntil; `sweep` after it
  normal: { rest: 700, reveal: 1900, gather: 420, sweep: 560 },
  fast: { rest: 350, reveal: 1150, gather: 320, sweep: 400 },
};
export type TrickPhase = 'rest' | 'reveal' | 'gather' | 'sweep' | 'gone';
/** The finished trick's beat, from the time left until holdUntil (negative after it). */
export function trickPhase(left: number, tempo: Tempo = 'normal'): TrickPhase {
  const b = BEATS[tempo] ?? BEATS.normal;
  if (left > b.reveal) return 'rest';
  if (left > b.gather) return 'reveal';
  if (left > 0) return 'gather';
  if (left > -b.sweep) return 'sweep';
  return 'gone';
}

/**
 * The cards dealt in each round of a game of `players` at `length` (the same as server/rules.mjs →
 * schedule; tests/table.test.mjs keeps them together).
 */
export function scheduleFor(players: number, length: Length = 'full', specials = false): number[] {
  if (players < 3 || players > 6) return [];
  // The special cards make the deck 63 (R3).
  const all = Array.from({ length: Math.floor((specials ? 63 : 60) / players) }, (_, i) => i + 1);
  if (length === 'half') return all.filter((n) => n % 2 === 1);
  if (length === 'short') return all.slice(0, Math.ceil(all.length / 2));
  return all;
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
