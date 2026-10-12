<!--
  One card from the deck (src/lib/deck.ts), as the page draws it: inline SVG, so its foil can move
  with a tilt and its words follow the language. `id` is the server's card id; none (or `back`) draws
  the back. The paper grain sits on top (main.ts makes it once).
-->
<script lang="ts">
  import type { BackId } from '../lib/achievements';
  import { card, fromId } from '../lib/deck';
  import { i18n } from '../lib/i18n.svelte';
  import { prefs } from '../lib/prefs.svelte';
  import { profile } from '../lib/profile.svelte';
  import { nextUid } from '../lib/table';

  let {
    id = null,
    back = false,
    glare = false,
    previewBack = null,
  }: { id?: string | null; back?: boolean; glare?: boolean; previewBack?: BackId | null } = $props();

  const uid = nextUid();
  const svg = $derived(card(back ? { k: 'back' } : fromId(id), { lang: i18n.lang, uid, art: prefs.art, back: previewBack ?? profile.look.back }));
</script>

<div class="face">
  {@html svg}
  {#if glare}<div class="glare"></div>{/if}
</div>

<style>
  .face {
    position: relative;
    width: 100%;
    aspect-ratio: 5 / 7;
    border-radius: 5.6% / 4%;
    overflow: hidden;
    box-shadow: 0 1px 1px rgb(5 8 25 / 0.3), 0 8px 16px -8px rgb(5 8 25 / 0.6);
    -webkit-user-select: none;
    user-select: none;
  }
  /* Gilded edges (R2's unlockable): a fine gold line round every card. */
  :global(:root[data-edge='gold']) .face {
    box-shadow: 0 0 0 1.4px #d4a94c, 0 0 0 2.2px rgb(80 55 15 / 0.5), 0 8px 16px -8px rgb(5 8 25 / 0.6);
  }
  .face :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .face::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--grain);
    background-size: 160px;
    mix-blend-mode: multiply;
    opacity: 0.5;
    pointer-events: none;
  }
  .glare {
    position: absolute;
    left: -50%;
    top: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.65), rgb(255 255 255 / 0) 30%);
    mix-blend-mode: soft-light;
    opacity: 0;
    pointer-events: none;
    will-change: transform, opacity;
  }
</style>
