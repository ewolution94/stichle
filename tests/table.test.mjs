import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, LENGTHS } from '../server/rules.mjs';
// The page's own module, loaded through Node's type stripping (no build step).
import { angleOf, BEATS, deskScale, FLAT, flatLayout, orderHand, scheduleFor, seatSpot, trickPhase } from '../src/lib/table.ts';

test("the page's schedule is the server's, for every table and length", () => {
  for (const players of [3, 4, 5, 6]) for (const length of LENGTHS) for (const specials of [false, true]) assert.deepEqual(scheduleFor(players, length, specials), schedule(players, length, specials), `${players} ${length} ${specials}`);
});

test("a trick's beats: rest, reveal, gather, sweep, gone, at either tempo", () => {
  for (const tempo of ['normal', 'fast']) {
    const b = BEATS[tempo];
    assert.equal(trickPhase(b.reveal + 1, tempo), 'rest');
    assert.equal(trickPhase(b.reveal - 1, tempo), 'reveal');
    assert.equal(trickPhase(b.gather - 1, tempo), 'gather');
    assert.equal(trickPhase(-1, tempo), 'sweep');
    assert.equal(trickPhase(-b.sweep - 1, tempo), 'gone');
  }
  // The fast tempo's pause (server/game.mjs: 1500 ms) still leaves the rest before the winner shows.
  assert.equal(BEATS.fast.rest + BEATS.fast.reveal, 1500);
  assert.equal(BEATS.normal.rest + BEATS.normal.reveal, 2600);
});

test('the hand by strength: the Drache, the Wizards, trumps high to low, the rest high to low, the losers last', () => {
  const dealt = ['dragon', 'z-air', 'water-3', 'water-11', 'fire-2', 'fire-13', 'earth-7', 'n-fire', 'fairy', 'thief'];
  // By suit: the server's groups, each suit high to low (the strongest on the left, the user, 2026-10-15).
  assert.deepEqual(orderHand(dealt, 'water', 'suit'), ['dragon', 'z-air', 'water-11', 'water-3', 'fire-13', 'fire-2', 'earth-7', 'n-fire', 'fairy', 'thief']);
  assert.deepEqual(orderHand(['air-2', 'fire-9', 'air-12', 'fire-1'], null, 'suit'), ['fire-9', 'fire-1', 'air-12', 'air-2']);
  assert.deepEqual(orderHand(dealt, 'water', 'strength'), ['dragon', 'z-air', 'water-11', 'water-3', 'fire-13', 'earth-7', 'fire-2', 'n-fire', 'fairy', 'thief']);
  assert.deepEqual(orderHand(['fire-2', 'air-9'], null, 'strength'), ['air-9', 'fire-2']);
});

test('the flat hand: whole cards side by side while they fit, then an even overlap; one box height', () => {
  const few = flatLayout(['a', 'b', 'c'], 1000);
  assert.equal(few.cw, FLAT.max);
  assert.equal(few.places.get('b').x - few.places.get('a').x, FLAT.max + FLAT.gap);
  const many = flatLayout(Array.from({ length: 20 }, (_, i) => `c${i}`), 1000);
  assert.equal(many.cw, FLAT.min);
  assert.ok(many.places.get('c1').x - many.places.get('c0').x < FLAT.min);
  assert.equal(few.height, many.height);
  // The playable ones stand higher.
  const raised = flatLayout(['a', 'b'], 1000, { raise: new Set(['b']) });
  assert.equal(raised.places.get('a').y - raised.places.get('b').y, FLAT.raise);
  // At a bigger table every measure grows with it, the box too.
  const big = flatLayout(['a', 'b', 'c'], 2000, { scale: 1.5 });
  assert.equal(big.cw, FLAT.max * 1.5);
  assert.equal(big.height, Math.round((FLAT.top + FLAT.max * 1.4 + FLAT.bottom) * 1.5));
  assert.equal(big.lift, 30);
});

test("the desktop table's size: a laptop as it is, a big window bigger, never past the window", () => {
  assert.equal(deskScale(1440, 820), 1);
  assert.equal(deskScale(1512, 900), 1);
  // The user's 34" ultrawide, a browser window on it.
  assert.equal(deskScale(3440, 1320), 1.47);
  assert.equal(deskScale(2560, 1300), 1.44);
  assert.equal(deskScale(1920, 970), 1.08);
  // Tall but narrow: the width holds it back.
  assert.equal(deskScale(1500, 1400), 1);
  // Never past 1.6, even on a huge window.
  assert.equal(deskScale(5120, 2700), 1.6);
  // A fixed size holds…
  assert.equal(deskScale(3440, 1320, '1'), 1);
  assert.equal(deskScale(3440, 1320, '1.25'), 1.25);
  assert.equal(deskScale(1920, 1200, '1.5'), 1.5);
  // …unless the window can't hold it: the table needs 1100 × 740 at its own size.
  assert.equal(deskScale(1440, 820, '1.5'), 1.11);
});

test('round the table: each seat on the rail it faces, the far rail for three, the side rails from five', () => {
  const spots = (n) => Array.from({ length: n - 1 }, (_, i) => seatSpot(angleOf(i + 1, 0, n)));
  // Three: both across, near the corners.
  assert.deepEqual(spots(3).map((p) => [p.side, p.y]), [[false, -1], [false, -1]]);
  assert.ok(spots(3)[0].x < -0.5 && spots(3)[1].x > 0.5);
  // Four: the corners and straight across.
  assert.deepEqual(spots(4).map((p) => [p.x, p.y]), [[-1, -1], [0, -1], [1, -1]]);
  // Five and six: the side rails too, the next to play on your left.
  assert.deepEqual(spots(5).map((p) => p.side), [true, false, false, true]);
  assert.deepEqual(spots(6).map((p) => p.side), [true, false, false, false, true]);
  assert.ok(spots(6)[0].x === -1 && spots(6)[4].x === 1);
});
