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
 * Where a seat sits on the rail, round the table (the user's pick B, 2026-10-15): its direction from
 * the middle (angleOf, the same the trick's cards lean towards) carried out to the edge of a square,
 * then stretched to the cloth, so the seats spread over the side rails and the far one alike instead
 * of crowding the long edge. x and y from -1 to 1 across the cloth; `side` on a side rail (a narrow
 * card there), else on the far rail or its corner.
 */
export function seatSpot(angle: number) {
  const r = (angle * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const k = 1 / Math.max(Math.abs(c), Math.abs(s));
  const x = Math.round(c * k * 1000) / 1000 || 0;
  const y = Math.round(s * k * 1000) / 1000 || 0;
  return { x, y, side: Math.abs(x) === 1 && y > -1 };
}

/**
 * Your hand in the order you chose (the sort button, 2026-10-14), the strongest always on the left
 * (the user, 2026-10-15): `suit` in the server's groups (the Drache and the Wizards, the trump suit,
 * the other suits, the Jesters, the Fee and the Dieb last), each suit high to low; `strength`
 * strongest first across the suits: the Drache, the Wizards, trumps high to low, the other suits high
 * to low, then the cards that never take a trick. Ties keep the suit order.
 */
export function orderHand(cards: string[], trump: string | null, mode: 'suit' | 'strength'): string[] {
  if (mode !== 'strength') {
    // The server's order (rules.mjs → sortHand), each suit turned round: high to low.
    const suits = ['fire', 'water', 'earth', 'air'];
    const order = trump ? [trump, ...suits.filter((s) => s !== trump)] : suits;
    const key = (id: string) => {
      if (id === 'dragon') return -1;
      if (id === 'fairy') return 1100;
      if (id === 'thief') return 1200;
      const [kind, rest] = id.split('-');
      if (kind === 'z') return suits.indexOf(rest);
      if (kind === 'n') return 1000 + suits.indexOf(rest);
      return 100 + order.indexOf(kind) * 20 + (20 - Number(rest));
    };
    return cards
      .map((id, i) => ({ id, i }))
      .sort((a, b) => key(a.id) - key(b.id) || a.i - b.i)
      .map((e) => e.id);
  }
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

/** The flat hand's measures (the desktop table, 2026-10-14), at the table's own size. */
export const FLAT = { max: 132, min: 76, gap: 14, top: 34, bottom: 34, raise: 16, lift: 20 };

/**
 * The hand laid out flat (the desktop table's default): side by side, every card whole and upright,
 * as big as the width allows (up to FLAT.max); when even FLAT.min doesn't fit, they overlap evenly.
 * The cards you may play now (`raise`) stand a little higher. Same shape as the kit's fanLayout, so
 * its gestures (tap, drag, flick, hold) and flights work unchanged. `boxH` keeps the box one height
 * whatever the hand: the cards sit at its foot, the number keys under them. `scale` is the table's
 * size (deskScale): every measure grows with it.
 */
export function flatLayout(cards: string[], width: number, { raise = new Set<string>(), scale = 1, boxH = 0 } = {}) {
  const m = Object.fromEntries(Object.entries(FLAT).map(([k, v]) => [k, v * scale])) as typeof FLAT;
  const height = boxH || Math.round(m.top + m.max * 1.4 + m.bottom);
  const n = cards.length;
  const usable = Math.max(0, width - 8);
  let cw = n ? Math.min(m.max, Math.floor((usable - m.gap * (n - 1)) / n)) : m.max;
  let step = cw + m.gap;
  if (cw < m.min) {
    cw = Math.round(m.min);
    step = n > 1 ? (usable - cw) / (n - 1) : 0;
  }
  cw = Math.floor(cw);
  const ch = Math.round(cw * 1.4);
  const x0 = (width - (cw + step * (n - 1))) / 2;
  const foot = height - m.bottom - ch;
  const places = new Map<string, { x: number; y: number; r: number; z: number; row: number }>();
  cards.forEach((card, i) => places.set(card, { x: x0 + i * step, y: foot - (raise.has(card) ? m.raise : 0), r: 0, z: i + 1, row: 0 }));
  return { cw, ch, rows: 1 as const, height, lift: Math.round(m.lift), places };
}

/** The desktop table's size setting: Auto follows the window; the others hold one size. */
export type TableSize = 'auto' | '1' | '1.25' | '1.5';
export const TABLE_SIZES: TableSize[] = ['auto', '1', '1.25', '1.5'];

/**
 * How big the desktop table is drawn (the user, 2026-10-14, on a 34" ultrawide: the place cards were
 * hard to read). It is laid out for a window about 1500 × 900; Auto draws a bigger window's table
 * bigger by the same factor, up to 1.6×, so a big screen gets a big table instead of empty wood at
 * its sides, and a laptop keeps it as it is. A fixed size holds whatever the window does, but never
 * more than the window holds: the table needs 1100 × 740 at its own size.
 */
export function deskScale(width: number, height: number, size: TableSize = 'auto') {
  const want = size === 'auto' ? Math.min(height / 900, width / 1500, 1.6) : Number(size);
  const fits = Math.min(width / 1100, height / 740);
  return Math.round(Math.max(1, Math.min(want, fits)) * 100) / 100;
}
