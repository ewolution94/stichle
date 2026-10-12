<!-- Reactions float up over the table for a moment, with the sender's name. -->
<script lang="ts">
  import type { View } from '../lib/api';
  import type { Room } from '../lib/room.svelte';

  let { room, view }: { room: Room; view: View } = $props();

  let floats: { id: number; emoji: string; x: number; name: string }[] = $state([]);
  let seq = 0;

  $effect(() =>
    room.onReact(({ player, e }) => {
      const emoji = view.reactions[e];
      if (!emoji) return;
      const id = ++seq;
      const name = view.players.find((p) => p.id === player)?.name ?? '';
      floats = [...floats.slice(-12), { id, emoji, x: 8 + Math.random() * 84, name }];
      setTimeout(() => (floats = floats.filter((f) => f.id !== id)), 2600);
    }),
  );
</script>

<div class="floats" aria-hidden="true">
  {#each floats as f (f.id)}
    <span class="float" style="left:{f.x}%"><span class="e">{f.emoji}</span><small>{f.name}</small></span>
  {/each}
</div>

<style>
  .floats {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 5;
  }
  .float {
    position: absolute;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: rise 2.6s ease-out both;
  }
  .e {
    font-size: 30px;
    line-height: 1;
  }
  small {
    padding: 1px 4px;
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink);
    font: 600 10px/1.2 var(--ewo-sans);
  }
  @keyframes rise {
    0% {
      opacity: 0;
      transform: translateY(10px) scale(0.6);
    }
    15% {
      opacity: 1;
      transform: translateY(-20px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-220px) scale(1);
    }
  }
</style>
