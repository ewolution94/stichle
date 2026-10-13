// The game: rooms, seats, rounds and the clock. No I/O: the HTTP layer (server/api.mjs) calls these
// functions and streams each player their own view; tests drive it with a fake clock.
//
// A room lives in memory only. A restart (a deploy) ends every game, and an empty room is forgotten
// after half an hour.
//
// Wizard's original game for 3 to 6 at the table (server/rules.mjs has the rules themselves): round
// n deals n cards, a turned card makes trump, everyone bids how many tricks they'll take, the tricks
// are played, and a bid met exactly scores. Anyone past six watches.
//
// Phases: lobby → play (game.phase: round → scored → the next round …) → final.
//
// Hands never leak: every stream is built for its page (view below). A player sees their own hand;
// the others, spectators and the big screen see only how many cards each seat holds. Finished
// tricks lie face down, as at the table: only the last one stays on view.

import { randomBytes, randomInt as cryptoInt } from 'node:crypto';
import { cleanAvatar, randomAvatar } from './avatar.mjs';
import { botBid, botPlay, botTrump } from './bots.mjs';
import { BIDDINGS, RuleError, SUITS, bid, bidders, deal, forbiddenBid, isJester, isWizard, legalCards, pickTrump, play, roundsFor, sortHand } from './rules.mjs';

export { BIDDINGS };

export class GameError extends Error {
  /** @param {string} code  @param {number} [status]  @param {Record<string, unknown>} [detail] */
  constructor(code, status = 400, detail = undefined) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** Room codes have no vowels, so no code spells a word. */
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/;

/** A clock per move: off, relaxed (60 s) or quick (25 s). When it runs out, the bot moves for you. */
export const CLOCKS = Object.freeze(['off', 'relaxed', 'quick']);
export const MOVE_SECONDS = Object.freeze({ relaxed: 60, quick: 25 });

/** clock: a clock per move · bidding: open (the original), uneven ("mustn't add up"), secret (R2). */
export const DEFAULT_SETTINGS = Object.freeze({ clock: 'off', bidding: 'open' });

export const LIMITS = {
  rooms: 200,
  players: 20,
  /** At the table: Wizard's three to six. */
  seats: 6,
  minSeats: 3,
  name: 16,
  roomsPer10Min: 40,
};

/**
 * How long a finished trick stays in the middle before the next card may come: it rests, its winner
 * shows, the cards gather (src/lib/table.ts → trickPhase), then it sweeps off for AFTER_SWEEP more.
 */
export const TRICK_PAUSE = 2600;
/** A bot or the stand-in waits this long past the pause, so the sweep is over before it leads. */
const AFTER_SWEEP = 600;
/** The round's result waits this long for everyone's "next", then the next round deals anyway. */
export const ROUND_WAIT = 25_000;
/** A seated player who's gone (closed the page) for this long on their move: the bot moves for them. */
export const AWAY_MS = 12_000;

const HOST_GRACE = 15_000;
const LOBBY_GRACE = 60_000;
const EMPTY_TTL = 30 * 60_000;
/** A game with no human online for this long ends, so bots never play on for no one. */
const UNWATCHED_MS = 2 * 60_000;
const IDLE_TTL = 4 * 60 * 60_000;
/** Bots think for a moment: between these many milliseconds. */
const BOT_THINK = [900, 1900];

const BOT_NAMES = ['Robo Rita', 'Bot Bernd', 'Karo Klaus', 'Trumpf Tina', 'Stich Sven'];

/**
 * @typedef {{ now(): number, setTimeout(fn: () => void, ms: number): any, clearTimeout(handle: any): void }} Clock
 * @typedef {{ player: string | null, send(event: string, data: string): void }} Subscriber
 */

const realClock = { now: Date.now, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) };

/**
 * @param {{ clock?: Clock, randomInt?: (n: number) => number }} [options]
 *   randomInt deals the cards and picks the first dealer (tests pass a seeded one)
 */
