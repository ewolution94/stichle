<!--
  A round's result, over the table: everyone's bid, the tricks they took and what it scored (20
  and 10 a trick when it's met, minus 10 a trick when it isn't), and the totals. The next round deals
  once everyone has tapped on, or on its own after a while (server/game.mjs → ROUND_WAIT).
-->
<script lang="ts">
  import type { View } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { actAt } from '../lib/waits';
  import Avatar from './Avatar.svelte';

  let { room, view }: { room: Room; view: View } = $props();

  const game = $derived(view.game!);
  const row = $derived(game.pad.at(-1)!);
  const mine = $derived(view.me ? game.seats.indexOf(view.me) : -1);
  const ready = $derived(view.me !== null && game.ready.includes(view.me));
  /** Seats from yours on, so you're first. */
  const order = $derived(game.seats.map((_, i) => (Math.max(mine, 0) + i) % game.seats.length));
  const playerAt = (seat: number) => view.players.find((p) => p.id === game.seats[seat]);
  const humans = $derived(game.seats.filter((id) => !view.players.find((p) => p.id === id)?.bot).length);

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(timer);
  });
  const left = $derived(game.readyBy ? Math.ceil(room.left(game.readyBy, now) / 1000) : 0);

  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<div class="veil">
  <section class="sheet result" aria-labelledby="round-title">
    <h2 id="round-title" class="display">{t('roundOf', { n: row.round })}</h2>
    <ol>
      {#each order as seat (seat)}
        {@const p = playerAt(seat)}
        {@const met = row.bids[seat] === row.won[seat]}
        <li class:me={seat === mine}>
          {#if p}<Avatar avatar={p.avatar} size={28} />{/if}
          <span class="who">{seat === mine ? t('you') : (p?.name ?? '?')}</span>
          <span class="bw" class:met>{t('bidTook', { bid: row.bids[seat], won: row.won[seat] })}</span>
          <span class="pts display" class:met class:miss={!met}>{sign(row.points[seat])}</span>
          <span class="tot display">{game.totals[seat]}</span>
        </li>
      {/each}
    </ol>
    {#if mine >= 0}
      <button class="btn primary block" type="button" disabled={ready} onclick={(e) => actAt(room, 'next', undefined, e).catch(() => {})}>
        {ready ? t('readyWaiting', { n: game.ready.length, of: humans }) : t('nextRound', { n: row.round + 1 })}
      </button>
    {/if}
    {#if left > 0}<p class="soon">{t('dealsIn', { s: left })}</p>{/if}
  </section>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(6 9 26 / 0.55);
    animation: fade 0.25s ease-out both;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .result {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(100%, 420px);
    padding: 22px 20px 20px;
    animation: rise 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
  }
  @keyframes rise {
    from {
      translate: 0 18px;
      opacity: 0;
    }
  }
  h2 {
    margin: 0;
    font-size: 26px;
    text-align: center;
  }
  ol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto 46px 42px;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 999px;
  }
  li.me {
    background: var(--paper-2);
  }
  .who {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bw {
    font-size: 13px;
    color: var(--mute);
  }
  .pts,
  .tot {
    font-size: 17px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .pts.met {
    color: var(--earth);
  }
  .pts.miss {
    color: var(--fire);
  }
  .tot {
    color: var(--ink);
  }
  .soon {
    margin: 0;
    font-size: 12px;
    text-align: center;
    color: var(--mute);
  }
</style>
