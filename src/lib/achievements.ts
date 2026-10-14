// Your record and its achievements, kept on this device (development/plans/stichle.md → Release 2):
// no accounts and no server state. Everything here is worked out from what your own view already
// shows: your hand at the deal, your bids and tricks, the tricks you took and with what card, the
// final standings. Pure functions on a plain record, so the tests run them directly
// (tests/achievements.test.mjs); src/lib/profile.svelte.ts keeps the record and Tracker.svelte feeds it.
//
// No imports at run time: Node's type stripping loads this file as it is in the tests.

export type AchievementId =
  | 'firstWin'
  | 'tenGames'
  | 'perfect'
  | 'streak5'
  | 'zeroWizard'
  | 'fourWizards'
  | 'jesterTrick'
  | 'lastRound'
  | 'bigBid'
  | 'comeback'
  | 'trumpKing'
  | 'fullTable';

export type BackId = 'ultramarin' | 'bordeaux' | 'waldgruen' | 'nacht' | 'gold' | 'silber' | 'kupfer';
/** The table you play on and the room round it (src/app.css): the card table for everyone, the
 *  tapestry, the vellum and the slate as the first unlocks, two more baizes for the rarer ones. */
export type TableId = 'spieltisch' | 'millefleurs' | 'pergament' | 'burgtafel' | 'karmesin' | 'nachtblau';
export type EdgeId = 'plain' | 'gold';
export type Reward = { kind: 'back'; id: BackId } | { kind: 'table'; id: TableId } | { kind: 'edge'; id: EdgeId };

export interface Achievement {
  id: AchievementId;
  /** What the seal shows. */
  glyph: string;
  /** For the ones that count up: how far. */
  goal?: number;
  reward: Reward;
}

/** In the order the collection shows them: the first steps, then the craft, then the rare ones. The
 *  three a first game most often brings unlock the three other tables. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'trumpKing', glyph: '13', reward: { kind: 'table', id: 'burgtafel' } },
  { id: 'lastRound', glyph: 'Ω', reward: { kind: 'table', id: 'pergament' } },
  { id: 'firstWin', glyph: '1', reward: { kind: 'table', id: 'millefleurs' } },
  { id: 'tenGames', glyph: '10', goal: 10, reward: { kind: 'back', id: 'bordeaux' } },
  { id: 'streak5', glyph: '5', goal: 5, reward: { kind: 'table', id: 'karmesin' } },
  { id: 'zeroWizard', glyph: '0', reward: { kind: 'back', id: 'waldgruen' } },
  { id: 'bigBid', glyph: '8+', reward: { kind: 'back', id: 'kupfer' } },
  { id: 'jesterTrick', glyph: 'N', reward: { kind: 'back', id: 'silber' } },
  { id: 'comeback', glyph: '↑', reward: { kind: 'table', id: 'nachtblau' } },
  { id: 'fullTable', glyph: '6', reward: { kind: 'back', id: 'nacht' } },
  { id: 'perfect', glyph: '✓', reward: { kind: 'edge', id: 'gold' } },
  { id: 'fourWizards', glyph: 'Z', reward: { kind: 'back', id: 'gold' } },
];

export interface Look {
  back: BackId;
  table: TableId;
  edge: EdgeId;
}

export const DEFAULT_LOOK: Look = { back: 'ultramarin', table: 'spieltisch', edge: 'plain' };

export interface PlayerRecord {
  v: 1;
  games: number;
  wins: number;
  rounds: number;
  met: number;
  /** Rounds met in a row, now and at best. */
  streak: number;
  bestStreak: number;
  /** Achievement → when it was earned (ms). */
  earned: Partial<Record<AchievementId, number>>;
  /** Deals, tricks, rounds and games already counted (so a reload never counts one twice). */
  counted: string[];
  look: Look;
}

export function emptyRecord(): PlayerRecord {
  return { v: 1, games: 0, wins: 0, rounds: 0, met: 0, streak: 0, bestStreak: 0, earned: {}, counted: [], look: { ...DEFAULT_LOOK } };
}

/** A record from whatever was stored (or pasted): anything unusable falls back to the empty one. */
export function cleanRecord(raw: unknown): PlayerRecord {
  const base = emptyRecord();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PlayerRecord>;
  const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0);
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  const earned: PlayerRecord['earned'] = {};
  for (const [id, at] of Object.entries(r.earned ?? {})) if (known.has(id as AchievementId) && typeof at === 'number') earned[id as AchievementId] = at;
  const record: PlayerRecord = {
    v: 1,
    games: count(r.games),
    wins: count(r.wins),
    rounds: count(r.rounds),
    met: count(r.met),
    streak: count(r.streak),
    bestStreak: count(r.bestStreak),
    earned,
    counted: Array.isArray(r.counted) ? r.counted.filter((k) => typeof k === 'string').slice(-400) : [],
    look: { ...DEFAULT_LOOK },
  };
  // A look is kept only when it's unlocked (a pasted code can't skip that).
  const look = r.look ?? DEFAULT_LOOK;
  for (const kind of ['back', 'table', 'edge'] as const) {
    const id = look[kind];
    if (typeof id === 'string' && unlocked(record, kind, id)) (record.look as unknown as Record<string, string>)[kind] = id;
  }
  return record;
}

