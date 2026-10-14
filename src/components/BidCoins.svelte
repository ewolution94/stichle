<!--
  A seat's bid on the desktop table (the user's pick C, 2026-10-14): a coin on the felt for every
  trick bid, filled with gold as the tricks come in; a trick over the bid lies as a red coin. A bid of
  nothing is a short gold line; while they're still bidding, three dots; a secret bid already in, a
  coin face down.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';

  let { bid, won, bidding = false, hidden = false }: { bid: number | null; won: number; bidding?: boolean; hidden?: boolean } = $props();

  const coins = $derived(bid === null ? [] : Array.from({ length: Math.max(bid, won) }, (_, i) => (i < Math.min(bid, won) ? 'won' : i < bid ? 'open' : 'over')));
  /** More than eight would need a second row (and move the table): then one coin and the count. */
  const MAX = 8;
</script>

<span class="coins" aria-label={bid === null ? (hidden ? t('bidDone') : bidding ? t('bidding') : '') : t('bidWon', { bid, won })}>
  {#if bid === null}
    {#if hidden}<i class="coin back"></i>{:else if bidding}<span class="dots">…</span>{/if}
  {:else if bid === 0 && won === 0}
    <i class="nil"></i>
  {:else if coins.length > MAX}
    <i class="coin {won > bid ? 'over' : won === bid ? 'won' : 'open'}"></i><span class="count">{won}/{bid}</span>
  {:else}
    {#each coins as kind, i (i)}<i class="coin {kind}"></i>{/each}
  {/if}
</span>

<style>
  .coins {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    min-height: 20px;
    max-width: 180px;
  }
  .coin {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    transition: background 0.3s, box-shadow 0.3s;
  }
  .coin.open {
    box-shadow: inset 0 0 0 2px var(--gold);
  }
  .coin.won {
    background: radial-gradient(circle at 35% 30%, var(--gold-hi), var(--gold) 60%, var(--gold-lo));
    box-shadow: 0 2px 3px rgb(0 0 0 / 0.4);
    animation: drop 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.3) backwards;
  }
  .coin.over {
    background: radial-gradient(circle at 35% 30%, #ff9d8c, #c0392b 65%, #7a1f16);
    box-shadow: 0 2px 3px rgb(0 0 0 / 0.4);
  }
  .coin.back {
    background: var(--back-ground);
    box-shadow: 0 0 0 1.5px var(--back-line);
  }
  .nil {
    width: 20px;
    height: 3px;
    border-radius: 2px;
    background: var(--gold);
  }
  .count {
    font: 600 13px/1 var(--ewo-mono);
    color: var(--on-cloth);
  }
  .dots {
    font: 600 14px/1 var(--ewo-sans);
    color: var(--on-cloth-2);
  }
  @keyframes drop {
    from {
      scale: 1.5;
      opacity: 0;
    }
  }
</style>
