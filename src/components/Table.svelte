<!--
  The table during a game, filling the screen like a real one seen from your chair: the round and
  trump along the top, the other seats across the far side (in the order play goes: your left, the
  top, your right), the trick in the middle, and your seat and hand at the bottom. What it's your
  turn to do opens just above your hand: the trump suit (when a Wizard was turned and you dealt),
  your bid, or nothing, because playing is done with the cards themselves (Hand.svelte).
-->
<script lang="ts">
  import { ApiError, type View } from '../lib/api';
  import { fromId, SUITS, type Suit } from '../lib/deck';
  import { errorText, t, suitName } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { angleOf, slotOffset, trickCardWidth, twist } from '../lib/table';
  import { actAt } from '../lib/waits';
  import { askTilt } from '../lib/tilt';
  import Card from './Card.svelte';
  import Floats from './Floats.svelte';
  import Hand from './Hand.svelte';
  import Inspect from './Inspect.svelte';
  import RoundEnd from './RoundEnd.svelte';
  import ScorePad from './ScorePad.svelte';
  import SeatChip from './SeatChip.svelte';
  import Settings from './Settings.svelte';
  import Trick from './Trick.svelte';

  let { room, view, onleave }: { room: Room; view: View; onleave: (from?: Event) => Promise<void> } = $props();

  const game = $derived(view.game!);
  const n = $derived(game.seats.length);
  const mine = $derived(view.me ? game.seats.indexOf(view.me) : -1);
  const home = $derived(mine >= 0 ? mine : 0);
  const playerAt = (seat: number) => view.players.find((p) => p.id === game.seats[seat]);
  /** The other seats, in the order play goes from yours. */
  const others = $derived(Array.from({ length: n - 1 }, (_, i) => (home + 1 + i) % n));
  const turnName = $derived(playerAt(game.turn)?.name ?? '');
  const myTurn = $derived(mine >= 0 && game.phase === 'round' && game.stage !== 'done' && game.turn === mine);

  // A finished trick holds the table for a moment: no card until it's cleared.
  let now = $state(Date.now());
  $effect(() => {
    const wait = room.left(game.holdUntil);
    if (wait <= 0) return;
    const timer = setTimeout(() => (now = Date.now()), wait + 30);
    return () => clearTimeout(timer);
  });
  const holding = $derived(room.left(game.holdUntil, now) > 0);
  const canPlay = $derived(myTurn && game.stage === 'play' && !holding);

  // The suit to follow, for the hint (the same rule as the server's: the first card that isn't a Jester).
  const toFollow = $derived.by((): Suit | null => {
    for (const c of game.trick.cards) {
      const f = fromId(c.card);
      if (f.k === 'n') continue;
      return f.k === 'num' ? f.s : null;
    }
    return null;
  });

  /** You hold a card of the suit led: then you must follow it. */
  const canFollow = $derived(Boolean(toFollow && game.hand?.some((c) => { const f = fromId(c); return f.k === 'num' && f.s === toFollow; })));

  const bidsSoFar = $derived(game.bids.reduce<number>((sum, b) => sum + (b ?? 0), 0));

  let trickW = $state(320);
  let trickH = $state(260);
  let trickEl: HTMLDivElement | undefined = $state();

  /** Where your card lands: your slot at the bottom of the trick. */
  function target(card: string) {
    if (!trickEl || mine < 0) return null;
    const r = trickEl.getBoundingClientRect();
    const { dx, dy } = slotOffset(angleOf(mine, mine, n), r.width, r.height);
    return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy, rot: Number(twist(card, mine)), width: trickCardWidth(r.width, r.height) };
  }

  let error = $state('');
  let errorTimer = 0;
  function say(text: string) {
    error = text;
    clearTimeout(errorTimer);
    errorTimer = window.setTimeout(() => (error = ''), 2600);
  }

  async function act(action: string, body: unknown, from?: Event) {
    try {
      await actAt(room, action, body, from);
    } catch (e) {
      say(errorText(e instanceof ApiError ? e.code : 'other'));
      throw e;
    }
  }

  function refused(card: string) {
    if (!myTurn) return say(t('notYourTurn'));
    if (holding) return;
    if (!game.legal.includes(card) && toFollow) say(t('mustFollow', { suit: suitName(toFollow) }));
  }

  let inspecting: string | null = $state(null);
  function inspect(card: string) {
    askTilt();
    inspecting = card;
  }

  let padOpen = $state(false);
  let settingsOpen = $state(false);
  let reactOpen = $state(false);

  const status = $derived.by(() => {
    if (game.phase !== 'round') return '';
    if (game.stage === 'trump') return game.dealer === mine ? t('pickTrumpYou') : t('pickTrumpOther', { name: playerAt(game.dealer)?.name ?? '' });
    if (game.stage === 'bid') return myTurn ? t('bidYou') : t('bidOther', { name: turnName });
    if (game.stage === 'play') {
      if (holding && game.lastTrick) {
        const w = game.lastTrick.winner;
        return w === mine ? t('trickYou') : t('trickOther', { name: playerAt(w)?.name ?? '' });
      }
      if (myTurn) return game.trick.cards.length ? (toFollow && canFollow ? t('playFollow', { suit: suitName(toFollow) }) : t('playAny')) : t('playLead');
      return t('playOther', { name: turnName });
    }
    return '';
  });
