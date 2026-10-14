// This device's own card preferences (Settings → Stichle): the figure cards, or the classic deck the
// game began with (the user, 2026-10-12: keep it as an option); the hand's order, by suit or by
// strength (the sort button by your hand); and on the desktop table the hand laid out flat or held
// as a fan, and the table's size; whether a bot's rank shows on its place card (the user, 2026-10-14).
// Kept in localStorage; blocked storage just means the default.

import type { Art } from './deck';
import { TABLE_SIZES, type TableSize } from './table';

const ART = 'stichle:art';
const SORT = 'stichle:sort';
const HAND = 'stichle:hand';
const SIZE = 'stichle:size';
const RANKS = 'stichle:ranks';

/** The hand's order: as dealt by suit (trump first), or strongest first. */
export type SortMode = 'suit' | 'strength';
/** The desktop table's hand: laid out flat, every card whole, or the fan of the phone. */
export type HandLayout = 'flat' | 'fan';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function keep(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not kept
  }
}

function stored(): Art {
  try {
    return localStorage.getItem(ART) === 'classic' ? 'classic' : 'figures';
  } catch {
    return 'figures';
  }
}

export const prefs = $state({
  art: stored(),
  sort: (read(SORT) === 'strength' ? 'strength' : 'suit') as SortMode,
  hand: (read(HAND) === 'fan' ? 'fan' : 'flat') as HandLayout,
  size: (TABLE_SIZES.find((s) => s === read(SIZE)) ?? 'auto') as TableSize,
  /** A bot's rank on its place card at the table. */
  ranks: read(RANKS) !== 'off',
});

export function setSort(sort: SortMode) {
  prefs.sort = sort;
  keep(SORT, sort);
}

export function setHand(hand: HandLayout) {
  prefs.hand = hand;
  keep(HAND, hand);
}

export function setSize(size: TableSize) {
  prefs.size = size;
  keep(SIZE, size);
}

export function setRanks(on: boolean) {
  prefs.ranks = on;
  keep(RANKS, on ? 'on' : 'off');
}

export function setArt(art: Art) {
  prefs.art = art;
  try {
    localStorage.setItem(ART, art);
  } catch {
    // not kept
  }
}