/** Whether a look can be chosen: the defaults always, the rest once their achievement is earned. */
export function unlocked(record: PlayerRecord, kind: Reward['kind'], id: string) {
  if (id === DEFAULT_LOOK[kind]) return true;
  return ACHIEVEMENTS.some((a) => a.reward.kind === kind && a.reward.id === id && record.earned[a.id]);
}

/** Which achievement unlocks a look (null for a default). */
export const unlockedBy = (kind: Reward['kind'], id: string) => ACHIEVEMENTS.find((a) => a.reward.kind === kind && a.reward.id === id) ?? null;

/** How far a counting achievement has got (0 to goal). */
export function progress(record: PlayerRecord, id: AchievementId) {
  if (id === 'tenGames') return Math.min(10, record.games);
  if (id === 'streak5') return Math.min(5, record.bestStreak);
  return record.earned[id] ? 1 : 0;
}

// ---- counting ---------------------------------------------------------------------------------

/** Counts something once: false if this key was counted before. */
function once(record: PlayerRecord, key: string) {
  if (record.counted.includes(key)) return false;
  record.counted.push(key);
  if (record.counted.length > 400) record.counted.splice(0, record.counted.length - 400);
  return true;
}

function award(record: PlayerRecord, ids: (AchievementId | false)[], now: number) {
  const fresh: AchievementId[] = [];
  for (const id of ids) {
    if (!id || record.earned[id]) continue;
    record.earned[id] = now;
    fresh.push(id);
  }
  return fresh;
}

const isWizard = (card: string) => card.startsWith('z-');
const isJester = (card: string) => card.startsWith('n-');

/** Your hand as dealt: all four Wizards in it. Returns what was newly earned. */
export function countDeal(record: PlayerRecord, key: string, hand: string[], now = Date.now()) {
  if (!once(record, key)) return [];
  return award(record, [hand.filter(isWizard).length === 4 && 'fourWizards'], now);
}

/** A trick you took: with a Jester (only Jesters were played), or with the 13 of trump. */
export function countTrick(record: PlayerRecord, key: string, mine: string | null, trump: string | null, now = Date.now()) {
  if (!mine || !once(record, key)) return [];
  return award(record, [isJester(mine) && 'jesterTrick', trump !== null && mine === `${trump}-13` && 'trumpKing'], now);
}

/**
 * A round's result for you: bid and tricks, whether it was the last round, and how many Wizards
 * you were dealt (null when unknown, after a reload mid-round).
 */
export function countRound(
  record: PlayerRecord,
  key: string,
  { bid, won, last, wizards }: { bid: number; won: number; last: boolean; wizards: number | null },
  now = Date.now(),
) {
  if (!once(record, key)) return [];
  const met = bid === won;
  record.rounds++;
  if (met) {
    record.met++;
    record.streak++;
    record.bestStreak = Math.max(record.bestStreak, record.streak);
  } else record.streak = 0;
  return award(
    record,
    [
      met && record.streak >= 5 && 'streak5',
      met && bid === 0 && (wizards ?? 0) > 0 && 'zeroWizard',
      met && bid >= 8 && 'bigBid',
      met && last && 'lastRound',
    ],
    now,
  );
}

/**
 * A finished game (played to the end, not stopped): the totals per seat, your seat, every round's
 * points per seat, how many sat at the table, and whether it was a full-length game (R3: a half or
 * short game counts, but never earns "perfect", the rarest).
 */
export function countGame(
  record: PlayerRecord,
  key: string,
  { totals, mine, points, bids, won, players, full = true }: { totals: number[]; mine: number; points: number[][]; bids: number[][]; won: number[][]; players: number; full?: boolean },
  now = Date.now(),
) {
  if (!once(record, key)) return [];
  record.games++;
  const best = Math.max(...totals);
  const win = totals[mine] === best;
  if (win) record.wins++;
  // At half time, were you last (alone or shared)?
  const half = Math.floor(points.length / 2);
  let behind = false;
  if (half > 0) {
    const sums = totals.map((_, seat) => points.slice(0, half).reduce((s, row) => s + row[seat], 0));
    behind = sums[mine] === Math.min(...sums) && sums.some((s) => s > sums[mine]);
  }
  const perfect = full && bids.length > 0 && bids.every((row, i) => row[mine] === won[i][mine]);
  return award(
    record,
    [win && 'firstWin', record.games >= 10 && 'tenGames', perfect && 'perfect', win && behind && 'comeback', players === 6 && 'fullTable'],
    now,
  );
}
