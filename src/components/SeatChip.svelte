<!--
  One seat at the table: the player's seal and name, what they bid and how many tricks they have
  (pips that fill, gold when the bid is met, red once it's overshot), their score, and whose move
  it is (a gold ring, with the clock when there is one). The dealer carries a small deck.
-->
<script lang="ts">
  import type { Game, Player } from '../lib/api';
  import { score, t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import Avatar from './Avatar.svelte';
  import Clock from './Clock.svelte';

  let {
    room,
    game,
    seat,
    player,
    me = false,
    compact = false,
  }: { room: Room; game: Game; seat: number; player: Player | undefined; me?: boolean; compact?: boolean } = $props();

  const bidValue = $derived(game.bids[seat]);
  const won = $derived(game.won[seat] ?? 0);
  const active = $derived(game.phase === 'round' && game.stage !== 'done' && game.turn === seat);
  const dealer = $derived(game.dealer === seat);
  const over = $derived(bidValue !== null && won > bidValue);
  const met = $derived(bidValue !== null && won === bidValue);
  const pips = $derived(Math.max(bidValue ?? 0, won));
</script>

<div class="seat" class:active class:me class:compact class:gone={game.gone[seat] || (player && !player.online)}>
  <div class="face">
    {#if player}<Avatar avatar={player.avatar} size={compact ? 30 : 36} />{/if}
    {#if dealer}<span class="dealer" title={t('dealer')} aria-label={t('dealer')}></span>{/if}
  </div>
  <div class="info">
    <span class="name">{me ? t('you') : (player?.name ?? '?')}</span>
    <span class="line">
      {#if bidValue === null}
        <span class="bid wait">{active && game.stage === 'bid' ? t('bidding') : '–'}</span>
      {:else}
        <span class="bid" class:met class:over aria-label={t('bidWon', { bid: bidValue, won })}>
          {#if pips <= 6}
            {#each { length: pips } as _, i (i)}<i class:on={i < won} class:extra={i >= bidValue}></i>{/each}
            {#if pips === 0}<span class="zero">0</span>{/if}
          {:else}
            <span class="count">{won}/{bidValue}</span>
          {/if}
        </span>
      {/if}
      <span class="total">{score(game.totals[seat])}</span>
    </span>
  </div>
  {#if active && game.endsAt}<span class="clock"><Clock {room} endsAt={game.endsAt} tick={me} /></span>{/if}
</div>

<style>
  .seat {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding: 5px 9px 5px 5px;
    border-radius: 999px;
    background: rgb(10 16 46 / 0.55);
    box-shadow: inset 0 0 0 1px rgb(236 230 214 / 0.14);
    color: var(--on-cloth);
    transition: box-shadow 0.25s, background-color 0.25s;
  }
  .seat.compact {
    flex-direction: column;
    gap: 3px;
    padding: 6px 4px 5px;
    border-radius: 14px;
    text-align: center;
  }
  .seat.active {
    background: rgb(10 16 46 / 0.75);
    box-shadow: inset 0 0 0 1.5px var(--gold), 0 0 16px -2px rgb(243 220 148 / 0.45);
  }
  .seat.gone {
    opacity: 0.55;
  }
  .face {
    position: relative;
    flex: none;
    display: grid;
  }
  /* The dealer's deck: two small cards, one on the other. */
  .dealer {
    position: absolute;
    right: -5px;
    bottom: -3px;
    width: 12px;
    height: 16px;
    border-radius: 2px;
    background: var(--paper);
    box-shadow: -3px -2px 0 -1px var(--paper-2), 0 0 0 1px var(--cloth);
  }
  .dealer::after {
    content: '';
    position: absolute;
    inset: 3px;
    border: 1px solid var(--gold-lo);
    border-radius: 1px;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .compact .info {
    align-items: center;
  }
  .name {
    overflow: hidden;
    max-width: 100%;
    font: 600 12.5px/1.15 var(--ewo-sans);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bid {
    display: inline-flex;
    align-items: center;
    gap: 2.5px;
    min-height: 10px;
  }
  .bid i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.2px var(--on-cloth-2);
  }
  .bid i.on {
    background: var(--on-cloth);
    box-shadow: none;
  }
  .bid.met i.on {
    background: var(--gold-hi);
  }
  .bid i.extra.on {
    background: #ff8a73;
  }
  .bid .zero,
  .bid .count,
  .bid.wait {
    font: 600 11px/1 var(--ewo-mono);
    color: var(--on-cloth-2);
  }
  .bid.met .zero,
  .bid.met .count {
    color: var(--gold-hi);
  }
  .bid.over .count {
    color: #ff8a73;
  }
  .total {
    font: 700 13px/1 var(--display);
    font-variant-numeric: tabular-nums;
    color: var(--on-cloth);
  }
  .clock {
    position: absolute;
    top: -10px;
    right: -6px;
  }
</style>
