// The live room: the server's view of it, pushed over Server-Sent Events, and the moves you send.
//
// EventSource gives up for good after one error page (Cloudflare's 502 during a deploy), so it
// reconnects itself, with backoff, and right away when the tab comes back or the network returns
// (learnings/node-server.md). A stream that dies without an error is noticed by its silence: the
// server pings every 20 s (plans/live-connection.md).

import { api, type Seat, type View } from './api';

const BACKOFF = [1000, 2000, 4000, 8000, 15000];
/** No sign of life for this long (the server's ping comes every 20 s): the stream died quietly. */
const STALE = 45_000;
/** Back from the background on a stream silent for longer than a heartbeat: reopen it at once. */
const QUIET = 25_000;


/** One stream, either a player's (with a seat) or the big screen's (code only). */
export class Room {
  /** Replaced whole on every message, so it stays raw (no deep proxy to compare against). */
  view: View | null = $state.raw(null);
  /** The stream is open. */
  live = $state(false);
  /** It has been open before: a closed stream now is a reconnect, not the first connect. */
  wasLive = $state(false);
  /** Server clock minus ours, for the countdown. */
  offset = $state(0);

  #source: EventSource | null = null;
  #attempt = 0;
  #timer = 0;
  #closed = false;
  /** The last sign of life from the stream: opened, a view, a ping. */
  #last = 0;
  #watch = 0;
  /** The last eight readings of the server's clock; the largest has the least network delay in it. */
  #samples: number[] = [];
  #ready = new Set<() => void>();

  constructor(
    readonly code: string,
    readonly seat: Seat | null = null,
  ) {}

  connect() {
    this.#closed = false;
    addEventListener('online', this.#wake);
    document.addEventListener('visibilitychange', this.#wake);
    // A stream can die without an error (a phone changing networks, a dropped socket): the screen
    // would freeze until the browser noticed, minutes later. Two missed pings, and it reopens.
    clearInterval(this.#watch);
    this.#watch = window.setInterval(() => {
      if (!this.#closed && this.live && Date.now() - this.#last > STALE) this.#revive();
    }, 10_000);
    this.#open();
  }

  close() {
    this.#closed = true;
    clearTimeout(this.#timer);
    clearInterval(this.#watch);
    this.#source?.close();
    this.#source = null;
    this.live = false;
    removeEventListener('online', this.#wake);
    document.removeEventListener('visibilitychange', this.#wake);
  }

  /** A move; throws ApiError with the server's reason. `signal`: from track(), which may give up. */
  act(action: string, body?: unknown, signal?: AbortSignal) {
    if (!this.seat) return Promise.reject(new Error('no seat'));
    return api.act(this.seat, action, body, signal);
  }

  /** Resolves with the first view (the room is ready to show); rejects when `signal` gives up. */
  ready(signal?: AbortSignal) {
    if (this.view) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const done = () => {
        this.#ready.delete(done);
        resolve();
      };
      this.#ready.add(done);
      signal?.addEventListener(
        'abort',
        () => {
          this.#ready.delete(done);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  /** Milliseconds left until a server timestamp. */
  left(at: number, now = Date.now()) {
    return Math.max(0, at - (now + this.offset));
  }

  #open() {
    clearTimeout(this.#timer);
    this.#source?.close();
    const query = this.seat ? `?p=${encodeURIComponent(this.seat.player)}` : '';
    const source = new EventSource(`/api/rooms/${this.code}/events${query}`);
    this.#source = source;
    this.#last = Date.now();
    source.onopen = () => {
      this.#last = Date.now();
      this.#attempt = 0;
      this.live = true;
      this.wasLive = true;
    };
    source.addEventListener('ping', () => (this.#last = Date.now()));
    source.addEventListener('view', (event) => {
      this.#last = Date.now();
      const view = parse<View>(event);
      if (!view) return;
      if (typeof view.now === 'number') {
        // The server's clock, steadied: one reading swings with the network's delay; the largest of
        // the last eight has the least delay in it (the per-view refresh in Table.svelte stays).
        this.#samples.push(view.now - Date.now());
        if (this.#samples.length > 8) this.#samples.shift();
        this.offset = Math.max(...this.#samples);
      }
      this.view = view;
      for (const done of [...this.#ready]) done();
      if (view.phase === 'gone') this.close();
    });
    source.onerror = () => {
      source.close();
      if (this.#source !== source) return;
      this.#source = null;
      this.live = false;
      if (this.#closed) return;
      const wait = BACKOFF[Math.min(this.#attempt++, BACKOFF.length - 1)];
      this.#timer = window.setTimeout(() => this.#open(), wait);
    };
  }

  /** Reopens a stream that went quiet; `live` drops first, so the pill says "reconnecting". */
  #revive() {
    this.live = false;
    this.#attempt = 0;
    this.#open();
  }

  /** Online again, or the tab is back: reopen a closed stream, or a live one silent too long. */
  #wake = () => {
    if (this.#closed || document.visibilityState === 'hidden') return;
    if (this.live && Date.now() - this.#last <= QUIET) return;
    this.#revive();
  };
}

function parse<T>(event: Event): T | null {
  try {
    return JSON.parse((event as MessageEvent).data) as T;
  } catch {
    return null;
  }
}
