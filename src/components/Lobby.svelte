<!--
  The lobby: the table's code, link and QR code; the six chairs in the order play will go round
  (empty ones dashed), who's watching, and the host's few settings. A setting answers the tap at once
  and the server's echo takes over once it agrees (learnings/ui-preferences.md → "A control answers
  the tap").
-->
<script lang="ts">
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
  const seated = $derived(view.order.map((id) => view.players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p)));
  const watching = $derived(view.players.filter((p) => !view.order.includes(p.id)));
  const amSeated = $derived(view.me !== null && view.order.includes(view.me));
  const menuPlayer = $derived(view.players.find((p) => p.id === menuFor) ?? null);
  /** The cards of each round at this table and length (R3): what the length's hint names. */
  const plan = $derived(seated.length >= MIN && seated.length <= MAX ? scheduleFor(seated.length, settings.length ?? 'full', Boolean(settings.specials)) : []);
  const rounds = $derived(plan.length);
  const blocker = $derived(seated.length < MIN ? t('needPlayers', { n: MIN - seated.length }) : '');

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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
  <svelte:element
    this={tappable ? 'button' : 'div'}
    class="player"
    class:me={p.id === view.me}
    class:away={!p.online}
    type={tappable ? 'button' : undefined}
    onclick={tappable ? () => tapPlayer(p) : undefined}
    role={tappable ? undefined : 'listitem'}
  >
    {#if chair !== null}<span class="chair display">{chair}</span>{/if}
    <Avatar avatar={p.avatar} size={30} />
    <span class="name">{p.name}</span>
    {#if p.id === view.me}<small>{t('you')}</small>{/if}
    {#if p.id === view.host}<small>{t('host')}</small>{/if}
    {#if p.bot}<small class="rank"><span class="sr-only">{t('bot')}: </span><BotRank level={p.level} decorative />{t(`level_${p.level ?? 'journeyman'}`)}</small>{:else if !p.online}<small>{t('away')}</small>{/if}
  </svelte:element>
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
    <div class="chairs" role="list">
      {#each seated as p, i (p.id)}{@render playerRow(p, i + 1)}{/each}
      {#each { length: Math.max(0, MAX - seated.length) } as _, i (i)}
        <div class="empty" role="listitem"><span class="chair display">{seated.length + i + 1}</span>{t('freeChair')}</div>
      {/each}
    </div>
    <p class="hint">{t('orderHint')}</p>
    <div class="row">
      {#if amSeated}
        <button class="btn small quiet" type="button" onclick={(e) => act('sit', { seated: false }, e)}>{t('watch')}</button>
      {:else if seated.length < MAX}
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

<PlayerMenu
  player={menuPlayer}
  seated={menuPlayer ? view.order.includes(menuPlayer.id) : false}
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
  .player.me {
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
  .player.me small {
    background: var(--paper);
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
