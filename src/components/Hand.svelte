<!--
  Your hand: a fan along the bottom of the table, two rows once it's too many cards for one.
  Run a thumb along it and the cards lift under it; drag one up or flick it, and it flies to the
  middle of the table; or tap a card to lift it and tap it again to play it. A card you may not play
  (you must follow suit) lifts, refuses with a shake and drops back. Hold a card still to look at it
  big (oninspect). Every card is also a button, for the keyboard.
-->
<script lang="ts">
  import { nameOf, fromId } from '../lib/deck';
  import { flying } from '../lib/flight.svelte';
  import { i18n, t } from '../lib/i18n.svelte';
  import Card from './Card.svelte';
  import { fanLayout, fanTransform, flightTransform } from '../../vendor/ewo/elements/card-fan.js';
  import { handGestures, type Dragged } from '../../vendor/ewo/elements/card-hand.js';

  type Target = { x: number; y: number; rot: number; width: number };

  let {
    cards,
    legal,
    canPlay,
    onplay,
    target,
    oninspect,
    onrefuse,
  }: {
    cards: string[];
    /** What may be played now; empty when it's not your move. */
    legal: string[];
    canPlay: boolean;
    /** Sends the move; rejects with the server's reason. */
    onplay: (card: string) => Promise<void>;
    /** Where your card lands in the middle (page coordinates). */
    target: (card: string) => Target | null;
    oninspect: (card: string) => void;
    /** A card that may not be played now was tried. */
    onrefuse: (card: string) => void;
  } = $props();

  const FLY_MS = 380;
  let box: HTMLDivElement | undefined = $state();
  let width = $state(360);
  let sel: string | null = $state(null);
  /** The card in the air: still drawn here until it has landed, but out of the fan. */
  let air = $state<{ card: string; transform: string; landed: boolean } | null>(null);
  let shaking: string | null = $state(null);
  /** The card under a finger that's dragging it, and where it is. */
  let drag = $state<Dragged | null>(null);

  const els = new Map<string, HTMLElement>();
  function register(node: HTMLElement, card: string) {
    els.set(card, node);
    return { destroy: () => els.delete(card) };
  }

  // A selected card that left the hand (played, by you or the bot) is no longer selected.
  $effect(() => {
    if (sel && !cards.includes(sel)) sel = null;
  });
  // A lifted card drops back when you tap or click anywhere but the hand, or press Escape (the user,
  // 2026-10-13: on a laptop there was no way to put it down again).
  $effect(() => {
    if (!sel) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Node && box?.contains(e.target))) sel = null;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sel = null;
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape);
    };
  });
  // Landed, and the server's hand no longer has it: from now on it's the trick's to draw.
  $effect(() => {
    if (air?.landed && !cards.includes(air.card)) air = null;
  });
  /** Drawn in a steady order, so the card in the air keeps its element (and its transition). */
  const list = $derived(air && !cards.includes(air.card) ? [...cards, air.card] : cards);

  // The fan from Folio's card kit (card-fan.js): few cards are held bigger, a full hand shrinks to
  // fit (never below 62 px) and goes to two rows; a laptop's wider table lets them grow a little.
  const fan = $derived(cards.filter((c) => c !== air?.card));
  const sizes = $derived<[number, number, number]>(width > 600 ? [124, 112, 100] : [104, 92, 84]);
  // The hand's box keeps one height all game: the tallest any hand gets at this width (a few cards,
  // held big), with the cards at its foot. A card leaving the hand changes their size, never the box,
  // so the table above never moves (the user, 2026-10-13: "it cannot jump").
  const room = $derived(
    Math.max(...Array.from({ length: 20 }, (_, i) => fanLayout(Array.from({ length: i + 1 }, (_, k) => `${k}`), { width, count: i + 1, sizes }).height)),
  );
  const natural = $derived(fanLayout(fan, { width, count: cards.length, sizes }));
  const layout = $derived(fanLayout(fan, { width, count: cards.length, sizes, top: 22 + room - natural.height }));
  const cw = $derived(layout.cw);
  const ch = $derived(layout.ch);
  const height = $derived(layout.height);
  const places = $derived(layout.places);

  function transformOf(card: string) {
    if (drag?.key === card) return `translate(${drag.x}px, ${drag.y}px) rotate(${drag.r}deg) scale(1.12)`;
    return fanTransform(layout, card, { lifted: card === sel });
  }

  // The gestures from the kit (card-hand.js): scrub, drag or flick up, tap twice, refuse, hold to look.
  $effect(() => {
    if (!box) return;
    const gestures = handGestures(box, {
      fan: () => layout,
      lifted: () => sel,
      lift: (card) => (sel = card),
      enabled: () => !air && fan.length > 0,
      canPlay: () => canPlay,
      playable: (card) => legal.includes(card),
      play: (card) => void send(card),
      refuse,
      inspect: (card) => oninspect(card),
      drag: (d) => (drag = d),
    });
    return () => gestures.destroy();
  });

  function tryPlay(card: string) {
    if (!canPlay) return;
    if (!legal.includes(card)) return refuse(card);
    void send(card);
  }

  function refuse(card: string) {
    shaking = card;
    setTimeout(() => shaking === card && (shaking = null), 420);
    onrefuse(card);
  }

  /** Flies the card to its place in the middle, and sends the move; back into the hand if refused. */
  async function send(card: string) {
    const el = els.get(card);
    const to = target(card);
    if (box && el && to) {
      air = { card, landed: false, transform: flightTransform(layout, box.getBoundingClientRect(), to) };
      flying(card, FLY_MS);
      setTimeout(() => {
        if (air?.card === card) air = { ...air, landed: true };
      }, FLY_MS + 40);
    }
    sel = null;
    try {
      await onplay(card);
    } catch {
      air = null;
      flying('', 0);
      sel = card;
      refuse(card);
    }
  }

  function key(e: MouseEvent, card: string) {
    // Taps arrive as pointer events (the kit's gestures); this is Enter or Space on a focused card.
    if (e.detail !== 0) return;
    sel = card;
    tryPlay(card);
  }
