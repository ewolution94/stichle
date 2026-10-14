<!--
  The table during a game, filling the screen like a real one seen from your chair: the round and
  trump along the top, the other seats across the far side (in the order play goes: your left, the
  top, your right), the trick in the middle, and your seat and hand at the bottom. What it's your
  turn to do floats over the table just above your hand: the trump suit (when a Wizard was turned and you dealt),
  your bid, or nothing, because playing is done with the cards themselves (Hand.svelte).
-->
<script lang="ts">
  import { ApiError, type View } from '../lib/api';
  import { fromId, nameOf, SUITS, type Suit } from '../lib/deck';
  import { errorText, i18n, t, suitName } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { angleOf, BEATS, deskScale, orderHand, slotOffset, trickCardWidth, trickPhase, twist } from '../lib/table';
  import { prefs } from '../lib/prefs.svelte';
  import { actAt } from '../lib/waits';
  import { askTilt } from '../lib/tilt';
  import Card from './Card.svelte';
  import Clock from './Clock.svelte';
  import Hand from './Hand.svelte';
  import Inspect from './Inspect.svelte';
  import RoundEnd from './RoundEnd.svelte';
  import ScorePad from './ScorePad.svelte';
  import SeatChip from './SeatChip.svelte';
  import SortToggle from './SortToggle.svelte';
  import BidCoins from './BidCoins.svelte';
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
  const myTurn = $derived(mine >= 0 && game.phase === 'round' && game.stage !== 'done' && game.waiting.includes(mine));
  const secret = $derived(game.bidding === 'secret');

  // A finished trick holds the table for a moment: no card until it's cleared. The page wakes when its
  // winner shows (the status names them then, not before) and when the hold is over.
  let now = $state(Date.now());
  $effect(() => {
    const wait = room.left(game.holdUntil);
    // Every view brings a new reading of the server's clock (room.offset), and it swings with the
    // network's delay; the clock here is read afresh with it. A clock from the last timer plus a slower
    // view made the pause look unfinished after its end, with no timer left to end it: your turn came
    // and the hand never played (the user, 2026-10-13: "the game locks up"; tools/jitter.mjs).
    now = Date.now();
    if (wait <= 0) return;
    const timers = [wait - (BEATS[game.tempo] ?? BEATS.normal).reveal, wait].filter((ms) => ms > 0).map((ms) => setTimeout(() => (now = Date.now()), ms + 30));
    return () => timers.forEach(clearTimeout);
  });
  const holding = $derived(room.left(game.holdUntil, now) > 0);
  // And while the pause lasts the clock ticks on its own, so the pause can never outlive itself.
  $effect(() => {
    if (!holding) return;
    const tick = setInterval(() => (now = Date.now()), 400);
    return () => clearInterval(tick);
  });
  const revealed = $derived(trickPhase(room.left(game.holdUntil, now), game.tempo) !== 'rest');
  const canPlay = $derived(myTurn && game.stage === 'play' && !holding);

  // The suit to follow, for the hint (the same rule as the server's: the first card that isn't a Jester).
  const toFollow = $derived.by((): Suit | null => {
    for (const c of game.trick.cards) {
      const f = fromId(c.card);
      // The Fee and the Dieb pass like Jesters; the Drache frees the trick like a Wizard.
      if (f.k === 'n' || (f.k === 'x' && f.name !== 'dragon')) continue;
      return f.k === 'num' ? f.s : null;
    }
    return null;
  });

  /** You hold a card of the suit led: then you must follow it. */
  const canFollow = $derived(Boolean(toFollow && game.hand?.some((c) => { const f = fromId(c); return f.k === 'num' && f.s === toFollow; })));

  const bidsSoFar = $derived(game.bids.reduce<number>((sum, b) => sum + (b ?? 0), 0));

  // Your bid: one big number, − and + beside it, then "Ansagen". It starts at 0 each round.
  let pick = $state(0);
  let lastRound = 0;
  $effect(() => {
    if (game.round !== lastRound) {
      lastRound = game.round;
      pick = 0;
    }
  });
  let bump = $state<'up' | 'down'>('up');
  function nudge(by: number) {
    const next = Math.max(0, Math.min(game.round, pick + by));
    if (next === pick) return;
    bump = by > 0 ? 'up' : 'down';
    pick = next;
  }

  // The desktop table (the user's pick C, 2026-10-14): from 1100 × 740 px. Phones and small windows
  // keep the table below, unchanged; the logic above is the same for both.
  const DESK = '(min-width: 1100px) and (min-height: 740px)';
  let desk = $state(typeof matchMedia === 'function' && matchMedia(DESK).matches);
  $effect(() => {
    const mq = matchMedia(DESK);
    const on = () => (desk = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
  // How big it's drawn (src/lib/table.ts → deskScale; Settings → Table size): one factor for all of
  // it. The plates, coins, piles, bar and panels take it as CSS zoom (`--scale`); the hand and the trick,
  // whose cards fly by measured positions, take it in their own layout instead.
  let win = $state({ w: typeof innerWidth === 'number' ? innerWidth : 1440, h: typeof innerHeight === 'number' ? innerHeight : 900 });
  $effect(() => {
    const on = () => (win = { w: innerWidth, h: innerHeight });
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  });
  const scale = $derived(desk ? deskScale(win.w, win.h, prefs.size) : 1);
  /** The largest a card on the desktop table's pile may be. */
  const DESK_CAP = $derived(150 * scale);
  /** The house rules this game plays with, for the desktop table's bar (only what isn't the original). */
  const rules = $derived(
    [
      game.length !== 'full' ? t(`lengthTag_${game.length}`) : '',
      game.tempo === 'fast' ? t('tempo_fast') : '',
      game.bidding !== 'open' ? `${t('biddingRule')}: ${t(`bidding_${game.bidding}`)}` : '',
      game.forehead ? t('forehead') : '',
      game.specials ? t('specials') : '',
    ].filter(Boolean),
  );
  /** The trick before, face down by the desktop table's edge once it has been swept off. */
  const lastPile = $derived(game.lastTrick && !holding ? game.lastTrick : null);
  const lastTaker = $derived(lastPile ? (lastPile.stolen ? (lastPile.cards.find((c) => c.card === 'thief')?.seat ?? lastPile.winner) : lastPile.winner) : -1);

  let trickW = $state(320);
  let trickH = $state(260);
  let trickEl: HTMLDivElement | undefined = $state();

  /** Where your card lands: your slot at the bottom of the trick. */
  function target(card: string) {
    if (!trickEl || mine < 0) return null;
    const r = trickEl.getBoundingClientRect();
    const width = trickCardWidth(r.width, r.height, desk ? DESK_CAP : undefined);
    const { dx, dy } = slotOffset(angleOf(mine, mine, n), width);
    return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy, rot: Number(twist(card, mine)), width };
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

  // A move the server took is done at once: its panel goes, even if the room's update (which moves
  // the turn on) is a moment behind the answer. Without this a second tap in that moment sent the
  // bid again and earned "not your turn" (found by the QA run, 2026-10-12).
  const moveKey = $derived(`${game.n}:${game.round}:${game.stage}:${game.turn}:${game.bidIn.join('')}`);
  let sent = $state('');
  async function decide(action: string, body: unknown, from: Event) {
    const key = moveKey;
    await act(action, body, from);
    sent = key;
  }
  const deciding = $derived(myTurn && sent !== moveKey);
  /** Your trump pick or your bid is open: it floats over the table and says what's asked. */
  const panelOpen = $derived(deciding && (game.stage === 'trump' || game.stage === 'bid'));

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

  const status = $derived.by(() => {
    if (game.phase !== 'round') return '';
    if (game.stage === 'trump') return game.dealer === mine ? t('pickTrumpYou') : t('pickTrumpOther', { name: playerAt(game.dealer)?.name ?? '' });
    if (game.stage === 'bid') {
      if (secret) return myTurn ? t('bidSecretYou') : t('bidSecretWait', { n: game.waiting.length });
      return myTurn ? t('bidYou') : t('bidOther', { name: turnName });
    }
    if (game.stage === 'play') {
      if (holding && game.lastTrick) {
        // The table rests a moment after the last card; the winner is named once it shows.
        if (!revealed) return '';
        const w = game.lastTrick.winner;
        if (game.lastTrick.stolen) {
          // The Dieb took it away: it counts for nobody (R3's special cards).
          const thief = game.lastTrick.cards.find((c) => c.card === 'thief')?.seat ?? -1;
          return thief === mine ? t('trickStolenYou') : t('trickStolen', { name: playerAt(thief)?.name ?? '' });
        }
        return w === mine ? t('trickYou') : t('trickOther', { name: playerAt(w)?.name ?? '' });
      }
      if (myTurn) return game.trick.cards.length ? (toFollow && canFollow ? t('playFollow', { suit: suitName(toFollow) }) : t('playAny')) : t('playLead');
      return game.trick.cards.length ? t('playOther', { name: turnName }) : t('playLeadOther', { name: turnName });
    }
    return '';
  });

</script>

{#snippet notice()}
  {#if error}
    <p class="toast" role="alert">{error}</p>
  {:else if status && !panelOpen}
    <p class="status" class:turn={myTurn} aria-live="polite">{status}</p>
  {/if}
{/snippet}

{#snippet panels()}
  {#if deciding && game.stage === 'trump'}
    <div class="panel sheet">
      <span class="label">{t('pickTrump')}</span>
      <div class="suits">
        {#each SUITS as suit (suit)}
          <button class="btn suitbtn" type="button" onclick={(e) => decide('trump', { suit }, e).catch(() => {})}>
            <span class="suit {suit}" aria-hidden="true"></span>{suitName(suit)}
          </button>
        {/each}
      </div>
    </div>
  {:else if deciding && game.stage === 'bid'}
    <div class="panel sheet bid">
      <span class="label">{t('yourBid')}</span>
      {#if game.foreheads}<span class="brow-hint">{t('foreheadHint')}</span>{/if}
      <div class="dial">
        <button class="step" type="button" aria-label={t('bidLess')} disabled={pick <= 0} onclick={() => nudge(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
        </button>
        <div class="value" role="status" aria-live="polite">
          <!-- The number alone (the panel's label already asks for tricks); the word stays for screen readers. -->
          {#key pick}<span class="big display {bump}">{pick}</span>{/key}
          <span class="sr-only">{pick === 1 ? t('trickOne') : t('trickMany')}</span>
        </div>
        <button class="step" type="button" aria-label={t('bidMore')} disabled={pick >= game.round} onclick={() => nudge(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" /></svg>
        </button>
      </div>
      {#if pick === game.forbidden}
        <span class="sofar no">{t('bidForbiddenHint', { n: game.round })}</span>
      {:else if secret}
        <span class="sofar">{t('bidSecretHint')}</span>
      {:else}
        <span class="sofar">{t('bidsSoFar', { sum: bidsSoFar, n: game.round })}</span>
      {/if}
      <button class="btn primary block" type="button" disabled={pick === game.forbidden} onclick={(e) => decide('bid', { n: pick }, e).catch(() => {})}>
        {pick === game.forbidden ? t('bidForbidden', { n: pick }) : t('bidThis', { n: pick })}
      </button>
    </div>
  {/if}
{/snippet}

{#snippet hand(flat: boolean, keys: boolean, size: number)}
  {#if mine >= 0 && game.hand}
    <Hand
      cards={orderHand(game.hand, game.trump, prefs.sort)}
      legal={game.legal}
      {canPlay}
      onplay={(card) => act('play', { card })}
      {target}
      oninspect={inspect}
      onrefuse={refused}
      {flat}
      {keys}
      scale={size}
    />
  {:else}
    <p class="watching">{t('watchingGame')}</p>
  {/if}
{/snippet}

{#if desk}
<div class="desk" class:my-turn={myTurn} style:--scale={scale}>
  <header class="desk-bar">
    <span class="desk-round"><span class="label on-cloth">{t('round')}</span><b class="display">{game.no}<small>/{game.rounds}</small></b></span>
    {#if rules.length}<span class="desk-rules">{rules.join(' · ')}</span>{/if}
    <div class="tools">
      {#if game.endsAt && game.phase === 'round'}<Clock {room} endsAt={game.endsAt} seconds={game.moveSeconds} mine={myTurn} />{/if}
      <button class="tool" type="button" onclick={() => (padOpen = true)} aria-label={t('scorePad')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button onclick={() => (settingsOpen = true)}></ewo-settings-button>
    </div>
  </header>

  <div class="desk-room">
    <div class="felt desk-cloth">
      <!-- The others across the far side, each bid lying as coins in front of them. -->
      <div class="desk-seats" style:--count={others.length}>
        {#each others as seat (seat)}
          <div class="desk-seat">
            <SeatChip {game} {seat} player={playerAt(seat)} showBid={false} />
            <div class="desk-under">
              <BidCoins bid={game.bids[seat]} won={game.won[seat] ?? 0} bidding={game.stage === 'bid' && game.waiting.includes(seat)} hidden={game.bidIn[seat] && game.bids[seat] === null} />
              {#if game.foreheads?.[seat]}
                <span class="desk-brow" aria-label={t('foreheadOf', { name: playerAt(seat)?.name ?? '', card: nameOf(fromId(game.foreheads[seat]), i18n.lang) })}><Card id={game.foreheads[seat]} /></span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- The deck and the turned trump, lying on the table as at a real one. -->
      <button class="desk-deck" type="button" onclick={() => game.trumpCard && inspect(game.trumpCard)} aria-label={game.trump ? t('trumpIs', { suit: suitName(game.trump) }) : t('noTrump')}>
        <span class="desk-pile">
          <span class="c b1"><Card back /></span>
          <span class="c b2"><Card back /></span>
          {#if game.trumpCard}<span class="c turned"><Card id={game.trumpCard} /></span>{/if}
        </span>
        <span class="desk-tag">
          {t('trump')} ·
          {#if game.trump}<b><span class="suit {game.trump}" aria-hidden="true"></span>{suitName(game.trump)}</b>{:else if game.stage === 'trump'}<b>{t('trumpPending')}</b>{:else}<b>{t('noTrumpShort')}</b>{/if}
        </span>
      </button>

      <div class="desk-middle" bind:this={trickEl}>
        <Trick {room} trick={game.trick} last={game.lastTrick} holdUntil={game.holdUntil} tempo={game.tempo} {mine} {n} cap={DESK_CAP} bind:width={trickW} bind:height={trickH} />
      </div>

      <!-- The trick before, face down where it was swept; hover or focus to look at it. -->
      <div class="desk-side">
        {#if lastPile}
          <button class="desk-last" type="button" aria-label={t('lastTrickOf', { name: lastTaker === mine ? t('you') : (playerAt(lastTaker)?.name ?? '') })}>
            <span class="desk-pile small">
              <span class="c b1"><Card back /></span>
              <span class="c b2"><Card back /></span>
            </span>
            <span class="desk-tag">{t('lastTrick')} · <b>{lastPile.stolen ? t('stolenShort') : lastTaker === mine ? t('you') : (playerAt(lastTaker)?.name ?? '')}</b></span>
            <span class="desk-peek" aria-hidden="true">
              {#each lastPile.cards as played (played.card)}<span class="c" class:taker={played.seat === lastTaker}><Card id={played.card} /></span>{/each}
            </span>
          </button>
        {/if}
      </div>

      <!-- You: your place card, your bid as coins, the order of your hand. -->
      <div class="desk-me">
        <span class="desk-sort">{#if mine >= 0 && game.hand && game.hand.length > 1}<SortToggle />{/if}</span>
        {#if mine >= 0 || n > 0}<SeatChip {game} seat={home} player={playerAt(home)} me={mine >= 0} showBid={false} />{/if}
        <BidCoins bid={game.bids[home]} won={game.won[home] ?? 0} bidding={game.stage === 'bid' && game.waiting.includes(home) && mine < 0} hidden={game.bidIn[home] && game.bids[home] === null} />
      </div>

      <div class="desk-hand">
        <!-- The status line and your bid or trump pick float over the hand, drawn at the table's size. -->
        <div class="desk-float">
          {@render notice()}
          {@render panels()}
        </div>
        {@render hand(prefs.hand === 'flat', true, scale)}
      </div>
    </div>
  </div>

  {#if game.phase === 'scored'}
    <RoundEnd {room} {view} />
  {/if}
</div>
{:else}
<div class="table" class:my-turn={myTurn}>
  <header class="top">
    <div class="round">
      <span class="label on-cloth">{t('round')}</span>
      <span class="display">{game.no}<small>/{game.rounds}</small></span>
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
      {#if game.endsAt && game.phase === 'round'}<Clock {room} endsAt={game.endsAt} seconds={game.moveSeconds} mine={myTurn} />{/if}
      <button class="tool" type="button" onclick={() => (padOpen = true)} aria-label={t('scorePad')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>
      </button>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <ewo-settings-button onclick={() => (settingsOpen = true)}></ewo-settings-button>
    </div>
  </header>

  <div class="felt cloth">
  <div class="seats" style:--count={others.length}>
    {#each others as seat, i (seat)}
      <div class="far" style:--lift="{Math.round((1 - Math.sin(((i + 1) / (others.length + 1)) * Math.PI)) * 14)}px">
        <SeatChip {game} {seat} player={playerAt(seat)} compact />
        <span class="held" aria-label={game.foreheads?.[seat] ? t('foreheadOf', { name: playerAt(seat)?.name ?? '', card: nameOf(fromId(game.foreheads[seat]), i18n.lang) }) : t('cardsLeft', { n: game.counts[seat] })}>
          {#if game.foreheads?.[seat]}
            <!-- The forehead round: their card held up for everyone else to see, over the felt (the row keeps its height). -->
            <span class="brow"><Card id={game.foreheads[seat]} /></span>
          {:else}
            {#each { length: Math.min(game.counts[seat], 7) } as _, k (k)}<i style:--k={k - (Math.min(game.counts[seat], 7) - 1) / 2}></i>{/each}
          {/if}
        </span>
      </div>
    {/each}
  </div>

  <div class="middle" bind:this={trickEl}>
    <Trick {room} trick={game.trick} last={game.lastTrick} holdUntil={game.holdUntil} tempo={game.tempo} {mine} {n} bind:width={trickW} bind:height={trickH} />
  </div>
  </div>

  <div class="dock">
    {@render notice()}

    {@render panels()}

    <div class="mine">
      {#if mine >= 0 || n > 0}<SeatChip {game} seat={home} player={playerAt(home)} me={mine >= 0} />{/if}
      {#if mine >= 0 && game.hand && game.hand.length > 1}<span class="sorter"><SortToggle /></span>{/if}
    </div>

    {@render hand(false, false, 1)}
  </div>

  {#if game.phase === 'scored'}
    <RoundEnd {room} {view} />
  {/if}
</div>

{/if}

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
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    /* A fixed height, not a minimum: the round's two type sizes on one line set the line box by the
       face's measurements, so the bar was 3 px taller until Stichle Display had loaded and the
       table under it moved (tools/qa.mjs caught it). */
    height: 59px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgb(236 230 214 / 0.12);
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
  /* The cloth on the table: from under the bar to your seat, which sits on its near edge. Its size
     comes from the screen alone: the bar and the dock below keep fixed heights, and whatever comes
     and goes (the status, the bid, the trump pick) floats over it. */
  .cloth {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin: 22px 6px -30px;
    padding: 18px 12px 34px;
  }
  /* The far side of the table: the middle seat furthest away, the outer ones a little nearer, like
     chairs round a table. */
  .seats {
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 6px;
    padding-bottom: 14px;
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
  /* The forehead round: their one card, face up, held where their hand would be. */
  .brow {
    position: absolute;
    z-index: 1;
    left: 50%;
    top: 8px;
    width: 44px;
    margin-left: -22px;
    rotate: -4deg;
    filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.5));
    animation: brow-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards;
  }
  @keyframes brow-in {
    from {
      translate: 0 8px;
      opacity: 0;
    }
  }
  .brow-hint {
    font-size: 13px;
    color: var(--mute);
    text-align: center;
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
    background: var(--back-ground);
    box-shadow: 0 0 0 1px var(--back-line), inset 0 0 0 2px rgb(255 255 255 / 0.08);
    transform-origin: 50% 120%;
    rotate: calc(var(--k) * 9deg);
  }

  /* The pile's room: whatever the rest leaves. While you bid it's empty anyway, so it gives way. */
  .middle {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
  }

  .dock {
    position: relative;
    z-index: 5;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  /* On the table's near edge, whatever the table: a small dark plate of its own, so it reads on the
     tapestry's flowers and on the vellum alike. It floats just above your place card, like the bid,
     so coming and going it never takes room from the cloth (the user, 2026-10-13: the table jumped
     when the line went quiet at the end of a trick and when the bid opened). */
  .status,
  .toast {
    position: absolute;
    z-index: 10;
    left: 50%;
    bottom: calc(100% + 6px);
    translate: -50% 0;
    width: max-content;
    max-width: 100%;
    margin: 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgb(18 11 7 / 0.66);
    font: 600 14px/1.3 var(--ewo-sans);
    text-align: center;
    color: var(--on-cloth-2);
  }
  .status.turn {
    color: var(--gold-hi);
  }
  .toast {
    color: #ffc9bd;
  }
  /* Your trump pick or bid floats over the table, just above your place card: the table keeps its
     size underneath (the user, 2026-10-13), and the felt's middle is empty while it's open. */
  .panel {
    position: absolute;
    z-index: 30;
    left: 0;
    right: 0;
    bottom: calc(100% + 8px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 440px;
    margin-inline: auto;
    padding: 14px 14px 14px;
    box-shadow:
      0 1px 0 rgb(0 0 0 / 0.35),
      0 24px 40px -18px rgb(0 0 0 / 0.85);
    animation: rise 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
  }
  @keyframes rise {
    from {
      translate: 0 14px;
      opacity: 0;
    }
  }
  /* The bid: the number pressed big into the paper, round − and + either side. */
  .bid {
    align-items: center;
    text-align: center;
  }
  .dial {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) 56px;
    align-items: center;
    gap: 10px;
    width: 100%;
    max-width: 320px;
  }
  .step {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    padding: 0;
    border: 1.5px solid var(--ink);
    border-radius: 50%;
    background: #ffffff;
    color: var(--ink);
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--ewo-dur-1) var(--ewo-ease), background-color var(--ewo-dur-1) var(--ewo-ease);
  }
  .step svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .step:disabled {
    opacity: 0.3;
  }
  @media (hover: hover) and (pointer: fine) {
    .step:hover:not(:disabled) {
      background: var(--paper-2);
    }
    .step:active:not(:disabled) {
      transform: scale(0.92);
    }
  }
  .value {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    overflow: hidden;
  }
  /* The line is tall enough for the face's old-style digits: 6 and 8 rise, 3, 4, 5, 7 and 9 drop
     below the line, and the box clips (for the count-up animation). */
  .big {
    display: block;
    font-size: 72px;
    line-height: 1.34;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    text-shadow: 0 1px 0 rgb(255 255 255 / 0.8), 0 -1px 0 rgb(0 0 0 / 0.14);
    animation: pop 0.34s cubic-bezier(0.25, 1.6, 0.4, 1) both;
  }
  .big.down {
    animation-name: drop;
  }
  /* A new number comes in from the side it was counted towards, with a little overshoot. */
  @keyframes pop {
    from {
      translate: 0 18px;
      scale: 0.7;
      opacity: 0;
    }
  }
  @keyframes drop {
    from {
      translate: 0 -18px;
      scale: 0.7;
      opacity: 0;
    }
  }
  .sofar {
    font-size: 13px;
    color: var(--mute);
  }
  .sofar.no {
    color: var(--bad);
    font-weight: 600;
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
    position: relative;
    display: flex;
    justify-content: center;
  }
  /* The hand's order, at the row's far end, just under the cloth's rail (never on its stitching) and
     above the hand's own room: out of the way, and nothing moves when it shows. */
  .sorter {
    position: absolute;
    right: 6px;
    top: calc(100% - 14px);
  }
  .watching {
    margin: 10px 0 18px;
    text-align: center;
    color: var(--on-cloth-2);
  }

  /* ---------- The desktop table (the user's pick C, 2026-10-14) ----------
     Its own class names, so nothing here reaches the phone's table above. The cloth keeps its edge
     (app.css → .felt: each table's rail, studs or border), the room round it; a grid inside it keeps
     every row one height, so nothing moves while you play.
     Its size is --scale (Table size in Settings; Auto grows it with the window): the measures here
     are multiplied by it, and the parts that lie on the cloth take it as zoom. Nothing with a
     viewport unit is zoomed (zoom would scale the vw as well). */
  .desk {
    --scale: 1;
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: calc(62px * var(--scale)) minmax(0, 1fr);
    color: var(--on-cloth);
  }
  .desk-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: calc(24px * var(--scale));
    padding: 0 max(calc(44px * var(--scale)), calc((100vw - 1640px * var(--scale)) / 2));
    border-bottom: 1px solid rgb(236 230 214 / 0.12);
  }
  .desk-round,
  .desk-rules,
  .desk-bar .tools,
  .desk-seat,
  .desk-deck,
  .desk-side,
  .desk-me,
  .desk-float {
    zoom: var(--scale);
  }
  .desk-round {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .desk-round b {
    font-size: 27px;
    font-weight: 400;
    line-height: 1;
  }
  .desk-round small {
    font-size: 15px;
    color: var(--on-cloth-2);
  }
  .desk-rules {
    font-size: 13px;
    color: var(--on-cloth-2);
  }
  .desk-room {
    min-height: 0;
    display: flex;
    padding: calc(32px * var(--scale)) max(calc(48px * var(--scale)), calc((100vw - 1640px * var(--scale)) / 2)) calc(30px * var(--scale));
  }
  .desk-cloth {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: calc(230px * var(--scale)) minmax(0, 1fr) calc(230px * var(--scale));
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: calc(26px * var(--scale)) calc(26px * var(--scale)) calc(6px * var(--scale));
  }
  /* The others across the far side. */
  .desk-seats {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    justify-items: center;
  }
  .desk-seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .desk-seat :global(.seat) {
    min-width: 150px;
  }
  .desk-under {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 22px;
  }
  .desk-brow {
    position: absolute;
    z-index: 1;
    top: 30px;
    left: 50%;
    width: 58px;
    margin-left: -29px;
    rotate: -4deg;
    filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.5));
  }
  /* The deck with the trump turned up, and the last trick: lying on the cloth, left and right. */
  .desk-deck,
  .desk-last {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
  }
  .desk-deck {
    grid-column: 1;
    grid-row: 2;
    align-self: center;
    justify-self: center;
  }
  .desk-side {
    grid-column: 3;
    grid-row: 2;
    align-self: center;
    justify-self: center;
  }
  .desk-pile {
    position: relative;
    display: block;
    width: 160px;
    height: 136px;
  }
  .desk-pile .c {
    position: absolute;
    display: block;
    width: 88px;
    filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.45));
  }
  .desk-pile .b1 {
    left: 4px;
    top: 6px;
    rotate: -5deg;
  }
  .desk-pile .b2 {
    left: 8px;
    top: 0;
    rotate: -2deg;
  }
  .desk-pile .turned {
    left: 66px;
    top: 16px;
    rotate: 12deg;
  }
  .desk-pile.small {
    width: 124px;
  }
  .desk-pile.small .b1 {
    left: 16px;
    rotate: 8deg;
  }
  .desk-pile.small .b2 {
    left: 20px;
    rotate: -3deg;
  }
  .desk-tag {
    font: 650 11px/1.3 var(--ewo-sans);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--on-cloth-2);
    text-align: center;
  }
  .desk-tag b {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--on-cloth);
    font-weight: 650;
  }
  .desk-tag .suit {
    width: 10px;
    height: 10px;
  }
  .desk-tag .suit.fire {
    color: var(--fire-lum);
  }
  .desk-tag .suit.water {
    color: var(--water-lum);
  }
  .desk-tag .suit.earth {
    color: var(--earth-lum);
  }
  .desk-tag .suit.air {
    color: var(--air-lum);
  }
  .desk-last {
    position: relative;
  }
  .desk-peek {
    position: absolute;
    z-index: 20;
    bottom: calc(100% + 8px);
    right: -12px;
    display: flex;
    gap: 6px;
    padding: 10px;
    border-radius: 14px;
    background: rgb(18 11 7 / 0.84);
    box-shadow: 0 18px 30px -16px rgb(0 0 0 / 0.9);
    opacity: 0;
    translate: 0 6px;
    pointer-events: none;
    transition:
      opacity 0.2s,
      translate 0.2s;
  }
  .desk-peek .c {
    display: block;
    width: 62px;
  }
  .desk-peek .c.taker {
    outline: 2px solid var(--gold-hi);
    outline-offset: 1px;
    border-radius: 5px;
  }
  .desk-last:hover .desk-peek,
  .desk-last:focus-visible .desk-peek {
    opacity: 1;
    translate: 0 0;
  }
  .desk-middle {
    grid-column: 2;
    grid-row: 2;
    position: relative;
    min-height: 0;
  }
  /* You: at the near edge, on the left of your hand. */
  .desk-me {
    grid-column: 1;
    grid-row: 3;
    align-self: end;
    justify-self: start;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 12px;
    width: 210px;
    height: 180px;
    padding: 0 0 34px 6px;
    box-sizing: border-box;
  }
  /* The sort button's place is kept whether it shows or not: your place card never moves. */
  .desk-sort {
    display: block;
    height: 32px;
  }
  .desk-hand {
    grid-column: 2;
    grid-row: 3;
    position: relative;
    z-index: 5;
  }
  /* A line along the hand's top edge: the status and the panels float above it. */
  .desk-float {
    position: absolute;
    z-index: 30;
    top: 0;
    left: 0;
    right: 0;
    height: 0;
  }
</style>
