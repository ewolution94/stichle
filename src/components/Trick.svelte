<!--
  The middle of the table: the cards of the trick in progress, each in front of the seat that played
  it, a little askew, landing with a slap. A finished trick stays for its moment (the server's
  holdUntil), the winning card catches the light, then the cards sweep off towards the winner.
  Your own card arrives from your hand (Hand.svelte flies it here), so it isn't drawn until it lands.
-->
<script lang="ts">
  import type { FinishedTrick, Trick } from '../lib/api';
  import { flight } from '../lib/flight.svelte';
  import type { Room } from '../lib/room.svelte';
  import { angleOf, slotOffset, sweepOffset, trickCardWidth, twist } from '../lib/table';
  import Card from './Card.svelte';

  let {
    room,
    trick,
    last,
    holdUntil,
    mine,
    n,
    width = $bindable(320),
    height = $bindable(260),
    cap = undefined,
  }: {
    room: Room;
    trick: Trick;
    last: FinishedTrick | null;
    holdUntil: number;
    mine: number;
    n: number;
    width?: number;
    height?: number;
    /** The largest a card may be (the big screen's are bigger). */
    cap?: number;
  } = $props();

  let now = $state(Date.now());
  // The clock only runs while there's a finished trick to time (its pause, then its sweep), and a
  // card in the air.
  $effect(() => {
    const wait = Math.max(room.left(holdUntil), flight.until - Date.now());
    if (wait <= -SWEEP) return;
    const timers = [wait + 20, wait + SWEEP + 20].filter((ms) => ms > 0).map((ms) => setTimeout(() => (now = Date.now()), ms));
    return () => timers.forEach(clearTimeout);
  });
  $effect(() => {
    void trick.cards.length;
    void last?.n;
    now = Date.now();
  });

  const SWEEP = 560;
  const showLast = $derived(!trick.cards.length && last !== null && room.left(holdUntil, now) > -SWEEP);
  const sweeping = $derived(showLast && room.left(holdUntil, now) <= 0);
  const shown = $derived(trick.cards.length ? trick.cards : showLast && last ? last.cards : []);
  const cw = $derived(trickCardWidth(width, height, cap));

  function place(seat: number) {
    const { dx, dy } = slotOffset(angleOf(seat, mine, n), cw);
    return { x: width / 2 + dx - cw / 2, y: height / 2 + dy - (cw * 1.4) / 2 };
  }

  /** Where a card comes from as it lands: from its player's side of the table. */
  function from(seat: number) {
    const { dx, dy } = sweepOffset(angleOf(seat, mine, n), width * 0.25, height * 0.25);
    return { x: dx, y: dy };
  }

  /** Off towards the winner's seat, a little further out than their card lay. */
  const away = $derived.by(() => {
    if (!last) return { x: 0, y: 0 };
    const { dx, dy } = sweepOffset(angleOf(last.winner, mine, n), width, height);
    return { x: dx, y: dy };
  });
</script>

<div class="trick" bind:clientWidth={width} bind:clientHeight={height} aria-live="polite">
  {#each shown as played, i (played.card)}
    {@const p = place(played.seat)}
    {@const won = showLast && last?.winner === played.seat}
    {@const hidden = played.card === flight.card && now < flight.until}
    <div
      class="played"
      class:won
      class:sweep={sweeping}
      class:mine={played.seat === mine}
      style:width="{cw}px"
      style:left="{p.x}px"
      style:top="{p.y}px"
      style:z-index={i + 1}
      style:--r="{twist(played.card, played.seat)}deg"
      style:--ax="{away.x}px"
      style:--ay="{away.y}px"
      style:--fx="{from(played.seat).x}px"
      style:--fy="{from(played.seat).y}px"
      style:visibility={hidden ? 'hidden' : 'visible'}
    >
      <Card id={played.card} />
    </div>
  {/each}
</div>

<style>
  .trick {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .played {
    position: absolute;
    rotate: var(--r);
    /* Backwards only: a fill that held the end state would keep the card opaque through its sweep. */
    animation: land 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards;
    transition:
      translate 0.5s cubic-bezier(0.5, 0, 0.75, 0),
      opacity 0.5s ease-in,
      scale 0.5s ease-in;
  }
  .played.mine {
    animation: none;
  }
  /* Dropped onto the pile from its player's side: a little bigger, a little further out, then down. */
  @keyframes land {
    from {
      translate: var(--fx) var(--fy);
      scale: 1.16;
      opacity: 0;
    }
  }
  /* The trick's winner catches the light: a gold ring and a lift. */
  .played.won {
    z-index: 20 !important;
    scale: 1.06;
  }
  .played.won :global(.face) {
    box-shadow:
      0 0 0 2px var(--gold-hi),
      0 0 18px 2px rgb(243 220 148 / 0.55),
      0 14px 22px -10px rgb(5 8 25 / 0.8);
  }
  .played.sweep {
    translate: var(--ax) var(--ay);
    scale: 0.7;
    opacity: 0;
  }
</style>
