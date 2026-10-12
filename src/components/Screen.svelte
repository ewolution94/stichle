<!--
  The big screen (/<code>/screen): the table for a projector, or the window the host shares on a
  call. It holds no seat, so it never has a hand: the lobby with the link and QR code to join; then
  the table as an oval with every seat round it, the pile in the middle, trump and the round above,
  and the score pad beside it; the end with the standings. Fits 1280 × 720 to 1920 × 1080 without
  scrolling, and keeps the display awake.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { score, suitName, t } from '../lib/i18n.svelte';
  import { Room } from '../lib/room.svelte';
  import { loadCensus } from '../lib/census';
  import { angleOf } from '../lib/table';
  import Avatar from './Avatar.svelte';
  import Card from './Card.svelte';
  import Floats from './Floats.svelte';
  import Logo from './Logo.svelte';
  import Qr from './Qr.svelte';
  import ScoreTable from './ScoreTable.svelte';
  import SeatChip from './SeatChip.svelte';
  import Trick from './Trick.svelte';

  let { code }: { code: string } = $props();

  // The page remounts for another code ({#key} in App.svelte), so the first one is the one.
  // svelte-ignore state_referenced_locally
  const room = new Room(code);
  const view = $derived(room.view);
  const game = $derived(view?.game ?? null);
  const link = $derived(`${location.origin}/${code}`);
  const playerAt = (seat: number) => view?.players.find((p) => p.id === game?.seats[seat]);
  const seated = $derived(view ? view.order.map((id) => view.players.find((p) => p.id === id)).filter((p) => p !== undefined) : []);

  /** A seat's place on the oval, the same directions the pile uses (seat 1 at the bottom). */
  function place(seat: number, n: number) {
    const a = (angleOf(seat, 0, n) * Math.PI) / 180;
    return { x: 50 + Math.cos(a) * 43, y: 50 + Math.sin(a) * 41 };
  }

  const status = $derived.by(() => {
    if (!game || game.phase !== 'round') return '';
    if (game.stage === 'trump') return t('pickTrumpOther', { name: playerAt(game.dealer)?.name ?? '' });
    if (game.stage === 'bid') return game.bidding === 'secret' ? t('bidSecretWait', { n: game.waiting.length }) : t('bidOther', { name: playerAt(game.turn)?.name ?? '' });
    if (game.stage === 'play') return t('playOther', { name: playerAt(game.turn)?.name ?? '' });
    return '';
  });

  const standings = $derived(game ? game.seats.map((_, seat) => seat).sort((a, b) => game!.totals[b] - game!.totals[a]) : []);

  onMount(() => {
    room.connect();
    loadCensus();
    // A projector shouldn't go to sleep mid-game; refused or unsupported is fine.
    let lock: { release(): Promise<void> } | null = null;
    const wake = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null;
      } catch {
        lock = null;
      }
    };
    void wake();
    const again = () => document.visibilityState === 'visible' && void wake();
    document.addEventListener('visibilitychange', again);
    return () => {
      room.close();
      document.removeEventListener('visibilitychange', again);
      void lock?.release().catch(() => {});
    };
  });
</script>

