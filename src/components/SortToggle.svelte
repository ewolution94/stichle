<!--
  The order of your hand (the user, 2026-10-14: "nothing too fancy, just a couple of options to
  toggle through"): by suit, as dealt, or strongest first. One small plate by your place card; a tap
  switches, and the cards slide to their new places (Hand.svelte keeps each card's element).
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { prefs, setSort } from '../lib/prefs.svelte';

  const next = $derived(prefs.sort === 'suit' ? 'strength' : 'suit');
</script>

<button class="sort" type="button" onclick={() => setSort(next)} aria-label={t('sortBy', { order: t(`sort_${prefs.sort}`) })} title={t('sortSwitch', { order: t(`sort_${next}`) })}>
  <svg viewBox="0 0 20 20" aria-hidden="true">
    {#if prefs.sort === 'suit'}
      <!-- Four little piles, one per suit. -->
      <rect x="2.5" y="5" width="3" height="10" rx="1" /><rect x="6.5" y="5" width="3" height="10" rx="1" /><rect x="10.5" y="5" width="3" height="10" rx="1" /><rect x="14.5" y="5" width="3" height="10" rx="1" />
    {:else}
      <!-- Steps going down: strongest first. -->
      <rect x="2.5" y="3" width="3" height="14" rx="1" /><rect x="6.5" y="6" width="3" height="11" rx="1" /><rect x="10.5" y="9" width="3" height="8" rx="1" /><rect x="14.5" y="12" width="3" height="5" rx="1" />
    {/if}
  </svg>
  <span>{t(`sort_${prefs.sort}`)}</span>
</button>

<style>
  /* A small dark plate, like the status line's: it reads on every table and stays out of the way. */
  .sort {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 11px 0 9px;
    border: 0;
    border-radius: 999px;
    background: rgb(18 11 7 / 0.66);
    color: var(--on-cloth-2);
    font: 600 12px/1 var(--ewo-sans);
    letter-spacing: 0.02em;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.2s, background-color 0.2s;
  }
  .sort svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  @media (hover: hover) and (pointer: fine) {
    .sort:hover {
      color: var(--on-cloth);
      background: rgb(18 11 7 / 0.82);
    }
  }
  .sort:active {
    scale: 0.96;
  }
  .sort:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
</style>
