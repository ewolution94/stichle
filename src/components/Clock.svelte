<!--
  The move's clock, in the bar over the table (the user, 2026-10-13: a pill hopping from place card to
  place card was distracting): the seconds left beside a small hourglass, quiet until the last ten, and
  the bar's own rule draining under it (it needs `.top` positioned). Whose move it is, the gold ring on
  their place card says. The rule stays full through a trick's pause and drains from the move's start.
  Ticks in the last five when it's your move.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { play } from '../lib/sound.svelte';

  let { room, endsAt, seconds, mine = false }: { room: Room; endsAt: number; seconds: number; mine?: boolean } = $props();

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 250);
    return () => clearInterval(timer);
  });
  const ms = $derived(room.left(endsAt, now));
  const left = $derived(Math.ceil(ms / 1000));
  const share = $derived(seconds > 0 ? Math.min(1, ms / (seconds * 1000)) : 1);
  const urgent = $derived(left <= 10);
  let ticked = -1;
  $effect(() => {
    if (mine && left > 0 && left <= 5 && left !== ticked) {
      ticked = left;
      play.tick();
    }
  });
</script>

<span class="clock" class:urgent class:mine role="timer" aria-live="off" aria-label={t('clockLeft', { n: left })}>
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6" /></svg>
  {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
</span>
<span class="drain" class:urgent style:--share={share} aria-hidden="true"></span>

<style>
  .clock {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 4px;
    font: 600 13px/1 var(--ewo-mono);
    font-variant-numeric: tabular-nums;
    color: var(--on-cloth-2);
    transition: color 0.3s;
  }
  .clock.mine {
    color: var(--gold-hi);
  }
  .clock.urgent {
    color: #ff9d8c;
  }
  .clock svg {
    width: 1em;
    height: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  /* The bar's rule, draining from the right as the move's time runs out. */
  .drain {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    border-radius: 1px;
    background: var(--gold);
    transform: scaleX(var(--share));
    transform-origin: left center;
    transition:
      transform 0.25s linear,
      background-color 0.3s;
    pointer-events: none;
  }
  .drain.urgent {
    background: #e5533d;
  }
  @media (prefers-reduced-motion: reduce) {
    .drain {
      transition: none;
    }
  }
</style>
