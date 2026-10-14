import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, LENGTHS } from '../server/rules.mjs';
// The page's own module, loaded through Node's type stripping (no build step).
import { BEATS, scheduleFor, trickPhase } from '../src/lib/table.ts';

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
