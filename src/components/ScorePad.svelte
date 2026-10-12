<!-- The score pad as a sheet from the table's bar: the table (ScoreTable) and how to read it. -->
<script lang="ts">
  import type { View } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import ScoreTable from './ScoreTable.svelte';

  let { open, view, onclose }: { open: boolean; view: View; onclose: () => void } = $props();

  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });
</script>

<ewo-sheet {open} label={t('scorePad')} oncancel={onclose} onclose={() => ((shown = false), onclose())}>
  <span slot="heading">{t('scorePad')}</span>
  {#if shown && view.game}
    <ScoreTable {view} />
    <p class="key">{t('padKey')}</p>
  {/if}
</ewo-sheet>

<style>
  .key {
    margin: 10px 0 4px;
    font-size: 12px;
    color: var(--mute);
  }
</style>
