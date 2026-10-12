import { test } from 'node:test';
import assert from 'node:assert/strict';
// The page's own module, loaded through Node's type stripping (no build step, no dependencies).
import { ACHIEVEMENTS, DEFAULT_LOOK, cleanRecord, countDeal, countGame, countRound, countTrick, emptyRecord, progress, unlocked } from '../src/lib/achievements.ts';

// Your record lives on your device (src/lib/profile.svelte.ts); these are its rules.

test('every achievement unlocks one look, and no look is unlocked twice', () => {
  const rewards = ACHIEVEMENTS.map((a) => `${a.reward.kind}:${a.reward.id}`);
  assert.equal(new Set(rewards).size, rewards.length);
  assert.equal(ACHIEVEMENTS.length, 12);
  for (const kind of ['back', 'table', 'edge']) assert.ok(!rewards.includes(`${kind}:${DEFAULT_LOOK[kind]}`));
});

test('a round is counted once, however often the page sees it', () => {
  const r = emptyRecord();
  countRound(r, 'K:1:r1', { bid: 1, won: 1, last: false, wizards: 0 });
  countRound(r, 'K:1:r1', { bid: 1, won: 1, last: false, wizards: 0 });
  assert.equal(r.rounds, 1);
  assert.equal(r.met, 1);
});

test('five rounds met in a row; a miss starts the streak again', () => {
  const r = emptyRecord();
  let fresh = [];
  for (let i = 1; i <= 4; i++) fresh = countRound(r, `K:1:r${i}`, { bid: 0, won: 0, last: false, wizards: 0 });
  assert.deepEqual(fresh, []);
  countRound(r, 'K:1:r5', { bid: 0, won: 1, last: false, wizards: 0 });
  assert.equal(r.streak, 0);
  assert.equal(r.bestStreak, 4);
  for (let i = 6; i <= 9; i++) countRound(r, `K:1:r${i}`, { bid: 1, won: 1, last: false, wizards: 0 });
  assert.deepEqual(countRound(r, 'K:1:r10', { bid: 1, won: 1, last: false, wizards: 0 }), ['streak5']);
  assert.equal(progress(r, 'streak5'), 5);
});

test('a zero bid made with a Wizard in hand; a big bid made; the last round met', () => {
  const r = emptyRecord();
  assert.deepEqual(countRound(r, 'a', { bid: 0, won: 0, last: false, wizards: 1 }), ['zeroWizard']);
  assert.deepEqual(countRound(r, 'b', { bid: 0, won: 0, last: false, wizards: null }), []);
  assert.deepEqual(countRound(r, 'c', { bid: 8, won: 8, last: true, wizards: 0 }), ['bigBid', 'lastRound']);
  assert.deepEqual(countRound(r, 'd', { bid: 9, won: 8, last: true, wizards: 0 }), []);
});

test('the deal and the tricks: four Wizards, a Jester taking a trick, the 13 of trump', () => {
  const r = emptyRecord();
  assert.deepEqual(countDeal(r, 'd1', ['z-fire', 'z-water', 'z-earth', 'fire-3']), []);
  assert.deepEqual(countDeal(r, 'd2', ['z-fire', 'z-water', 'z-earth', 'z-air', 'air-1']), ['fourWizards']);
  assert.deepEqual(countTrick(r, 't1', 'n-air', 'fire'), ['jesterTrick']);
  assert.deepEqual(countTrick(r, 't2', 'fire-13', 'water'), []);
  assert.deepEqual(countTrick(r, 't3', 'water-13', 'water'), ['trumpKing']);
  assert.deepEqual(countTrick(r, 't4', null, 'water'), []);
});

test('a finished game: the first win, a perfect game, a comeback, a full table, ten games', () => {
  const r = emptyRecord();
  // Three players, four rounds; you (seat 0) last after two, first at the end, every bid met.
  const points = [[10, 30, 20], [20, 30, 30], [40, 20, -10], [50, -10, 20]];
  const bids = [[0, 1, 0], [1, 1, 1], [2, 0, 1], [3, 1, 0]];
  const won = [[0, 1, 0], [1, 1, 1], [2, 1, 0], [3, 0, 0]];
  const totals = [120, 70, 60];
  const fresh = countGame(r, 'K:1:end', { totals, mine: 0, points, bids, won, players: 3 });
  assert.deepEqual(fresh.sort(), ['comeback', 'firstWin', 'perfect'].sort());
  assert.equal(r.games, 1);
  assert.equal(r.wins, 1);
  assert.deepEqual(countGame(r, 'K:1:end', { totals, mine: 0, points, bids, won, players: 3 }), []);
  for (let g = 2; g <= 10; g++) countGame(r, `K:${g}:end`, { totals: [0, 10, 0, 0, 0, 0], mine: 0, points: [[0, 10, 0, 0, 0, 0]], bids: [[1, 0, 0, 0, 0, 0]], won: [[0, 0, 0, 0, 0, 0]], players: 6 });
  assert.ok(r.earned.fullTable);
  assert.ok(r.earned.tenGames);
  assert.equal(r.wins, 1);
});

test('a look is chosen only once it is unlocked, also from a pasted code', () => {
  const r = emptyRecord();
  assert.ok(unlocked(r, 'table', 'spieltisch'));
  assert.ok(!unlocked(r, 'table', 'millefleurs'));
  const forged = cleanRecord({ ...r, look: { back: 'gold', table: 'millefleurs', edge: 'gold' }, games: 'many', earned: { madeUp: 1 } });
  assert.deepEqual(forged.look, DEFAULT_LOOK);
  assert.equal(forged.games, 0);
  assert.deepEqual(forged.earned, {});
  const fair = cleanRecord({ ...r, earned: { firstWin: 5 }, look: { back: 'ultramarin', table: 'millefleurs', edge: 'plain' } });
  assert.equal(fair.look.table, 'millefleurs');
});

test('what a first game most often brings unlocks the three other tables', () => {
  const first = ['trumpKing', 'lastRound', 'firstWin'];
  assert.deepEqual(ACHIEVEMENTS.slice(0, 3).map((a) => a.id), first);
  assert.deepEqual(ACHIEVEMENTS.slice(0, 3).map((a) => a.reward), [
    { kind: 'table', id: 'burgtafel' },
    { kind: 'table', id: 'pergament' },
    { kind: 'table', id: 'millefleurs' },
  ]);
});