</script>

<div class="table" class:my-turn={myTurn}>
  <header class="top">
    <div class="round">
      <span class="label on-cloth">{t('round')}</span>
      <span class="display">{game.round}<small>/{game.rounds}</small></span>
    </div>
    <button class="trump" type="button" onclick={() => game.trumpCard && inspect(game.trumpCard)} aria-label={game.trump ? t('trumpIs', { suit: suitName(game.trump) }) : t('noTrump')}>
      <span class="mini">
        {#if game.trumpCard}<Card id={game.trumpCard} />{:else}<span class="none" aria-hidden="true"></span>{/if}
      </span>
      <span class="what">
        <span class="label on-cloth">{t('trump')}</span>
        {#if game.trump}
          <b><span class="suit {game.trump}" aria-hidden="true"></span>{suitName(game.trump)}</b>
        {:else if game.stage === 'trump'}
          <b class="soft">{t('trumpPending')}</b>
        {:else}
          <b class="soft">{t('noTrumpShort')}</b>
        {/if}
      </span>
    </button>
    <div class="tools">
      <button class="tool" type="button" onclick={() => (reactOpen = !reactOpen)} aria-label={t('react')} aria-expanded={reactOpen}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.2c1 1.3 2.1 1.9 3.5 1.9s2.5-.6 3.5-1.9M9.2 9.6h.01M14.8 9.6h.01" /></svg>
      </button>
      <button class="tool" type="button" onclick={() => (padOpen = true)} aria-label={t('scorePad')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button onclick={() => (settingsOpen = true)}></ewo-settings-button>
    </div>
  </header>

  {#if reactOpen}
    <div class="reacts" role="group" aria-label={t('react')}>
      {#each view.reactions as e, i (e)}
        <button type="button" onclick={() => room.act('react', { e: i }).catch(() => {})}>{e}</button>
      {/each}
    </div>
  {/if}

  <div class="seats" style:--count={others.length}>
    {#each others as seat, i (seat)}
      <div class="far" style:--lift="{Math.round(Math.sin(((i + 1) / (others.length + 1)) * Math.PI) * -10)}px">
        <SeatChip {room} {game} {seat} player={playerAt(seat)} compact />
        <span class="held" aria-label={t('cardsLeft', { n: game.counts[seat] })}>
          {#each { length: Math.min(game.counts[seat], 7) } as _, k (k)}<i style:--k={k - (Math.min(game.counts[seat], 7) - 1) / 2}></i>{/each}
        </span>
      </div>
    {/each}
  </div>

  <div class="middle" bind:this={trickEl}>
    <Trick {room} trick={game.trick} last={game.lastTrick} holdUntil={game.holdUntil} {mine} {n} bind:width={trickW} bind:height={trickH} />
    <Floats {room} {view} />
  </div>

  <div class="dock">
    {#if error}
      <p class="toast" role="alert">{error}</p>
    {:else if status}
      <p class="status" class:mine={myTurn} aria-live="polite">{status}</p>
    {/if}

    {#if myTurn && game.stage === 'trump'}
      <div class="panel sheet">
        <span class="label">{t('pickTrump')}</span>
        <div class="suits">
          {#each SUITS as suit (suit)}
            <button class="btn suitbtn" type="button" onclick={(e) => act('trump', { suit }, e).catch(() => {})}>
              <span class="suit {suit}" aria-hidden="true"></span>{suitName(suit)}
            </button>
          {/each}
        </div>
      </div>
    {:else if myTurn && game.stage === 'bid'}
      <div class="panel sheet">
        <div class="bidhead">
          <span class="label">{t('yourBid')}</span>
          <span class="sofar">{t('bidsSoFar', { sum: bidsSoFar, n: game.round })}</span>
        </div>
        <div class="numbers" class:many={game.round > 7}>
          {#each { length: game.round + 1 } as _, k (k)}
            <button class="num display" type="button" onclick={(e) => act('bid', { n: k }, e).catch(() => {})}>{k}</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="mine">
      {#if mine >= 0 || n > 0}<SeatChip {room} {game} seat={home} player={playerAt(home)} me={mine >= 0} />{/if}
    </div>

    {#if mine >= 0 && game.hand}
      <Hand
        cards={game.hand}
        legal={game.legal}
        {canPlay}
        onplay={(card) => act('play', { card })}
        {target}
        oninspect={inspect}
        onrefuse={refused}
      />
    {:else}
      <p class="watching">{t('watchingGame')}</p>
    {/if}
  </div>

  {#if game.phase === 'scored'}
    <RoundEnd {room} {view} />
  {/if}
</div>

<Inspect card={inspecting} onclose={() => (inspecting = null)} />
<ScorePad open={padOpen} {view} onclose={() => (padOpen = false)} />
<Settings open={settingsOpen} onclose={() => (settingsOpen = false)} {room} {onleave} />

<style>
  .table {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top, 0px) + 8px) 10px calc(env(safe-area-inset-bottom, 0px) + 6px);
    overflow: hidden;
    color: var(--on-cloth);
  }
  @media (min-width: 720px) {
    .table {
      padding-inline: max(16px, calc((100vw - 640px) / 2));
    }
  }

  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
  }
  .round {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 54px;
  }
  .round .display {
    font-size: 24px;
    line-height: 1;
    color: var(--on-cloth);
  }
  .round small {
    font-size: 14px;
    color: var(--on-cloth-2);
  }
  .trump {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    text-align: left;
  }
  .mini {
    width: 34px;
    rotate: -6deg;
  }
  .none {
    display: block;
    aspect-ratio: 5 / 7;
    border-radius: 3px;
    border: 1.5px dashed rgb(236 230 214 / 0.4);
  }
  .what {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .what b {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: 700 16px/1.1 var(--display);
  }
  .what b .suit {
    width: 12px;
    height: 12px;
  }
  .what .suit.fire {
    color: var(--fire-lum);
  }
  .what .suit.water {
    color: var(--water-lum);
  }
  .what .suit.earth {
    color: var(--earth-lum);
  }
  .what .suit.air {
    color: var(--air-lum);
  }
  .what .soft {
    color: var(--on-cloth-2);
    font-weight: 600;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    --ewo-fg: var(--on-cloth);
    --ewo-fg-2: var(--on-cloth);
    --ewo-fill-2: rgb(255 255 255 / 0.1);
  }
  .tool {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--on-cloth);
  }
  .tool svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .reacts {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }
  .reacts button {
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: rgb(10 16 46 / 0.55);
    font-size: 21px;
  }

  .seats {
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 6px;
    margin-top: 6px;
  }
  .far {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    translate: 0 var(--lift);
  }
  .far :global(.seat) {
    width: 100%;
    max-width: 120px;
  }
  /* Their hand, face down: a little fan of backs. */
  .held {
    position: relative;
    height: 16px;
    width: 40px;
  }
  .held i {
    position: absolute;
    left: calc(50% - 5px);
    bottom: 0;
    width: 10px;
    height: 14px;
    border-radius: 1.5px;
    background: var(--cloth-2);
    box-shadow: 0 0 0 1px var(--gold-lo), inset 0 0 0 2px var(--cloth-3);
    transform-origin: 50% 120%;
    rotate: calc(var(--k) * 9deg);
  }

  .middle {
    position: relative;
    flex: 1 1 auto;
    min-height: 150px;
  }

  .dock {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .status,
  .toast {
    margin: 0;
    min-height: 20px;
    font: 600 14px/1.3 var(--ewo-sans);
    text-align: center;
    color: var(--on-cloth-2);
  }
  .status.mine {
    color: var(--gold-hi);
  }
  .toast {
    color: #ffc9bd;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 14px;
    animation: rise 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
  }
  @keyframes rise {
    from {
      translate: 0 14px;
      opacity: 0;
    }
  }
  .bidhead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .sofar {
    font-size: 13px;
    color: var(--mute);
  }
  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 6px;
  }
  .num {
    min-height: 46px;
    border: 1.5px solid var(--ink);
    border-radius: 50%;
    aspect-ratio: 1;
    background: #ffffff;
    color: var(--ink);
    font-size: 20px;
  }
  .numbers.many .num {
    min-height: 40px;
    font-size: 17px;
  }
  @media (hover: hover) {
    .num:hover {
      background: var(--cloth);
      color: var(--paper);
    }
  }
  .suits {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .suitbtn {
    justify-content: flex-start;
    gap: 10px;
  }
  .suitbtn .suit {
    width: 14px;
    height: 14px;
  }
  .mine {
    display: flex;
    justify-content: center;
  }
  .watching {
    margin: 10px 0 18px;
    text-align: center;
    color: var(--on-cloth-2);
  }
</style>