export function createGames({ clock = realClock, randomInt = (n) => cryptoInt(n) } = {}) {
  /** @type {Map<string, any>} */
  const rooms = new Map();
  const created = [];
  const random = () => randomInt(1_000_000) / 1_000_000;

  // ---- helpers ------------------------------------------------------------------------------

  function room(code) {
    const r = rooms.get(String(code ?? '').toUpperCase());
    if (!r) throw new GameError('no-room', 404);
    return r;
  }

  // ---- a page's retry is the same request ---------------------------------------------------
  // "New game" and a join carry a key the page keeps for every try of the same tap: a retry after
  // the page gave up (Folio's track(), 12 s) returns the seat the first try made, instead of a second
  // room or a second seat (development/plans/waiting-states.md). Kept for a minute.

  /** @type {Map<string, { seat: { code: string, player: string, token: string }, at: number }>} */
  const keyed = new Map();
  const KEY = /^[A-Za-z0-9-]{8,64}$/;
  const KEY_TTL = 60_000;

  function keyedSeat(key, code = null) {
    if (typeof key !== 'string' || !KEY.test(key)) return null;
    const t = clock.now();
    for (const [k, v] of keyed) if (t - v.at > KEY_TTL) keyed.delete(k);
    const hit = keyed.get(key);
    if (!hit || (code && hit.seat.code !== code)) return null;
    const p = rooms.get(hit.seat.code)?.players.get(hit.seat.player);
    return p && !p.left ? { ...hit.seat } : null;
  }

  function remember(key, seat) {
    if (typeof key === 'string' && KEY.test(key)) keyed.set(key, { seat, at: clock.now() });
    return seat;
  }

  function within(stamps, windowMs, limit) {
    const t = clock.now();
    while (stamps.length && stamps[0] <= t - windowMs) stamps.shift();
    if (stamps.length >= limit) return false;
    stamps.push(t);
    return true;
  }

  function newCode() {
    for (let i = 0; i < 100; i++) {
      let code = '';
      for (let j = 0; j < 4; j++) code += CODE_LETTERS[cryptoInt(CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
    throw new GameError('busy', 503);
  }

  function player(r, token) {
    if (typeof token !== 'string' || !token) throw new GameError('no-player', 401);
    for (const p of r.players.values()) if (p.token === token && !p.left && !p.bot) return p;
    throw new GameError('no-player', 401);
  }

  function requireHost(r, p) {
    if (r.host !== p.id) throw new GameError('not-host', 403);
  }

  function requirePhase(r, ...phases) {
    if (!phases.includes(r.phase)) throw new GameError('wrong-phase', 409);
  }

  /** Players who are still in the room, in the order they joined. */
  function present(r) {
    return [...r.players.values()].filter((p) => !p.left);
  }

  const isOnline = (p) => p.bot || p.online > 0;
  /** The players at the table, in seat order (the lobby's order; fixed once a game starts). */
  const seated = (r) => r.order.map((id) => r.players.get(id)).filter((p) => p && !p.left);

  function addPlayer(r, rawName, rawAvatar, bot = false) {
    if (present(r).length >= LIMITS.players) throw new GameError('room-full', 409);
    const base = cleanName(rawName);
    if (!base) throw new GameError('name');
    const taken = new Set(present(r).map((p) => p.name.toLowerCase()));
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
    const p = {
      id: randomBytes(6).toString('base64url'),
      token: bot ? '' : randomBytes(18).toString('base64url'),
      name,
      avatar: cleanAvatar(rawAvatar, random),
      bot,
      joined: clock.now(),
      online: 0,
      offlineSince: clock.now(),
      left: false,
    };
    r.players.set(p.id, p);
    // A free chair in the lobby is yours; past six, or once the cards are out, you watch.
    if (r.phase === 'lobby' && seated(r).length < LIMITS.seats) r.order.push(p.id);
    return p;
  }

  function touch(r) {
    r.touched = clock.now();
    r.version++;
    broadcast(r);
  }

  function later(r, ms, fn) {
    const handle = clock.setTimeout(() => {
      r.timers.delete(handle);
      if (rooms.get(r.code) === r) fn();
    }, ms);
    r.timers.add(handle);
    return handle;
  }

  function clearTimers(r) {
    for (const handle of r.timers) clock.clearTimeout(handle);
    r.timers.clear();
  }

  /** A refusal from the rules, as the game's own error. */
  function rule(fn) {
    try {
      return fn();
    } catch (error) {
      if (error instanceof RuleError) throw new GameError(error.code, 409);
      throw error;
    }
  }

  // ---- rounds -------------------------------------------------------------------------------

  function startGame(r) {
    const players = seated(r);
    if (players.length < LIMITS.minSeats) throw new GameError('too-few', 409);
    if (players.length > LIMITS.seats) throw new GameError('too-many', 409);
    const n = players.length;
    r.game = {
      n: ++r.games,
      seats: players.map((p) => p.id),
      rounds: roundsFor(n),
      round: 1,
      // The first dealer is drawn; the deal moves on one seat each round.
      dealer: randomInt(n),
      /** The house rule for bids, fixed for the game. */
      bidding: r.settings.bidding,
      state: null,
      phase: 'round',
      /** Finished rounds: what everyone bid, took and scored. */
      pad: [],
      totals: Array(n).fill(0),
      lastTrick: null,
      holdUntil: 0,
      ready: [],
      readyBy: 0,
      endsAt: null,
      /** A move counter: a timer set for one move does nothing once the game has moved on. */
      move: 0,
      startedAt: clock.now(),
      endedAt: null,
      ended: null,
      stoppedBy: null,
    };
    r.phase = 'play';
    r.notice = null;
    dealRound(r);
  }

  function dealRound(r) {
    const g = r.game;
    g.state = deal({ players: g.seats.length, round: g.round, dealer: g.dealer, randomInt, bidding: g.bidding });
    // What R2's achievements will count: each seat's Wizards and Jesters as dealt.
    g.dealt = g.state.hands.map((hand) => ({ z: hand.filter(isWizard).length, n: hand.filter(isJester).length }));
    sortHands(g);
    g.phase = 'round';
    g.lastTrick = null;
    g.holdUntil = 0;
    g.ready = [];
    moved(r);
  }

  function sortHands(g) {
    g.state.hands = g.state.hands.map((hand) => sortHand(hand, g.state.trump));
  }

  /** After every move: the clock for the next one, and the bots. */
  function moved(r) {
    const g = r.game;
    g.move++;
    g.endsAt = null;
    const s = g.state;
    if (g.phase === 'round' && s.phase !== 'done') {
      const seconds = MOVE_SECONDS[r.settings.clock];
      if (seconds) {
        const move = g.move;
        g.endsAt = clock.now() + seconds * 1000 + Math.max(0, g.holdUntil - clock.now());
        later(r, g.endsAt - clock.now() + 300, () => g.move === move && r.phase === 'play' && autoMove(r));
      }
    }
    touch(r);
    botsPlay(r);
  }

  /** Whose move the game waits for: the one in turn, or every secret bid still out. */
  const waiting = (s) => (s.phase === 'bid' ? bidders(s) : [s.turn]);

  /**
   * The move a bot would make for `seat` (default: every seat the game waits for, as when the clock
   * runs out on secret bids).
   */
  function autoMove(r, only = null) {
    const g = r.game;
    const s = g.state;
    if (g.phase !== 'round') return;
    if (s.phase === 'bid') {
      for (const seat of only === null ? waiting(s) : [only]) if (s.phase === 'bid' && bidders(s).includes(seat)) placeBid(r, seat, botBid(s, seat));
      return;
    }
    const seat = s.turn;
    if (s.phase === 'trump') return chooseTrump(r, seat, botTrump(s, seat));
    if (s.phase === 'play') {
      const wait = g.holdUntil - clock.now();
      if (wait > 0) {
        const move = g.move;
        later(r, wait + 50, () => g.move === move && autoMove(r));
        return;
      }
      return playCard(r, seat, botPlay(s, seat));
    }
  }

  function chooseTrump(r, seat, suit) {
    const g = r.game;
    rule(() => pickTrump(g.state, seat, suit));
    sortHands(g);
    moved(r);
  }

  function placeBid(r, seat, n) {
    rule(() => bid(r.game.state, seat, n));
    moved(r);
  }

  function playCard(r, seat, card) {
    const g = r.game;
    if (clock.now() < g.holdUntil) throw new GameError('wait', 409);
    const result = rule(() => play(g.state, seat, card));
    if (result.trick) {
      g.lastTrick = { ...result.trick, n: g.state.tricks.length };
      g.holdUntil = clock.now() + TRICK_PAUSE;
    }
    if (result.done) {
      // The last trick stays in the middle for its moment, then the round's result.
      const n = g.round;
      later(r, TRICK_PAUSE, () => r.phase === 'play' && g.round === n && g.phase === 'round' && score(r));
    }
    moved(r);
  }

  function score(r) {
    const g = r.game;
    const s = g.state;
    g.pad.push({ round: g.round, dealer: g.dealer, trump: s.trump, trumpCard: s.trumpCard, bids: [...s.bids], won: [...s.won], points: [...s.points], dealt: g.dealt });
    g.totals = g.totals.map((t, i) => t + s.points[i]);
    if (g.round >= g.rounds) return finish(r, 'done');
    g.phase = 'scored';
    g.ready = [];
    g.readyBy = clock.now() + ROUND_WAIT;
    const round = g.round;
    later(r, ROUND_WAIT, () => r.phase === 'play' && g.phase === 'scored' && g.round === round && nextRound(r));
    moved(r);
    readyCheck(r);
  }

  /** Everyone at the table who's here has tapped "next" (bots and the absent count as ready). */
  function readyCheck(r) {
    const g = r.game;
    if (g.phase !== 'scored') return;
    const waiting = g.seats.map((id) => r.players.get(id)).filter((p) => p && !p.left && !p.bot && p.online > 0 && !g.ready.includes(p.id));
    if (!waiting.length) nextRound(r);
  }

  function nextRound(r) {
    const g = r.game;
    g.round++;
    g.dealer = (g.dealer + 1) % g.seats.length;
    dealRound(r);
  }

  function finish(r, reason) {
    const g = r.game;
    clearTimers(r);
    g.ended = reason;
    g.endedAt = clock.now();
    g.endsAt = null;
    g.phase = 'final';
    r.phase = 'final';
    r.unwatchedSince = null;
    touch(r);
  }

  // ---- bots and the absent ------------------------------------------------------------------

  const think = () => BOT_THINK[0] + randomInt(BOT_THINK[1] - BOT_THINK[0]);

  /** If it's a bot's move, or the move of someone who's gone: it happens in a moment. */
  function botsPlay(r) {
    const g = r.game;
    if (r.phase !== 'play' || !g) return;
    if (g.phase === 'scored') return readyCheck(r);
    const s = g.state;
    if (s.phase === 'done') return;
    const move = g.move;
    const still = () => r.phase === 'play' && g.move === move;
    for (const seat of waiting(s)) {
      const p = r.players.get(g.seats[seat]);
      const only = s.phase === 'bid' ? seat : null;
      if (!p || p.bot) {
        const wait = Math.max(think(), g.holdUntil - clock.now() + AFTER_SWEEP);
        later(r, wait, () => still() && autoMove(r, only));
      } else if (p.left || p.online === 0) {
        const gone = p.left ? 0 : AWAY_MS - Math.min(AWAY_MS, clock.now() - (p.offlineSince ?? clock.now()));
        later(r, Math.max(gone, think(), g.holdUntil - clock.now() + AFTER_SWEEP), () => still() && (p.left || p.online === 0) && autoMove(r, only));
      }
    }
  }

  // ---- what each page gets ------------------------------------------------------------------

  /** @param {any} r  @param {any | null} viewer  the player whose page this is; null for the big screen */
  function view(r, viewer) {
    const me = viewer && !viewer.left ? viewer : null;
    return {
      code: r.code,
      phase: r.phase,
      version: r.version,
      host: r.host,
      me: me?.id ?? null,
      settings: { ...r.settings },
      notice: r.notice,
      order: seated(r).map((p) => p.id),
      players: present(r).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        online: isOnline(p),
        bot: p.bot,
      })),
      game: r.game ? gameView(r, r.game, me) : null,
      now: clock.now(),
    };
  }

  function gameView(r, g, me) {
    const s = g.state;
    const mine = me ? g.seats.indexOf(me.id) : -1;
    const final = g.phase === 'final';
    return {
      n: g.n,
      seats: g.seats,
      /** Seats whose player has left: the bot plays for them. */
      gone: g.seats.map((id) => Boolean(r.players.get(id)?.left)),
      rounds: g.rounds,
      round: g.round,
      dealer: g.dealer,
      phase: g.phase,
      stage: s.phase,
      turn: s.turn,
      bidding: g.bidding,
      /** The seats the game waits for: the one in turn, or every secret bid still out. */
      waiting: g.phase === 'round' && s.phase !== 'done' ? waiting(s) : [],
      trumpCard: s.trumpCard,
      trump: s.trump,
      // Secret bids stay with their bidder until all are in.
      bids: g.bidding === 'secret' && s.phase === 'bid' ? s.bids.map((b, i) => (i === mine ? b : null)) : s.bids,
      bidIn: s.bids.map((b) => b !== null),
      /** The one bid you mayn't make ("mustn't add up"), or null. */
      forbidden: mine >= 0 ? forbiddenBid(s, mine) : null,
      won: s.won,
      trick: s.trick,
      lastTrick: g.lastTrick,
      holdUntil: g.holdUntil,
      counts: s.hands.map((h) => h.length),
      hand: mine >= 0 && !final ? s.hands[mine] : null,
      legal: mine >= 0 && s.phase === 'play' && s.turn === mine && g.phase === 'round' ? legalCards(s, mine) : [],
      pad: g.pad.map(({ dealt, ...row }) => row),
      totals: g.totals,
      ready: g.ready,
      readyBy: g.phase === 'scored' ? g.readyBy : null,
      endsAt: g.endsAt,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      ended: g.ended,
      stoppedBy: g.stoppedBy,
    };
  }

  function broadcast(r) {
    for (const s of r.subscribers) {
      const p = s.player ? r.players.get(s.player) : null;
      s.send('view', JSON.stringify(view(r, p)));
    }
  }

  // ---- host and housekeeping ----------------------------------------------------------------

  function handOver(r) {
    const host = r.players.get(r.host);
    if (host && !host.left && host.online > 0) return;
    const next = present(r).find((p) => !p.bot && p.online > 0);
    if (next && next.id !== r.host) {
      r.host = next.id;
      touch(r);
    }
  }

  function removePlayer(r, p) {
    if (r.phase === 'lobby') {
      r.players.delete(p.id);
      r.order = r.order.filter((id) => id !== p.id);
    } else p.left = true;
    p.online = 0;
    const people = present(r).filter((q) => !q.bot);
    if (!people.length) {
      clearTimers(r);
      rooms.delete(r.code);
      for (const s of r.subscribers) s.send('view', JSON.stringify({ code: r.code, phase: 'gone' }));
      return;
    }
    if (r.host === p.id) r.host = (people.find((q) => q.online > 0) ?? people[0]).id;
    touch(r);
    // A seat whose player left is played by the bot from now on.
    botsPlay(r);
  }

  return {
    get size() {
      return rooms.size;
    },

    /** @param {{ name: unknown, avatar?: unknown, key?: unknown }} body */
    create({ name, avatar, key }) {
      // A retry of the same "New game" (the first try timed out on the page): the same room and seat.
      const again = keyedSeat(key);
      if (again) return again;
      if (!cleanName(name)) throw new GameError('name');
      if (rooms.size >= LIMITS.rooms || !within(created, 10 * 60_000, LIMITS.roomsPer10Min)) throw new GameError('busy', 429);
      const code = newCode();
      const r = {
        code,
        created: clock.now(),
        touched: clock.now(),
        /** Since when no human has been online during a game (null while someone is). */
        unwatchedSince: null,
        version: 0,
        host: '',
        players: new Map(),
        /** The table's seats, in order around it. */
        order: [],
        settings: { ...DEFAULT_SETTINGS },
        phase: 'lobby',
        game: null,
        games: 0,
        notice: null,
        timers: new Set(),
        subscribers: new Set(),
      };
      rooms.set(code, r);
      const p = addPlayer(r, name, avatar);
      r.host = p.id;
      return remember(key, { code, player: p.id, token: p.token });
    },

    /** A quick look before joining: does the room exist, and is it open? */
    info(code) {
      const r = rooms.get(String(code ?? '').toUpperCase());
      if (!r) return null;
      return { code: r.code, phase: r.phase, players: present(r).length, full: present(r).length >= LIMITS.players };
    },

    /**
     * Joins, or comes back: a known token gets the same seat again. A token alone that no longer
     * fits (kicked, or dropped from the lobby) is refused. `key`: a retried join gets the same seat.
     * @param {{ name?: unknown, avatar?: unknown, token?: unknown, key?: unknown }} body
     */
    join(code, { name, avatar, token, key }) {
      const r = room(code);
      const again = keyedSeat(key, r.code);
      if (again) return again;
      if (typeof token === 'string' && token) {
        for (const p of r.players.values()) {
          if (p.token === token && !p.left && !p.bot) return { code: r.code, player: p.id, token: p.token };
        }
        if (!cleanName(name)) throw new GameError('no-player', 401);
      }
      const p = addPlayer(r, name, avatar);
      touch(r);
      return remember(key, { code: r.code, player: p.id, token: p.token });
    },

    view(code, playerId = null) {
      const r = room(code);
      return view(r, playerId ? (r.players.get(playerId) ?? null) : null);
    },

    /**
     * Streams the room to one page: its view now and after every change ('view'). Returns the
     * unsubscribe function.
     * @param {(event: string, data: string) => void} send
     */
    subscribe(code, playerId, send) {
      const r = room(code);
      const p = r.players.get(String(playerId ?? ''));
      const me = p && !p.left && !p.bot ? p : null;
      /** @type {Subscriber} */
      const sub = { player: me?.id ?? null, send };
      r.subscribers.add(sub);
      if (me) {
        me.online++;
        me.offlineSince = null;
      }
      send('view', JSON.stringify(view(r, me)));
      if (me && me.online === 1) touch(r);
      return () => {
        if (!r.subscribers.delete(sub)) return;
        if (me && !me.left) {
          me.online = Math.max(0, me.online - 1);
          if (me.online === 0) {
            me.offlineSince = clock.now();
            touch(r);
            // Gone on their move: the bot takes it after a while. Gone while the round's result
            // shows: the others don't wait for them.
            botsPlay(r);
          }
        }
      };
    },

    /**
     * A player's move. Throws GameError for anything not allowed right now.
     * @param {string} code  @param {unknown} token  @param {string} action  @param {any} body
     */
    act(code, token, action, body = {}) {
      const r = room(code);
      const p = player(r, token);
      r.touched = clock.now();
      const g = r.game;
      const mine = g ? g.seats.indexOf(p.id) : -1;

      switch (action) {
        case 'settings': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          r.settings = mergeSettings(r.settings, body);
          touch(r);
          return;
        }
        case 'sit': {
          // Your own chair: at the table (while one is free) or watching.
          requirePhase(r, 'lobby', 'final');
          setSeated(r, p, body?.seated !== false);
          touch(r);
          return;
        }
        case 'move': {
          // The host seats anyone, or sends them to watch.
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          const target = r.players.get(String(body?.player ?? ''));
          if (!target || target.left) throw new GameError('no-player', 404);
          setSeated(r, target, body?.seated !== false);
          touch(r);
          return;
        }
        case 'shuffle': {
          // New places around the table, drawn.
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          const order = [...r.order];
          for (let i = order.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [order[i], order[j]] = [order[j], order[i]];
          }
          r.order = order;
          touch(r);
          return;
        }
        case 'start': {
          requireHost(r, p);
          requirePhase(r, 'lobby');
          startGame(r);
          return;
        }
        case 'trump': {
          requirePhase(r, 'play');
          if (g.phase !== 'round') throw new GameError('wrong-phase', 409);
          if (!SUITS.includes(body?.suit)) throw new GameError('suit');
          chooseTrump(r, mine, body.suit);
          return;
        }
        case 'bid': {
          requirePhase(r, 'play');
          if (g.phase !== 'round') throw new GameError('wrong-phase', 409);
          placeBid(r, mine, body?.n);
          return;
        }
        case 'play': {
          requirePhase(r, 'play');
          if (g.phase !== 'round') throw new GameError('wrong-phase', 409);
          if (typeof body?.card !== 'string') throw new GameError('card');
          playCard(r, mine, body.card);
          return;
        }
        case 'next': {
          // Ready for the next round (the round's result has been seen).
          requirePhase(r, 'play');
          if (g.phase !== 'scored') throw new GameError('wrong-phase', 409);
          if (!g.ready.includes(p.id)) g.ready.push(p.id);
          touch(r);
          readyCheck(r);
          return;
        }
        case 'stop': {
          // The host ends the game for everyone: the end screen with the scores so far
          // (development/plans/end-game.md).
          requireHost(r, p);
          requirePhase(r, 'play');
          g.stoppedBy = p.id;
          finish(r, 'stopped');
          return;
        }
        case 'rematch': {
          // Again: the same table straight into a new game, or back to the lobby to change it.
          requireHost(r, p);
          requirePhase(r, 'final');
          clearTimers(r);
          for (const q of [...r.players.values()]) {
            if (!q.left) continue;
            r.players.delete(q.id);
            r.order = r.order.filter((id) => id !== q.id);
          }
          r.game = null;
          r.notice = null;
          r.phase = 'lobby';
          if (body?.lobby) {
            touch(r);
            return;
          }
          try {
            startGame(r);
          } catch (error) {
            touch(r);
            throw error;
          }
          return;
        }
        case 'bot': {
          requireHost(r, p);
          requirePhase(r, 'lobby', 'final');
          const bots = present(r).filter((q) => q.bot);
          if (body?.add) {
            if (seated(r).length >= LIMITS.seats) throw new GameError('table-full', 409);
            const used = new Set(bots.map((b) => b.name));
            const name = BOT_NAMES.find((n) => !used.has(n)) ?? BOT_NAMES[0];
            const bot = addPlayer(r, name, randomAvatar(random), true);
            if (!r.order.includes(bot.id)) r.order.push(bot.id);
            touch(r);
          } else {
            const target = body?.player ? r.players.get(String(body.player)) : bots.at(-1);
            if (target?.bot) {
              r.players.delete(target.id);
              r.order = r.order.filter((id) => id !== target.id);
              touch(r);
            }
          }
          return;
        }
        case 'avatar': {
          p.avatar = cleanAvatar(body?.avatar, random);
          touch(r);
          return;
        }
        case 'kick': {
          requireHost(r, p);
          const target = r.players.get(String(body?.player ?? ''));
          if (!target || target.left || target.id === p.id) throw new GameError('no-player', 404);
          removePlayer(r, target);
          return;
        }
        case 'leave': {
          removePlayer(r, p);
          return;
        }
        default:
          throw new GameError('unknown-action', 404);
      }
    },

    /**
     * Housekeeping, every few seconds: hand the host's seat on, drop people who closed the page in
     * the lobby, end a game nobody is watching, forget empty rooms, and catch a lost clock.
     */
    tick() {
      const now = clock.now();
      for (const r of rooms.values()) {
        const online = present(r).filter((p) => !p.bot && p.online > 0);
        if ((!online.length && now - r.touched > EMPTY_TTL) || now - r.touched > IDLE_TTL) {
          clearTimers(r);
          for (const s of r.subscribers) s.send('view', JSON.stringify({ code: r.code, phase: 'gone' }));
          rooms.delete(r.code);
          continue;
        }
        if (r.phase === 'play') {
          if (online.length) r.unwatchedSince = null;
          else {
            r.unwatchedSince ??= now;
            if (now - r.unwatchedSince >= UNWATCHED_MS) {
              r.unwatchedSince = null;
              finish(r, 'left');
              continue;
            }
          }
          const g = r.game;
          if (g.endsAt && now >= g.endsAt + 2000) autoMove(r);
        }
        const host = r.players.get(r.host);
        if (host && host.online === 0 && host.offlineSince !== null && now - host.offlineSince >= HOST_GRACE) handOver(r);
        if (r.phase === 'lobby') {
          for (const p of present(r)) {
            if (!p.bot && p.id !== r.host && p.online === 0 && p.offlineSince !== null && now - p.offlineSince >= LOBBY_GRACE) removePlayer(r, p);
          }
        }
      }
    },

    /** Stops every timer (shutdown, tests). */
    close() {
      for (const r of rooms.values()) {
        clearTimers(r);
        r.subscribers.clear();
      }
      rooms.clear();
    },
  };

  /** At the table or watching; a full table refuses one more. */
  function setSeated(r, p, wanted) {
    const at = r.order.includes(p.id);
    if (wanted && !at) {
      if (seated(r).length >= LIMITS.seats) throw new GameError('table-full', 409);
      r.order.push(p.id);
    } else if (!wanted && at) {
      r.order = r.order.filter((id) => id !== p.id);
    }
  }
}

/**
 * A display name: printable, single-spaced, at most LIMITS.name characters (graphemes, so an emoji
 * counts as one). Empty when nothing usable is left.
 */
export function cleanName(raw) {
  return cleanText(raw, LIMITS.name);
}

/** Printable, single-spaced text of at most `max` graphemes. */
export function cleanText(raw, max) {
  if (typeof raw !== 'string') return '';
  const text = raw
    .slice(0, max * 8)
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Co}\p{Cn}]|(?!‍)\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const graphemes = [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return graphemes.slice(0, max).join('').trim();
}

/** The settings with a host's changes applied; anything invalid is ignored. */
export function mergeSettings(current, body) {
  const next = { ...current };
  if (CLOCKS.includes(body?.clock)) next.clock = body.clock;
  if (BIDDINGS.includes(body?.bidding)) next.bidding = body.bidding;
  return next;
}
