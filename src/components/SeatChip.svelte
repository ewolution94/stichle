<!--
  One seat at the table: the player's seal and name, what they bid and how many tricks they have
  (pips that fill, gold when the bid is met, red once it's overshot), their score, and whose move
  it is (a gold ring; the move's clock runs in the bar over the table, Clock.svelte). The dealer
  carries a small deck; whoever plays the round's first card carries a gold tag until it's played.
-->
<script lang="ts">
  import type { Game, Player } from '../lib/api';
  import { score, t } from '../lib/i18n.svelte';
  import { opener } from '../lib/table';
  import Avatar from './Avatar.svelte';

  let {
    game,
    seat,
    player,
    me = false,
    compact = false,
  }: { game: Game; seat: number; player: Player | undefined; me?: boolean; compact?: boolean } = $props();

  const bidValue = $derived(game.bids[seat]);
  const won = $derived(game.won[seat] ?? 0);
  const active = $derived(game.phase === 'round' && game.waiting.includes(seat));
  const dealer = $derived(game.dealer === seat);
  const opens = $derived(opener(game) === seat);
  const over = $derived(bidValue !== null && won > bidValue);
  const met = $derived(bidValue !== null && won === bidValue);
  const pips = $derived(Math.max(bidValue ?? 0, won));
</script>

<div class="seat" class:active class:me class:compact class:opens class:gone={game.gone[seat] || (player && !player.online)}>
  <div class="face">
    {#if player}<Avatar avatar={player.avatar} size={compact ? 30 : 36} />{/if}
    {#if dealer}<span class="dealer" title={t('dealer')} aria-label={t('dealer')}></span>{/if}
  </div>
  <div class="info">
    <span class="name">{me ? t('you') : (player?.name ?? '?')}</span>
    <span class="line">
      {#if bidValue === null}
        <!-- Your own bid is asked in its panel above your seat: no "bidding …" here as well. -->
        {#if active && game.stage === 'bid' && !me}<span class="bid wait">{t('bidding')}</span>
        {:else if game.bidIn[seat]}<span class="bid wait done" aria-label={t('bidDone')}>✓ {t('bidHidden')}</span>{/if}
      {:else}
        <span class="bid" class:met class:over aria-label={t('bidWon', { bid: bidValue, won })}>
          {#if pips <= 6}
            {#each { length: pips } as _, i (i)}<i class:on={i < won} class:extra={i >= bidValue}></i>{/each}
            {#if pips === 0}<b class="nil"></b>{/if}
          {:else}
            <span class="count">{won}/{bidValue}</span>
          {/if}
        </span>
      {/if}
      <span class="total">{score(game.totals[seat])}</span>
    </span>
  </div>
  {#if opens}<span class="opens-tag"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2.5 9 6 3 9.5Z" /></svg>{t('opensTag')}</span>{/if}
</div>

<style>
  /* A place card, as at a banquet: the cards' own paper with their double rule, the player's seal
     pressed onto it, name and score in ink. Solid, so nothing of the table shows through. Whose
     turn it is: a gold edge, lifted a little off the cloth. */
  .seat {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 12px 6px 6px;
    border-radius: 12px;
    background: var(--paper);
    color: var(--ink);
    box-shadow:
      0 1px 0 rgb(0 0 0 / 0.35),
      0 12px 20px -12px rgb(0 0 0 / 0.8);
    transition:
      box-shadow 0.25s,
      translate 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  /* The double rule, inside the edge. */
  .seat::before {
    content: '';
    position: absolute;
    inset: 3px;
    border: 1px solid rgb(28 26 34 / 0.45);
    border-radius: 9px;
    box-shadow: inset 0 0 0 2px var(--paper), inset 0 0 0 3px rgb(28 26 34 / 0.2);
    pointer-events: none;
  }
  /* The paper's grain, as on the cards. */
  .seat::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: var(--grain);
    background-size: 160px;
    mix-blend-mode: multiply;
    opacity: 0.35;
    pointer-events: none;
  }
  /* At the far side of the table: upright, the seal standing out over the top edge. */
  .seat.compact {
    flex-direction: column;
    gap: 2px;
    margin-top: 16px;
    padding: 22px 6px 7px;
    text-align: center;
  }
  .compact .face {
    position: absolute;
    top: -16px;
    left: 50%;
    translate: -50% 0;
  }
  .seat.active {
    translate: 0 -2px;
    box-shadow:
      0 0 0 2px var(--gold),
      0 0 0 4px rgb(201 162 74 / 0.25),
      0 0 18px 2px rgb(243 220 148 / 0.35),
      0 14px 22px -12px rgb(0 0 0 / 0.85);
  }
  .seat.gone {
    filter: grayscale(0.7);
    opacity: 0.62;
  }
  .face {
    position: relative;
    z-index: 1;
    flex: none;
    display: grid;
    border-radius: 50%;
    box-shadow: 0 2px 6px -2px rgb(0 0 0 / 0.6);
  }
  /* The dealer's deck: two small cards in the backs' colours. */
  .dealer {
    position: absolute;
    right: -6px;
    bottom: -4px;
    width: 12px;
    height: 16px;
    border-radius: 2px;
    background: var(--back-ground);
    box-shadow:
      -3px -2px 0 -1px var(--back-ground),
      -3px -2px 0 0 var(--back-line),
      0 0 0 1px var(--back-line);
  }
  .info {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .compact .info {
    align-items: center;
    width: 100%;
  }
  .name {
    overflow: hidden;
    max-width: 100%;
    font: 650 12.5px/1.15 var(--ewo-sans);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 15px;
  }
  .bid {
    display: inline-flex;
    align-items: center;
    gap: 2.5px;
  }
  .bid i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.2px rgb(28 26 34 / 0.55);
  }
  .bid i.on {
    background: var(--ink);
    box-shadow: none;
  }
  .bid.met i.on {
    background: var(--earth);
  }
  .bid i.extra.on {
    background: var(--fire);
  }
  .bid .count,
  .bid.wait {
    font: 600 11px/1 var(--ewo-mono);
    color: var(--mute);
  }
  .bid.met .count {
    color: var(--earth);
  }
  /* A bid of nothing: a short rule where the pips would be, not a "0" (the user, 2026-10-13); in the
     earth's green while no trick has come in, like the filled pips of a bid that's met. */
  .bid .nil {
    width: 12px;
    height: 2px;
    border-radius: 1px;
    background: rgb(28 26 34 / 0.55);
  }
  .bid.met .nil {
    background: var(--earth);
  }
  .bid.over .count {
    color: var(--fire);
  }
  .bid.done {
    color: var(--gold-lo);
  }
  .total {
    font: 700 14px/1 var(--display);
    font-variant-numeric: tabular-nums;
  }
  /* Whoever leads the round's first card: a gold tag hanging from the place card's lower edge. */
  .opens-tag {
    position: absolute;
    z-index: 2;
    bottom: -9px;
    left: 50%;
    translate: -50% 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px 3px 6px;
    border-radius: 999px;
    background: linear-gradient(var(--gold-hi), var(--gold));
    color: var(--ink);
    font: 700 9.5px/1 var(--ewo-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    box-shadow: 0 0 0 1px var(--gold-lo), 0 4px 8px -4px rgb(0 0 0 / 0.7);
    animation: tag-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) backwards;
  }
  .opens-tag svg {
    width: 8px;
    height: 8px;
    fill: currentColor;
  }
  @keyframes tag-in {
    from {
      opacity: 0;
      scale: 0.6;
    }
  }
</style>
