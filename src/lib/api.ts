// The server's shapes (server/game.mjs → view) and the calls that change them.

import type { Avatar } from './avatar';
import type { Suit } from './deck';

export type Phase = 'lobby' | 'play' | 'final' | 'gone';
export type ClockChoice = 'off' | 'relaxed' | 'quick';
/** open: the original · uneven: the bids mayn't add up · secret: everyone at once, unseen (R2). */
export type Bidding = 'open' | 'uneven' | 'secret';
/** A card id: "fire-7", "z-water" (a Wizard), "n-air" (a Jester). */
export type CardId = string;

/** How long a game is (R3): every round, every other one (1, 3, 5 …), or the first half. */
export type Length = 'full' | 'half' | 'short';
/** The table's pace (R3): the trick's pause and the bots' thinking, at leisure or quicker. */
export type Tempo = 'normal' | 'fast';

/** A bot's rank (the user, 2026-10-14): as in a guild, weakest first (server/bots.mjs). */
export type Level = 'apprentice' | 'journeyman' | 'master';
export const LEVELS: Level[] = ['apprentice', 'journeyman', 'master'];
/** A bot's temperament, which comes with its name: how high it bids. */
export type Temper = 'cautious' | 'steady' | 'bold';

export interface Settings {
  clock: ClockChoice;
  bidding: Bidding;
  length: Length;
  tempo: Tempo;
  /** The forehead round (R3): the one-card round played blind to your own card. */
  forehead: boolean;
  /** The special cards (R3): the Drache, the Fee and the Dieb in a deck of 63. */
  specials: boolean;
  /** The bots' rank: every bot's (until the host gives one its own) and the stand-ins'. */
  bots?: Level;
}

export interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  online: boolean;
  bot: boolean;
  /** A bot's rank and temperament. */
  level?: Level;
  temper?: Temper;
}

export interface Played {
  seat: number;
  card: CardId;
}

export interface Trick {
  lead: number;
  cards: Played[];
}

export interface FinishedTrick extends Trick {
  /** Who took it; with the Dieb in it, who would have (they lead next) and `stolen` is set. */
  winner: number;
  /** The Dieb was in it (R3's special cards): the trick counts for nobody. */
  stolen?: boolean;
  /** Which trick of the round (1 = the first). */
  n: number;
}

export interface PadRow {
  /** Which round of the game (1 …). */
  no: number;
  /** The cards it dealt (the same as `no` in a full game). */
  round: number;
  /** The last round of a full game. */
  final: boolean;
  dealer: number;
  trump: Suit | null;
  trumpCard: CardId | null;
  bids: number[];
  won: number[];
  points: number[];
}

export type Ended = 'done' | 'stopped' | 'left';

export interface Game {
  n: number;
  /** Player ids, in seat order around the table. */
  seats: string[];
  /** Seats whose player has left (the bot plays for them). */
  gone: boolean[];
  rounds: number;
  /** Which round this is (1 …); `round` is the cards it deals (they differ in a half game). */
  no: number;
  round: number;
  length: Length;
  tempo: Tempo;
  forehead: boolean;
  specials: boolean;
  /** In the forehead round, each other seat's card while it's held (yours null); otherwise null. */
  foreheads: (CardId | null)[] | null;
  dealer: number;
  /** round: the cards are out · scored: the round's result · final: the game is over */
  phase: 'round' | 'scored' | 'final';
  /** The round's own step: the dealer picks trump (a Wizard was turned), the bids, the tricks. */
  stage: 'trump' | 'bid' | 'play' | 'done';
  turn: number;
  bidding: Bidding;
  /** The seats the game waits for: the one in turn, or every secret bid still out. */
  waiting: number[];
  trumpCard: CardId | null;
  trump: Suit | null;
  /** Secret bids show only your own until all are in. */
  bids: (number | null)[];
  /** Who has bid (secret bids too). */
  bidIn: boolean[];
  /** The one bid you mayn't make ("mustn't add up"), or null. */
  forbidden: number | null;
  won: number[];
  trick: Trick;
  lastTrick: FinishedTrick | null;
  /** Until then the finished trick stays in the middle and no card may come. */
  holdUntil: number;
  /** Cards left in each seat's hand. */
  counts: number[];
  /** Your hand (null when you only watch). */
  hand: CardId[] | null;
  /** What you may play now (empty when it's not your move). */
  legal: CardId[];
  pad: PadRow[];
  totals: number[];
  ready: string[];
  readyBy: number | null;
  endsAt: number | null;
  /** A move's length on the clock in seconds; 0 without a clock. */
  moveSeconds: number;
  startedAt: number;
  endedAt: number | null;
  ended: Ended | null;
  stoppedBy: string | null;
}

