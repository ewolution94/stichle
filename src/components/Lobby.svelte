<!--
  The lobby: the table's code, link and QR code; the six chairs in the order play will go round
  (empty ones dashed), who's watching, and the host's few settings. A setting answers the tap at once
  and the server's echo takes over once it agrees (learnings/ui-preferences.md → "A control answers
  the tap").
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { ApiError, LEVELS, type Config, type Level, type Player, type Settings, type View } from '../lib/api';
  import type { Avatar as AvatarValue } from '../lib/avatar';
  import { errorText, t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { saveAvatar } from '../lib/session';
  import { scheduleFor } from '../lib/table';
  import { actAt } from '../lib/waits';
  import Avatar from './Avatar.svelte';
  import AvatarMaker from './AvatarMaker.svelte';
  import BotRank from './BotRank.svelte';
  import PlayerMenu from './PlayerMenu.svelte';
  import Qr from './Qr.svelte';

  let { room, view, config }: { room: Room; view: View; config: Config | null } = $props();

  const MIN = $derived(config?.seats.min ?? 3);
  const MAX = $derived(config?.seats.max ?? 6);
  const SECONDS = $derived(config?.moveSeconds ?? { relaxed: 60, quick: 25 });

  let pending: Partial<Settings> = $state({});
  let sending = false;
  let error = $state('');
  let copied = $state(false);
  let qrOpen = $state(false);
  let menuFor: string | null = $state(null);
  let avatarOpen = $state(false);
  let avatarShown = $state(false);
  let myAvatar: AvatarValue | null = $state(null);
  $effect(() => {
    if (avatarOpen) avatarShown = true;
  });

  const isHost = $derived(view.me === view.host);
  const settings: Settings = $derived({ ...view.settings, ...pending });
  const hostName = $derived(view.players.find((p) => p.id === view.host)?.name ?? '');
  const link = $derived(`${location.origin}/${view.code}`);
  /** The order just set here (dragged, nudged), shown until the server's view agrees or the move fails. */
  let ordered = $state.raw<string[] | null>(null);
  const order = $derived(ordered ? merged(ordered, view.order) : view.order);
  const seated = $derived(order.map((id) => view.players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p)));
  const watching = $derived(view.players.filter((p) => !view.order.includes(p.id)));
  const amSeated = $derived(view.me !== null && view.order.includes(view.me));
  const menuPlayer = $derived(view.players.find((p) => p.id === menuFor) ?? null);
  /** The cards of each round at this table and length (R3): what the length's hint names. */
  const plan = $derived(seated.length >= MIN && seated.length <= MAX ? scheduleFor(seated.length, settings.length ?? 'full', Boolean(settings.specials)) : []);
  const rounds = $derived(plan.length);
  const blocker = $derived(seated.length < MIN ? t('needPlayers', { n: MIN - seated.length }) : '');

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // ---- the order round the table: the host drags a seat by its grip, or nudges it with the arrow keys
  // or from the player's sheet (the user, 2026-10-15). Moves follow learnings/projects/planum.md:
  // pointer capture, every frame from the snapshot taken at pointerdown, `touch-action: none` on the grip.

  /** `wanted` first, then anyone it misses in the server's order: what the server makes of it. */
  function merged(wanted: string[], server: string[]) {
    const named = wanted.filter((id) => server.includes(id));
    return [...named, ...server.filter((id) => !named.includes(id))];
  }
  function moved(ids: string[], from: number, to: number) {
    const next = [...ids];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
  }
  $effect(() => {
    if (ordered && same(merged(ordered, view.order), view.order)) ordered = null;
  });

  let orderTimer: ReturnType<typeof setTimeout> | undefined;
  async function reorder(next: string[]) {
    ordered = next;
    error = '';
    clearTimeout(orderTimer);
    // Should the echo never come, the server's order takes over again.
    orderTimer = setTimeout(() => {
      if (ordered === next) ordered = null;
    }, 6000);
    try {
      await room.act('order', { order: next });
    } catch (e) {
      if (ordered === next) ordered = null;
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  let list: HTMLElement | undefined = $state();
  /** What the screen reader hears after a move. */
  let said = $state('');
  const seats = () => [...(list?.querySelectorAll<HTMLElement>('[data-seat]') ?? [])];

  /** A new order, its rows sliding from where they were to their new places (FLIP). */
  async function place(next: string[] | null, focus?: string) {
    const before = new Map(seats().map((row) => [row.dataset.seat, row.getBoundingClientRect().top]));
    drag = null;
    if (next) void reorder(next);
    await tick();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const row of seats()) {
        const dy = (before.get(row.dataset.seat) ?? 0) - row.getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5) row.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
    // A moved row is taken out and put back, which drops its focus.
    if (focus) list?.querySelector<HTMLElement>(`[data-seat="${focus}"] .grip`)?.focus();
    if (next && focus) said = t('seatNow', { name: seated.find((p) => p.id === focus)?.name ?? '', n: next.indexOf(focus) + 1 });
  }

  /** One seat earlier (-1) or later (+1): the arrow keys on a grip, and the player's sheet. */
  function shift(id: string, by: number, focus = false) {
    const ids = seated.map((p) => p.id);
    const from = ids.indexOf(id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    void place(moved(ids, from, to), focus ? id : undefined);
  }

  type Drag = { id: string; ids: string[]; from: number; to: number; dy: number; tops: number[]; pitch: number };
  let drag = $state<Drag | null>(null);
  /** The chairs' numbers while a seat is held: where everyone would sit if it were let go here. */
  const preview = $derived(drag ? moved(drag.ids, drag.from, drag.to) : null);

  function grab(e: PointerEvent, id: string) {
    const ids = seated.map((p) => p.id);
    const from = ids.indexOf(id);
    if (!isHost || drag || e.button !== 0 || from < 0 || ids.length < 2) return;
    e.preventDefault();
    const tops = seats().map((row) => row.getBoundingClientRect().top);
    const grip = e.currentTarget as HTMLElement;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the window's listeners below still end the drag.
    }
    const startY = e.clientY;
    let y = startY;
    let frame = 0;
    drag = { id, ids, from, to: from, dy: 0, tops, pitch: tops[1] - tops[0] };
    const paint = () => {
      frame = 0;
      if (!drag) return;
      const dy = Math.min(tops.at(-1)! - tops[from], Math.max(tops[0] - tops[from], y - startY));
      const at = tops[from] + dy;
      const to = tops.reduce((best, top, i) => (Math.abs(top - at) < Math.abs(tops[best] - at) ? i : best), 0);
      drag = { ...drag, dy, to };
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      y = ev.clientY;
      frame ||= requestAnimationFrame(paint);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      cancelAnimationFrame(frame);
      if (ev.type === 'pointerup') {
        y = ev.clientY;
        paint();
      }
      const d = drag;
      const next = d && ev.type === 'pointerup' && d.to !== d.from ? moved(d.ids, d.from, d.to) : null;
      void place(next, next && d ? d.id : undefined);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  /** Where a seated row is drawn while a seat is held: the held one under the finger, the others making room. */
  function shiftOf(i: number, id: string) {
    const d = drag;
    if (!d) return undefined;
    if (id === d.id) return `0 ${d.dy}px`;
    if (d.from < d.to && i > d.from && i <= d.to) return `0 ${-d.pitch}px`;
    if (d.to < d.from && i >= d.to && i < d.from) return `0 ${d.pitch}px`;
    return undefined;
  }

  function nudge(e: KeyboardEvent, id: string) {
    const by = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!by) return;
    e.preventDefault();
    shift(id, by, true);
  }

  // The server agrees: its value takes over.
  $effect(() => {
    const server = view.settings;
    const left = Object.fromEntries(Object.entries(pending).filter(([k, v]) => !same(server[k as keyof Settings], v)));
    if (Object.keys(left).length !== Object.keys(pending).length) pending = left;
  });

  function change(patch: Partial<Settings>) {
    if (!isHost) return;
    pending = { ...pending, ...patch };
    void flush();
  }

  async function flush() {
    if (sending) return;
    const body = { ...pending };
    if (!Object.keys(body).length) return;
    sending = true;
    error = '';
    try {
      await room.act('settings', body);
    } catch (e) {
      pending = {};
      error = errorText(e instanceof ApiError ? e.code : 'other');
    } finally {
      sending = false;
    }
    if (Object.keys(pending).length && !same(pending, body)) void flush();
  }

  /** A move; with the tapped control, the wait shows there (src/lib/waits.ts). */
  async function act(action: string, body?: unknown, from?: Event) {
    error = '';
    try {
      await actAt(room, action, body, from);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  /** The player menu's moves: it stays open while they wait, and says why one failed. */
  let menuError = $state('');
  async function fromMenu(action: string, body: unknown, from: Event) {
    menuError = '';
    try {
      await actAt(room, action, body, from);
      menuFor = null;
    } catch (e) {
      menuError = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  /** One bot's own rank, from its sheet: the sheet stays open to show it. */
  async function levelFromMenu(level: Level, from: Event) {
    menuError = '';
    try {
      await actAt(room, 'bot', { player: menuFor, level }, from);
    } catch (e) {
      menuError = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // The link is on the page to select by hand.
    }
  }

  /** A tap on a player: your own row opens your seal; the host's tap on someone else, their menu. */
  function tapPlayer(p: Player) {
    if (p.id === view.me) {
      myAvatar = p.avatar;
      avatarOpen = true;
    } else if (isHost) menuFor = p.id;
  }

  function changeAvatar(next: AvatarValue) {
    myAvatar = next;
    saveAvatar(next);
    void act('avatar', { avatar: next });
  }
</script>

{#snippet playerRow(p: Player, chair: number | null)}
  {@const tappable = p.id === view.me || isHost}
  <div
    class="seat"
    class:me={p.id === view.me}
    class:lifted={drag?.id === p.id}
    role="listitem"
    data-seat={chair !== null ? p.id : undefined}
    style:translate={chair !== null ? shiftOf(chair - 1, p.id) : undefined}
  >
    <svelte:element
      this={tappable ? 'button' : 'div'}
      class="player"
      class:away={!p.online}
      type={tappable ? 'button' : undefined}
      role={tappable ? 'button' : undefined}
      onclick={tappable ? () => tapPlayer(p) : undefined}
    >
      {#if chair !== null}<span class="chair display">{preview ? preview.indexOf(p.id) + 1 : chair}</span>{/if}
      <Avatar avatar={p.avatar} size={30} />
      <span class="name">{p.name}</span>
      {#if p.id === view.me}<small>{t('you')}</small>{/if}
      {#if p.id === view.host}<small>{t('host')}</small>{/if}
      {#if p.bot}<small class="rank"><BotRank level={p.level} label={t('bot')} />{t(`level_${p.level ?? 'journeyman'}`)}</small>{:else if !p.online}<small>{t('away')}</small>{/if}
    </svelte:element>
    {#if chair !== null && isHost && seated.length > 1}
      <!-- The grip: held to drag the seat, or the arrow keys (the player's sheet does it too). -->
      <button
        class="grip"
        type="button"
        aria-label={t('moveSeat', { name: p.name })}
        aria-describedby="orderhint"
        aria-keyshortcuts="ArrowUp ArrowDown"
        onpointerdown={(e) => grab(e, p.id)}
        onkeydown={(e) => nudge(e, p.id)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          {#each [6, 10, 14] as y (y)}<circle cx="7.5" cy={y} r="1.5" /><circle cx="12.5" cy={y} r="1.5" />{/each}
        </svg>
      </button>
    {/if}
  </div>
{/snippet}

<div class="lobby">
  <section class="sheet roomcard">
    <span class="label">{t('table')}</span>
    <div class="coderow">
      <span class="code display pressed">{view.code}</span>
      <div class="links">
        <button class="btn small" type="button" onclick={copy}>{copied ? t('copied') : t('copyLink')}</button>
        <button class="btn small" type="button" aria-expanded={qrOpen} onclick={() => (qrOpen = !qrOpen)}>{t('showQr')}</button>
      </div>
    </div>
    <span class="url">{link}</span>
    {#if qrOpen}<div class="qr"><Qr url={link} /></div>{/if}
    <!-- The big screen is for a projector or a shared window: a phone is never it. -->
    <a class="screenlink" href="/{view.code}/screen" target="_blank" rel="noopener">{t('bigScreen')} ↗</a>
    <span class="hint screenhint">{t('bigScreenHint')}</span>
  </section>

  <section class="sheet seats">
    <div class="seathead">
      <h2 class="display">{t('atTheTable')}</h2>
      <span class="label">{seated.length}/{MAX}</span>
    </div>
    <div class="chairs" class:dragging={drag !== null} role="list" bind:this={list}>
      {#each seated as p, i (p.id)}{@render playerRow(p, i + 1)}{/each}
      {#each { length: Math.max(0, MAX - seated.length) } as _, i (i)}
        <div class="empty" role="listitem"><span class="chair display">{seated.length + i + 1}</span>{t('freeChair')}</div>
      {/each}
    </div>
    <p class="hint" id="orderhint">{isHost ? t('orderHintHost') : t('orderHint')}</p>
    <div class="row">
      <!-- No "just watch" for whoever sits (the user, 2026-10-15: not needed); the host can still seat
           someone to watch from their sheet, and a watcher takes a free chair here. -->
      {#if !amSeated && seated.length < MAX}
        <button class="btn small" type="button" onclick={(e) => act('sit', { seated: true }, e)}>{t('sitDown')}</button>
      {/if}
      {#if isHost}
        <button class="btn small" type="button" disabled={seated.length < 2} onclick={(e) => act('shuffle', undefined, e)}>{t('shuffle')}</button>
        <button class="btn small" type="button" disabled={seated.length >= MAX} onclick={(e) => act('bot', { add: true }, e)}>{t('addBot')}</button>
      {/if}
    </div>
    {#if watching.length}
      <span class="label">{t('watching')}</span>
      <div class="chairs" role="list">
        {#each watching as p (p.id)}{@render playerRow(p, null)}{/each}
      </div>
    {/if}
  </section>

  <section class="sheet setup" aria-label={t('settings')}>
    <!-- The bots' rank (the user, 2026-10-14): every bot's, the stand-ins', and each new one's. -->
    <div class="setting">
      <span class="label">{t('botsSetting')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.bots ?? 'journeyman'} label={t('botsSetting')} onchange={(e) => change({ bots: e.detail.value as Level })}>
          {#each LEVELS as level (level)}<option value={level}>{t(`level_${level}`)}</option>{/each}
        </ewo-segmented>
      {:else}
        <b>{t(`level_${settings.bots ?? 'journeyman'}`)}</b>
      {/if}
      <span class="hint">{isHost ? t('botsHint') : t('botsHintGuest')}</span>
    </div>
    <div class="setting">
      <span class="label">{t('clock')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.clock} label={t('clock')} onchange={(e) => change({ clock: e.detail.value as Settings['clock'] })}>
          <option value="off">{t('clock_off')}</option>
          <option value="relaxed">{SECONDS.relaxed} s</option>
          <option value="quick">{SECONDS.quick} s</option>
        </ewo-segmented>
      {:else}
        <b>{settings.clock === 'off' ? t('clock_off') : `${SECONDS[settings.clock]} s`}</b>
      {/if}
      <span class="hint">{settings.clock === 'off' ? t('clockHintOff') : t('clockHint')}</span>
    </div>
    <div class="setting">
      <span class="label">{t('biddingRule')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.bidding} label={t('biddingRule')} onchange={(e) => change({ bidding: e.detail.value as Settings['bidding'] })}>
          <option value="open">{t('bidding_open')}</option>
          <option value="uneven">{t('bidding_uneven')}</option>
          <option value="secret">{t('bidding_secret')}</option>
        </ewo-segmented>
      {:else}
        <b>{t(`bidding_${settings.bidding}`)}</b>
      {/if}
      <span class="hint">{t(`biddingHint_${settings.bidding}`)}</span>
    </div>
    <div class="setting">
      <span class="label">{t('gameLength')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.length ?? 'full'} label={t('gameLength')} onchange={(e) => change({ length: e.detail.value as Settings['length'] })}>
          <option value="full">{t('length_full')}</option>
          <option value="half">{t('length_half')}</option>
          <option value="short">{t('length_short')}</option>
        </ewo-segmented>
      {:else}
        <b>{t(`length_${settings.length ?? 'full'}`)}</b>
      {/if}
      <span class="hint">{plan.length ? t(`lengthHint_${settings.length ?? 'full'}`, { last: plan.at(-1) ?? 0 }) : t(`lengthAbout_${settings.length ?? 'full'}`)}</span>
    </div>
    <div class="setting">
      <span class="label">{t('tempo')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.tempo ?? 'normal'} label={t('tempo')} onchange={(e) => change({ tempo: e.detail.value as Settings['tempo'] })}>
          <option value="normal">{t('tempo_normal')}</option>
          <option value="fast">{t('tempo_fast')}</option>
        </ewo-segmented>
      {:else}
        <b>{t(`tempo_${settings.tempo ?? 'normal'}`)}</b>
      {/if}
      <span class="hint">{t(`tempoHint_${settings.tempo ?? 'normal'}`)}</span>
    </div>
    <div class="setting">
      <span class="label">{t('forehead')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.forehead ? 'on' : 'off'} label={t('forehead')} onchange={(e) => change({ forehead: e.detail.value === 'on' })}>
          <option value="off">{t('forehead_off')}</option>
          <option value="on">{t('forehead_on')}</option>
        </ewo-segmented>
      {:else}
        <b>{t(settings.forehead ? 'forehead_on' : 'forehead_off')}</b>
      {/if}
      <span class="hint">{t(settings.forehead ? 'foreheadHint_on' : 'foreheadHint_off')}</span>
    </div>
    <div class="setting">
      <span class="label">{t('specials')}</span>
      {#if isHost}
        <ewo-segmented stretch value={settings.specials ? 'on' : 'off'} label={t('specials')} onchange={(e) => change({ specials: e.detail.value === 'on' })}>
          <option value="off">{t('forehead_off')}</option>
          <option value="on">{t('forehead_on')}</option>
        </ewo-segmented>
      {:else}
        <b>{t(settings.specials ? 'forehead_on' : 'forehead_off')}</b>
      {/if}
      <span class="hint">{t(settings.specials ? 'specialsHint_on' : 'specialsHint_off')}</span>
    </div>
    <p class="length">{rounds ? t('lengthHint', { players: seated.length, rounds }) : t('lengthNone', { min: MIN, max: MAX })}</p>
  </section>

  <div class="go on-cloth">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if isHost}
      {#if blocker}<p class="hint center">{blocker}</p>{/if}
      <button class="btn primary block" type="button" disabled={Boolean(blocker)} onclick={(e) => act('start', undefined, e)}>{t('deal')}</button>
    {:else}
      <p class="hint center">{t('waitHost', { name: hostName })}</p>
    {/if}
  </div>
</div>

<!-- Outside the paper panels, whose children are all positioned (it would take a line there). -->
<p class="sr-only" aria-live="polite">{said}</p>

<PlayerMenu
  player={menuPlayer}
  seated={menuPlayer ? view.order.includes(menuPlayer.id) : false}
  place={menuPlayer ? seated.findIndex((p) => p.id === menuPlayer.id) + 1 : 0}
  places={seated.length}
  onshift={(by) => menuFor && shift(menuFor, by)}
  full={seated.length >= MAX}
  onseat={(on, e) => void fromMenu('move', { player: menuFor, seated: on }, e)}
  onremove={(e) => {
    const p = menuPlayer;
    if (p) void fromMenu(p.bot ? 'bot' : 'kick', p.bot ? { add: false, player: p.id } : { player: p.id }, e);
  }}
  onlevel={(level, e) => void levelFromMenu(level, e)}
  onclose={() => ((menuFor = null), (menuError = ''))}
  error={menuError}
/>

<ewo-sheet open={avatarOpen} label={t('changeAvatar')} oncancel={() => (avatarOpen = false)} onclose={() => ((avatarShown = false), (avatarOpen = false))}>
  <span slot="heading">{t('changeAvatar')}</span>
  {#if avatarShown && myAvatar}
    <div class="menu">
      <AvatarMaker avatar={myAvatar} onchange={changeAvatar} />
      <button class="btn primary block" type="button" onclick={() => (avatarOpen = false)}>{t('done')}</button>
    </div>
  {/if}
</ewo-sheet>

<style>
  .lobby {
    display: grid;
    gap: 14px;
    max-width: 520px;
    margin: 8px auto 0;
  }
  .roomcard,
  .seats,
  .setup {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px 20px 18px;
  }
  .coderow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .code {
    font-size: 44px;
    line-height: 1;
    letter-spacing: 0.08em;
  }
  .links {
    display: flex;
    gap: 6px;
  }
  .url {
    overflow-wrap: anywhere;
    font: 500 12px/1.4 var(--ewo-mono);
    color: var(--mute);
  }
  .qr {
    width: min(220px, 70%);
    margin: 4px auto 0;
  }
  .screenlink,
  .screenhint {
    display: none;
  }
  @media (min-width: 900px) {
    .screenlink {
      display: inline;
      font-weight: 600;
      color: var(--water);
    }
    .screenhint {
      display: block;
    }
  }
  .seathead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 22px;
  }
  .chairs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  /* A row: the player (a button for the host and for yourself) and, for the host, the seat's grip. */
  .seat {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: 999px;
  }
  .seat.me {
    background: var(--paper-2);
  }
  .seat .player {
    flex: 1 1 auto;
    min-width: 0;
  }
  .chairs.dragging .seat:not(.lifted) {
    transition: translate 0.18s var(--ewo-ease);
  }
  .seat.lifted {
    z-index: 2;
    background: var(--paper);
    box-shadow:
      0 12px 24px -12px rgb(0 0 0 / 0.5),
      inset 0 0 0 1.5px color-mix(in srgb, var(--gold) 65%, transparent);
  }
  .grip {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-left: -6px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--mute);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .grip:hover,
  .lifted .grip {
    color: var(--ink);
  }
  .lifted .grip {
    cursor: grabbing;
  }
  .grip svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  .player,
  .empty {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 4px 10px 4px 4px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--ink);
    font: 600 15px/1.2 var(--ewo-sans);
    text-align: left;
  }
  button.player:hover {
    background: var(--paper-2);
  }
  .player.away {
    opacity: 0.6;
  }
  .player .name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .player small {
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--paper-2);
    font: 600 11px/1.2 var(--ewo-sans);
    color: var(--mute);
  }
  .seat.me small {
    background: var(--paper);
  }
  .seat.lifted small {
    background: var(--paper-2);
  }
  .player small.rank {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chair {
    width: 22px;
    font-size: 15px;
    text-align: center;
    color: var(--mute);
  }
  .empty {
    color: var(--mute);
    font-weight: 500;
    box-shadow: inset 0 0 0 1.5px var(--line);
    border-radius: 999px;
    opacity: 0.8;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--mute);
  }
  .on-cloth .hint {
    color: var(--on-cloth-2);
  }
  .center {
    text-align: center;
  }
  .setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .length {
    margin: 0;
    font-size: 14px;
    color: var(--ink-2);
  }
  .go {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 8px;
  }
</style>
