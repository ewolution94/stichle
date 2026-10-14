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

/**
 * Your hand in the order you chose (the sort button, 2026-10-14): `suit` as the server deals it (the
 * Drache and the Wizards, the trump suit, the others, each rising; Jesters, the Fee and the Dieb last);
 * `strength` strongest first across the suits: the Drache, the Wizards, trumps high to low, the other
 * suits high to low, then the cards that never take a trick. Ties keep the suit order.
 */
export function orderHand(cards: string[], trump: string | null, mode: 'suit' | 'strength'): string[] {
  if (mode !== 'strength') return cards;
  const worth = (id: string) => {
    if (id === 'dragon') return 200;
    if (id.startsWith('z-')) return 150;
    if (id.startsWith('n-') || id === 'fairy' || id === 'thief') return 0;
    const [suit, v] = id.split('-');
    return (suit === trump ? 100 : 0) + Number(v);
  };
  return cards
    .map((id, i) => ({ id, i }))
    .sort((a, b) => worth(b.id) - worth(a.id) || a.i - b.i)
    .map((e) => e.id);
}

/** The flat hand's measures (the desktop table, 2026-10-14). */
export const FLAT = { max: 132, min: 76, gap: 14, top: 34, bottom: 34, raise: 16 };

/**
 * The hand laid out flat (the desktop table's default): side by side, every card whole and upright,
 * as big as the width allows (up to FLAT.max); when even FLAT.min doesn't fit, they overlap evenly.
 * The cards you may play now (`raise`) stand a little higher. Same shape as the kit's fanLayout, so
 * its gestures (tap, drag, flick, hold) and flights work unchanged. `boxH` keeps the box one height
 * whatever the hand: the cards sit at its foot, the number keys under them.
 */
export function flatLayout(cards: string[], width: number, { raise = new Set<string>(), boxH = FLAT.top + Math.round(FLAT.max * 1.4) + FLAT.bottom } = {}) {
  const n = cards.length;
  const usable = Math.max(0, width - 8);
  let cw = n ? Math.min(FLAT.max, Math.floor((usable - FLAT.gap * (n - 1)) / n)) : FLAT.max;
  let step = cw + FLAT.gap;
  if (cw < FLAT.min) {
    cw = FLAT.min;
    step = n > 1 ? (usable - cw) / (n - 1) : 0;
  }
  const ch = Math.round(cw * 1.4);
  const x0 = (width - (cw + step * (n - 1))) / 2;
  const foot = boxH - FLAT.bottom - ch;
  const places = new Map<string, { x: number; y: number; r: number; z: number; row: number }>();
  cards.forEach((card, i) => places.set(card, { x: x0 + i * step, y: foot - (raise.has(card) ? FLAT.raise : 0), r: 0, z: i + 1, row: 0 }));
  return { cw, ch, rows: 1 as const, height: boxH, lift: 20, places };
}
