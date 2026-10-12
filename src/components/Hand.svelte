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
  import { i18n } from '../lib/i18n.svelte';
  import Card from './Card.svelte';

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
  let drag = $state<{ card: string; x: number; y: number; r: number } | null>(null);

  const els = new Map<string, HTMLElement>();
  function register(node: HTMLElement, card: string) {
    els.set(card, node);
    return { destroy: () => els.delete(card) };
  }

  // A selected card that left the hand (played, by you or the bot) is no longer selected.
  $effect(() => {
    if (sel && !cards.includes(sel)) sel = null;
  });
  // Landed, and the server's hand no longer has it: from now on it's the trick's to draw.
  $effect(() => {
    if (air?.landed && !cards.includes(air.card)) air = null;
  });
  /** Drawn in a steady order, so the card in the air keeps its element (and its transition). */
  const list = $derived(air && !cards.includes(air.card) ? [...cards, air.card] : cards);

  const fan = $derived(cards.filter((c) => c !== air?.card));
  // Few cards are held bigger; a full hand shrinks to fit, never below 62 px.
  // On a laptop's wider table they may grow a little more.
  const cap = $derived(width > 600 ? [124, 112, 100] : [104, 92, 84]);
  const cw = $derived(Math.round(Math.max(62, Math.min(cards.length <= 3 ? cap[0] : cards.length <= 6 ? cap[1] : cap[2], width / (cards.length * 0.62 + 0.6)))));
  const ch = $derived(Math.round(cw * 1.4));
  const rows = $derived(fan.length > 1 && (width - 8 - cw) / (fan.length - 1) < 24 ? 2 : 1);
  const height = $derived(rows === 2 ? Math.round(ch * 1.45) + 30 : ch + 30);

  /** Each card's place in the fan: x, y (top left), turn, and which is on top. */
  const places = $derived.by(() => {
    const out = new Map<string, { x: number; y: number; r: number; z: number }>();
    const split = rows === 2 ? Math.ceil(fan.length / 2) : fan.length;
    const parts = rows === 2 ? [fan.slice(0, split), fan.slice(split)] : [fan];
    parts.forEach((row, ri) => {
      const m = row.length;
      const step = m > 1 ? Math.min(cw * 0.62, (width - 8 - cw) / (m - 1)) : 0;
      const x0 = (width - (cw + step * (m - 1))) / 2;
      const front = ri === parts.length - 1;
      const baseY = height - ch - 8 - (front ? 0 : Math.round(ch * 0.45));
      row.forEach((card, i) => {
        const t = m > 1 ? (i - (m - 1) / 2) / ((m - 1) / 2) : 0;
        out.set(card, { x: x0 + i * step, y: baseY + t * t * 8, r: t * 7, z: (front ? 100 : 0) + i + 1 });
      });
    });
    return out;
  });

  function transformOf(card: string) {
    if (drag?.card === card) return `translate(${drag.x}px, ${drag.y}px) rotate(${drag.r}deg) scale(1.12)`;
    const p = places.get(card);
    if (!p) return '';
    const up = card === sel ? 24 : 0;
    return `translate(${p.x.toFixed(1)}px, ${(p.y - up).toFixed(1)}px) rotate(${p.r.toFixed(2)}deg) scale(${card === sel ? 1.05 : 1})`;
  }

  // ---- finding the card under a finger -------------------------------------------------------

  function local(e: PointerEvent) {
    const r = box!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function at(x: number, y: number): string | null {
    let best: string | null = null;
    let bestZ = -1;
    for (const [card, p] of places) {
      const top = p.y - (card === sel ? 24 : 0);
      if (x >= p.x && x <= p.x + cw && y >= top - 6 && y <= p.y + ch && p.z > bestZ) {
        best = card;
        bestZ = p.z;
      }
    }
    if (best) return best;
    // Below or beside the fan: the nearest card along the row the finger is level with.
    let near: string | null = null;
    let dist = Infinity;
    for (const [card, p] of places) {
      const d = Math.abs(x - (p.x + cw / 2)) + Math.abs(y - (p.y + ch / 2)) * 0.3;
      if (d < dist) {
        dist = d;
        near = card;
      }
    }
    return near;
  }

  // ---- the gesture ---------------------------------------------------------------------------

  let down: { x: number; y: number; card: string | null; was: string | null; moved: boolean; refused: boolean } | null = null;
  let flick = { x: 0, y: 0, t: 0, vx: 0, vy: 0, ox: 0, oy: 0 };
  let press = 0;

  function pointerdown(e: PointerEvent) {
    if (!box || air || !fan.length || e.button > 0) return;
    box.setPointerCapture(e.pointerId);
    const p = local(e);
    const card = at(p.x, p.y);
    down = { x: p.x, y: p.y, card, was: sel, moved: false, refused: false };
    if (card) sel = card;
    clearTimeout(press);
    press = window.setTimeout(() => {
      if (down && !down.moved && !drag && down.card) {
        const card = down.card;
        down = null;
        oninspect(card);
      }
    }, 480);
  }

  function pointermove(e: PointerEvent) {
    if (!down) return;
    const p = local(e);
    const now = performance.now();
    if (drag) {
      const dt = Math.max(1, now - flick.t);
      flick.vx = flick.vx * 0.6 + ((p.x - flick.x) / dt) * 0.4;
      flick.vy = flick.vy * 0.6 + ((p.y - flick.y) / dt) * 0.4;
      flick = { ...flick, x: p.x, y: p.y, t: now };
      drag = { card: drag.card, x: p.x - flick.ox, y: p.y - flick.oy, r: Math.max(-18, Math.min(18, flick.vx * 22)) };
      return;
    }
    if (Math.hypot(p.x - down.x, p.y - down.y) > 7) {
      down.moved = true;
      clearTimeout(press);
    }
    if (sel && down.y - p.y > 22) {
      if (canPlay && legal.includes(sel)) {
        const pl = places.get(sel)!;
        flick = { x: p.x, y: p.y, t: now, vx: 0, vy: 0, ox: p.x - pl.x, oy: p.y - (pl.y - 24) };
        drag = { card: sel, x: pl.x, y: pl.y - 24, r: pl.r };
      } else if (canPlay && !down.refused) {
        down.refused = true;
        refuse(sel);
      }
      return;
    }
    const card = at(p.x, p.y);
    if (card && card !== sel) sel = card;
  }

  function pointerup() {
    clearTimeout(press);
    if (drag) {
      const card = drag.card;
      const gone = drag.y + ch / 2 < 0 || flick.vy < -0.5;
      if (gone) void send(card);
      drag = null;
    } else if (down && down.card && !down.moved && down.card === down.was) {
      tryPlay(down.card);
    }
    down = null;
  }

  function pointercancel() {
    clearTimeout(press);
    drag = null;
    down = null;
  }

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
      const r = box.getBoundingClientRect();
      const scale = to.width / cw;
      air = { card, landed: false, transform: `translate(${(to.x - r.left - cw / 2).toFixed(1)}px, ${(to.y - r.top - ch / 2).toFixed(1)}px) rotate(${to.rot}deg) scale(${scale.toFixed(3)})` };
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
    // Taps arrive as pointer events above; this is Enter or Space on a focused card.
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
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={pointercancel}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#each list as card (card)}
    {@const p = places.get(card)}
    <button
      type="button"
      class="slot"
      class:lifted={card === sel}
      class:dim={canPlay && !legal.includes(card)}
      class:dragging={drag?.card === card}
      class:air={air?.card === card}
      class:shake={shaking === card}
      style:width="{cw}px"
      style:transform={air && air.card === card ? air.transform : transformOf(card)}
      style:z-index={air?.card === card || drag?.card === card ? 300 : (p?.z ?? 0)}
      aria-label={nameOf(fromId(card), i18n.lang)}
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
