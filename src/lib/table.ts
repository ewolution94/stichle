// Where things are around the table, from your own seat: you sit at the bottom, and play goes on to
// your left, across the top, and round to your right (clockwise, as at a real table). Spectators see
// it from the first seat.

let uid = 0;
/** A fresh id for one drawn card, so its foil gradients never clash with another card's. */
export const nextUid = () => ++uid;

/** The seat at the bottom of this page's table. */
export const homeSeat = (mine: number) => (mine >= 0 ? mine : 0);

/** A seat's place: 0 is you, then 1, 2 … in the order play goes. */
export const placeOf = (seat: number, mine: number, n: number) => (seat - homeSeat(mine) + n) % n;

/**
 * The direction a seat sits in, in degrees (0 = right, 90 = down): you at 90, the others spread from
 * the left (180) over the top (270) to the right (360).
 */
export function angleOf(seat: number, mine: number, n: number) {
  const place = placeOf(seat, mine, n);
  return place === 0 ? 90 : 180 + (place * 180) / n;
}

/** A small, steady twist for a card on the table, so a trick looks dropped, not aligned. */
export function twist(card: string, seat: number) {
  let h = seat * 7919;
  for (const ch of card) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 1700) / 100 - 8.5).toFixed(1);
}

/** How big a card is in the middle of the table, for a trick area of w × h px. */
export const trickCardWidth = (w: number, h: number) => Math.round(Math.min(96, w * 0.22, (h * 0.4) / 1.4));

/** Where a seat's card lies in the trick, from the area's centre. */
export function slotOffset(angle: number, w: number, h: number) {
  const rad = (angle * Math.PI) / 180;
  return { dx: Math.cos(rad) * w * 0.25, dy: Math.sin(rad) * h * 0.25 };
}
