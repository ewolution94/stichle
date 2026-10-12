<!--
  An achievement's seal: a round wax seal with a scalloped edge and its sign pressed in. Gold once
  earned, a pale imprint until then.
-->
<script lang="ts">
  let { glyph, earned = false, size = 52 }: { glyph: string; earned?: boolean; size?: number } = $props();

  const scallops = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(50 + Math.cos(a) * 44).toFixed(1)},${(50 + Math.sin(a) * 44).toFixed(1)}`;
  });
</script>

<svg class="seal" class:earned viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
  {#each scallops as at (at)}<circle cx={at.split(',')[0]} cy={at.split(',')[1]} r="9" class="edge" />{/each}
  <circle cx="50" cy="50" r="44" class="edge" />
  <circle cx="50" cy="50" r="34" class="ring" />
  <text x="50" y="51" text-anchor="middle" dominant-baseline="central" class="glyph" font-size={glyph.length > 1 ? 30 : 38}>{glyph}</text>
</svg>

<style>
  .seal {
    display: block;
    flex: none;
  }
  .edge {
    fill: #ded6c4;
  }
  .ring {
    fill: none;
    stroke: #c4b99f;
    stroke-width: 2;
  }
  .glyph {
    fill: #a99c80;
    font-family: var(--display);
    font-weight: 800;
  }
  .earned .edge {
    fill: #b8862e;
  }
  .earned .ring {
    stroke: #f3dc94;
  }
  .earned .glyph {
    fill: #fff6d6;
  }
</style>