{#if view?.phase !== 'gone'}
  <ewo-connection class="connection" state={room.live ? 'online' : room.wasLive ? 'reconnecting' : 'connecting'}></ewo-connection>
{/if}

<div class="screen">
  <header class="top">
    <Logo />
    <span class="code">{code}</span>
    {#if game && view?.phase === 'play'}
      <span class="round"><span class="label on-cloth">{t('round')}</span><b class="display">{game.round}<small>/{game.rounds}</small></b></span>
      <span class="trump">
        <span class="mini">{#if game.trumpCard}<Card id={game.trumpCard} />{:else}<span class="none"></span>{/if}</span>
        <span><span class="label on-cloth">{t('trump')}</span><b class="display">{#if game.trump}<span class="suit {game.trump}"></span>{suitName(game.trump)}{:else}{t('noTrumpShort')}{/if}</b></span>
      </span>
      {#if status}<p class="status">{status}</p>{/if}
    {/if}
  </header>

  {#if !view}
    <p class="wait label on-cloth">{t(room.wasLive ? 'reconnecting' : 'connecting')}</p>
  {:else if view.phase === 'gone'}
    <p class="wait display">{t('gone')}</p>
  {:else if view.phase === 'lobby' || !game}
    <div class="lobby">
      <section class="sheet join">
        <span class="label">{t('screenJoin')}</span>
        <span class="url">{link.replace(/^https?:\/\//, '')}</span>
        <div class="qr"><Qr url={link} /></div>
      </section>
      <section class="sheet chairs">
        <h2 class="display">{t('atTheTable')}</h2>
        <ol>
          {#each seated as p, i (p.id)}
            <li><span class="n display">{i + 1}</span><Avatar avatar={p.avatar} size={44} /><span>{p.name}</span>{#if p.bot}<small>{t('bot')}</small>{/if}</li>
          {/each}
        </ol>
      </section>
    </div>
  {:else if view.phase === 'final'}
    <div class="end">
      <section class="sheet standings">
        <h2 class="display">{t('screenFinal')}</h2>
        <ol>
          {#each standings as seat, i (seat)}
            {@const p = playerAt(seat)}
            <li class:first={i === 0}><span class="n display">{i + 1}</span>{#if p}<Avatar avatar={p.avatar} size={48} />{/if}<span>{p?.name ?? '?'}</span><b class="display">{score(game.totals[seat])}</b></li>
          {/each}
        </ol>
      </section>
      <section class="sheet pad"><ScoreTable {view} /></section>
    </div>
  {:else}
    <div class="play">
      <div class="room">
        <div class="oval felt"></div>
        <div class="pile">
          <Trick {room} trick={game.trick} last={game.lastTrick} holdUntil={game.holdUntil} mine={-1} n={game.seats.length} cap={170} />
        </div>
        {#each game.seats as _, seat (seat)}
          {@const at = place(seat, game.seats.length)}
          <div class="seat" style:left="{at.x}%" style:top="{at.y}%">
            <SeatChip {room} {game} {seat} player={playerAt(seat)} compact />
          </div>
        {/each}
        <Floats {room} {view} />
      </div>
      <aside class="sheet pad">
        <h2 class="display">{game.phase === 'scored' ? t('roundOf', { n: game.round }) : t('scorePad')}</h2>
        <ScoreTable {view} />
      </aside>
    </div>
  {/if}
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 2vh;
    padding: 2.4vh 2.4vw;
    color: var(--on-cloth);
    overflow: hidden;
  }
  .connection {
    --ewo-connection-top: 12px;
    --ewo-connection-bg: var(--paper);
    --ewo-connection-fg: var(--ink);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 2.4vw;
  }
  .top :global(.logo) {
    font-size: 34px;
  }
  .code {
    padding: 6px 14px 5px;
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink);
    font: 600 18px/1 var(--ewo-mono);
    letter-spacing: 0.2em;
  }
  .round,
  .trump > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .round b,
  .trump b {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 28px;
    line-height: 1;
  }
  .round small {
    font-size: 18px;
    color: var(--on-cloth-2);
  }
  .trump {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mini {
    width: 46px;
    rotate: -6deg;
  }
  .none {
    display: block;
    aspect-ratio: 5 / 7;
    border-radius: 4px;
    border: 1.5px dashed rgb(236 230 214 / 0.4);
  }
  .trump .suit {
    width: 16px;
    height: 16px;
  }
  .trump .suit.fire {
    color: var(--fire-lum);
  }
  .trump .suit.water {
    color: var(--water-lum);
  }
  .trump .suit.earth {
    color: var(--earth-lum);
  }
  .trump .suit.air {
    color: var(--air-lum);
  }
  .wait {
    margin: auto;
    font-size: 28px;
  }

  .lobby,
  .end {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 2.4vw;
    align-items: start;
  }
  .join,
  .chairs,
  .standings,
  .pad {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 3vh 2vw;
    color: var(--ink);
  }
  .join {
    align-items: center;
    text-align: center;
  }
  .url {
    font: 700 clamp(22px, 2.4vw, 40px) / 1.1 var(--display);
  }
  .qr {
    width: min(42vh, 360px);
  }
  h2 {
    margin: 0;
    font-size: clamp(22px, 2.2vw, 34px);
  }
  ol {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 14px;
    font: 600 clamp(18px, 1.6vw, 26px) / 1.2 var(--ewo-sans);
  }
  li small {
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--paper-2);
    font-size: 14px;
    color: var(--mute);
  }
  li .n {
    width: 28px;
    color: var(--mute);
    text-align: right;
  }
  .standings li b {
    margin-left: auto;
    font-size: clamp(22px, 2vw, 34px);
  }
  .standings li.first {
    font-size: clamp(22px, 2vw, 34px);
  }

  .play {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 26vw);
    gap: 2vw;
  }
  .room {
    position: relative;
    min-height: 0;
  }
  /* The table itself, as this screen's device chose it (src/app.css → the tables), as an oval. */
  .oval {
    position: absolute;
    inset: 8% 6%;
    border-radius: 50%;
  }
  .pile {
    position: absolute;
    inset: 20% 22%;
  }
  /* Bigger than on a phone: read from across a meeting room. */
  .seat {
    position: absolute;
    width: clamp(120px, 10vw, 170px);
    translate: -50% -50%;
    scale: 1.3;
  }
  .seat :global(.seat) {
    width: 100%;
  }
  .status {
    margin: 0 0 0 auto;
    font: 600 clamp(16px, 1.5vw, 24px) / 1.3 var(--ewo-sans);
    color: var(--gold-hi);
  }
  .pad {
    min-height: 0;
    overflow: auto;
  }
</style>