</script>

<div
  class="hand"
  bind:this={box}
  bind:clientWidth={width}
  style:height="{height}px"
  role="group"
  data-press="own"
  aria-label={i18n.lang === 'de' ? 'Deine Karten' : 'Your cards'}
>
  {#each list as card (card)}
    {@const p = places.get(card)}
    <button
      type="button"
      class="slot"
      class:lifted={card === sel}
      class:dim={canPlay && !legal.includes(card)}
      class:dragging={drag?.key === card}
      class:air={air?.card === card}
      class:shake={shaking === card}
      style:width="{cw}px"
      style:transform={air && air.card === card ? air.transform : transformOf(card)}
      style:z-index={air?.card === card || drag?.key === card ? 300 : (p?.z ?? 0)}
      aria-label={card === 'back' ? t('yourHiddenCard') : nameOf(fromId(card), i18n.lang)}
      aria-disabled={!canPlay || !legal.includes(card)}
      onclick={(e) => key(e, card)}
      use:register={card}
    >
      <Card id={card} />
    </button>
  {/each}
</div>

<style>
  .hand {
    position: relative;
    width: 100%;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .slot {
    position: absolute;
    left: 0;
    top: 0;
    padding: 0;
    border: 0;
    background: none;
    border-radius: 6px;
    transform-origin: 50% 50%;
    transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.2s;
    will-change: transform;
    -webkit-tap-highlight-color: transparent;
    cursor: grab;
  }
  .slot:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 2px;
  }
  .slot.lifted :global(.face) {
    box-shadow: 0 2px 2px rgb(5 8 25 / 0.3), 0 18px 26px -12px rgb(5 8 25 / 0.75);
  }
  /* Not playable now: the paper darkens a little, as if in shadow. */
  .slot.dim {
    filter: brightness(0.74) saturate(0.85);
  }
  .slot.dragging {
    transition: none;
    cursor: grabbing;
  }
  .slot.air {
    transition: transform 0.38s cubic-bezier(0.16, 0.84, 0.26, 1);
    pointer-events: none;
  }
  .slot.shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes shake {
    20%,
    60% {
      translate: -5px 0;
    }
    40%,
    80% {
      translate: 5px 0;
    }
  }
</style>
