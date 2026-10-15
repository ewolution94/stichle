<!--
  The trick laid out in the order it was played (the user, 2026-10-15: "with 4 or 5 cards on the
  stack it gets harder to see which card is winning"): a tap on the stack opens it over the cloth,
  the cards side by side with who played them, the one taking the trick so far ringed in gold. It
  follows the trick as cards come in, and shows the finished one while it lies on the table. A tap,
  or Escape, closes it. The stack itself stays as it is.
-->
<script lang="ts">
  import type { Played } from '../lib/api';
  import type { Suit } from '../lib/deck';
  import { i18n, suitName, t } from '../lib/i18n.svelte';
  import { nameOf, fromId } from '../lib/deck';
  import { suitToFollow, trickWinner } from '../../server/rules.mjs';
  import Card from './Card.svelte';

  let {
    cards,
    trump,
    decided = null,
    stolen = false,
    nameAt,
    onclose,
  }: {
    /** In the order they were played. */
    cards: Played[];
    trump: Suit | null;
    /** The seat that took it, once the trick is finished. */
    decided?: number | null;
    /** The Dieb was in it: it counts for nobody. */
    stolen?: boolean;
    nameAt: (seat: number) => string;
    onclose: () => void;
  } = $props();

  /** Who takes it so far: the rules' own answer (server/rules.mjs), the seat that took it once it's done. */
  const best = $derived(decided !== null ? cards.findIndex((c) => c.seat === decided) : trickWinner(cards, trump));
  const led = $derived(suitToFollow(cards) as Suit | null);
  const thief = $derived(stolen || cards.some((c) => c.card === 'thief'));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- The tap stays here: on the stack below it, it would open the overview again. -->
<div
  class="over"
  role="dialog"
  aria-label={t('trickOverview')}
  tabindex="-1"
  onclick={(e) => {
    e.stopPropagation();
    onclose();
  }}
>
  <div class="plate">
    <p class="head">
      {#if led}<span>{t('trickLed')}: <b><span class="suit {led}" aria-hidden="true"></span>{suitName(led)}</b></span>{/if}
      <span>{t('trump')}: <b>{#if trump}<span class="suit {trump}" aria-hidden="true"></span>{suitName(trump)}{:else}{t('noTrumpShort')}{/if}</b></span>
    </p>
    <ol class="row" style:--n={cards.length}>
      {#each cards as played, i (played.card)}
        <li class:best={i === best} aria-label="{i + 1}. {nameAt(played.seat)}: {nameOf(fromId(played.card), i18n.lang)}">
          <span class="no">{i + 1}</span>
          <span class="card">
            <Card id={played.card} />
            {#if i === best}<span class="tag">{thief ? t('trickStolenTag') : decided !== null ? t('trickTakes') : t('trickLeads')}</span>{/if}
          </span>
          <span class="who">{nameAt(played.seat)}</span>
        </li>
      {/each}
    </ol>
    {#if thief}<p class="note">{t('trickStolenNote')}</p>{/if}
  </div>
</div>

<style>
  /* Over the cloth's middle, the stack dimmed behind it. */
  .over {
    position: absolute;
    inset: 0;
    z-index: 25;
    display: grid;
    place-items: center;
    padding: 8px;
    /* A soft shade round the plate, fading out before the edges: no box on the cloth. */
    background: radial-gradient(closest-side, rgb(10 7 5 / 0.5), rgb(10 7 5 / 0.3) 60%, transparent);
    animation: fade 0.18s ease-out both;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .plate {
    display: grid;
    gap: 12px;
    width: min(100%, 560px);
    padding: 14px 12px 12px;
    border-radius: 16px;
    background: rgb(18 11 7 / 0.9);
    box-shadow: 0 18px 30px -16px rgb(0 0 0 / 0.9);
    color: var(--on-cloth);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 16px;
    margin: 0;
    font: 650 11px/1.3 var(--ewo-sans);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--on-cloth-2);
  }
  .head b {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--on-cloth);
  }
  .head .suit {
    width: 9px;
    height: 9px;
  }
  .suit.fire {
    color: var(--fire-lum);
  }
  .suit.water {
    color: var(--water-lum);
  }
  .suit.earth {
    color: var(--earth-lum);
  }
  .suit.air {
    color: var(--air-lum);
  }
  /* The cards in a row, as many as were played, all one width: as wide as the row allows, never above
     84 px. */
  .row {
    display: grid;
    grid-template-columns: repeat(var(--n), min(84px, calc((100% - (var(--n) - 1) * 8px) / var(--n))));
    justify-content: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 6px;
    min-width: 0;
  }
  .no {
    font: 600 11px/1 var(--ewo-mono);
    color: var(--on-cloth-2);
  }
  .card {
    position: relative;
    display: block;
    width: 100%;
    border-radius: 6px;
    transition: box-shadow 0.2s;
  }
  .who {
    overflow: hidden;
    max-width: 100%;
    font: 600 11.5px/1.2 var(--ewo-sans);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The card that takes it: lifted a little, ringed in gold, its tag under the name. */
  li.best .card {
    box-shadow:
      0 0 0 2px var(--gold-hi),
      0 0 14px 2px rgb(243 220 148 / 0.45);
  }
  li.best .no {
    color: var(--gold-hi);
  }
  /* On the card's foot, so the row keeps one line of names. */
  .tag {
    position: absolute;
    left: 50%;
    bottom: -7px;
    translate: -50% 0;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--gold-hi);
    color: var(--ink);
    font: 650 10px/1.3 var(--ewo-sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .note {
    margin: 0;
    font-size: 12.5px;
    text-align: center;
    color: var(--on-cloth-2);
  }
</style>