export interface View {
  code: string;
  phase: Phase;
  version: number;
  host: string;
  me: string | null;
  settings: Settings;
  notice: string | null;
  /** The players at the table, in seat order. */
  order: string[];
  players: Player[];
  game: Game | null;
  now: number;
}

export interface Seat {
  code: string;
  player: string;
  token: string;
}

export interface Config {
  clocks: ClockChoice[];
  moveSeconds: Record<string, number>;
  biddings: Bidding[];
  lengths: Length[];
  tempos: Tempo[];
  seats: { min: number; max: number };
}

/**
 * A refusal from the server ("no-room", "follow" …), a network failure ("offline"), the server or
 * Cloudflare in trouble ("busy": a 5xx without the game's own answer) or no answer in time
 * ("timeout": Folio's track() gave up). The last three are worth "Try again" (waiting.ts).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: 'no-store' });
  } catch {
    // Given up on (the signal from track()), or the network: Safari says "Load failed", Chrome
    // "Failed to fetch", so classify by type (learnings/ios-and-webkit.md).
    throw new ApiError(init.signal?.aborted ? 'timeout' : 'offline');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const { error, ...detail } = body ?? {};
    // A 5xx without the game's own error is the NAS or Cloudflare (a 502, a 1033 page).
    throw new ApiError(error ?? (response.status >= 500 ? 'busy' : `http-${response.status}`), response.status, detail);
  }
  return body as T;
}

const post = (body: unknown, token?: string, signal?: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-stichle-token': token } : {}) },
  body: JSON.stringify(body ?? {}),
  signal,
});

/**
 * A deploy restarts the server and ends every room; for a few seconds a create or join can fail.
 * One quiet retry, then the error (learnings/projects/vollmond.md). Safe for create and join: they
 * carry a key, so a retry gets the seat a first try may have made. Not once the page gave up.
 */
async function again<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (signal?.aborted || !(error instanceof ApiError) || (error.code !== 'offline' && error.status < 500)) throw error;
    await new Promise((r) => setTimeout(r, 1500));
    if (signal?.aborted) throw error;
    return fn();
  }
}

export const api = {
  config: () => again(() => request<Config>('/api/config')),
  /** `key`: the same for every try of one "New game", so a retry after a timeout gets the same room. */
  create: (name: string, avatar: Avatar, key?: string, signal?: AbortSignal) =>
    again(() => request<Seat>('/api/rooms', post({ name, avatar, key }, undefined, signal)), signal),
  info: (code: string) => request<{ code: string; phase: Phase; players: number; full: boolean }>(`/api/rooms/${code}`),
  /** `key`: as for create, so a retried join doesn't seat you twice. */
  join: (code: string, name: string, avatar: Avatar | null, token?: string, key?: string, signal?: AbortSignal) =>
    again(() => request<Seat>(`/api/rooms/${code}/join`, post({ name, avatar, token, key }, undefined, signal)), signal),
  act: (seat: Seat, action: string, body?: unknown, signal?: AbortSignal) => request<void>(`/api/rooms/${seat.code}/${action}`, post(body, seat.token, signal)),
};

/** Room codes: four consonants (server/game.mjs → CODE). */
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;
