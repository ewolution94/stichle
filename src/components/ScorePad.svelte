<!--
  The score pad, like the paper one every Wizard table keeps: a row per round, a column per player,
  each cell the running total with what they bid and took beneath it (green when it was met, red
  when it wasn't). The round being played shows its bids so far.
-->
<script lang="ts">
  import type { View } from '../lib/api';
  import { t } from '../lib/i18n.svelte';
  import Avatar from './Avatar.svelte';

  let { open, view, onclose }: { open: boolean; view: View; onclose: () => void } = $props();

  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });

  const game = $derived(view.game);
  const playerAt = (id: string) => view.players.find((p) => p.id === id);
  /** Running totals after each finished round. */
  const running = $derived.by(() => {
    if (!game) return [];
    const sums = game.seats.map(() => 0);
    return game.pad.map((row) => row.points.map((p, i) => (sums[i] += p)));
  });
</script>

<ewo-sheet {open} label={t('scorePad')} oncancel={onclose} onclose={() => ((shown = false), onclose())}>
  <span slot="heading">{t('scorePad')}</span>
  {#if shown && game}
    <div class="scroll">
      <table style:--cols={game.seats.length}>
        <thead>
          <tr>
            <th scope="col" class="r">#</th>
            {#each game.seats as id (id)}
              {@const p = playerAt(id)}
              <th scope="col">
                {#if p}<Avatar avatar={p.avatar} size={24} />{/if}
                <span class="nm">{id === view.me ? t('you') : (p?.name ?? '?')}</span>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each game.pad as row, ri (row.round)}
            <tr>
              <th scope="row" class="r">{row.round}</th>
              {#each game.seats as _, i (i)}
                {@const met = row.bids[i] === row.won[i]}
                <td>
                  <b class="display">{running[ri][i]}</b>
                  <small class:met class:miss={!met}>{row.bids[i]}·{row.won[i]}</small>
                </td>
              {/each}
            </tr>
          {/each}
          {#if game.phase === 'round'}
            <tr class="now">
              <th scope="row" class="r">{game.round}</th>
              {#each game.seats as _, i (i)}
                <td><small>{game.bids[i] ?? '–'}{game.bids[i] !== null ? `·${game.won[i]}` : ''}</small></td>
              {/each}
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
    <p class="key">{t('padKey')}</p>
  {/if}
</ewo-sheet>

<style>
  .scroll {
    overflow-x: auto;
    margin-inline: -4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 6px 4px;
    border-bottom: 1px solid var(--ewo-line-2);
    text-align: center;
    vertical-align: middle;
  }
  thead th {
    vertical-align: bottom;
    font-weight: 600;
  }
  thead th :global(ewo-emblem) {
    display: block;
    margin: 0 auto 3px;
  }
  .nm {
    display: block;
    overflow: hidden;
    max-width: 64px;
    margin: 0 auto;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .r {
    width: 26px;
    font: 600 12px/1 var(--ewo-mono);
    color: var(--mute);
  }
  td b {
    display: block;
    font-size: 16px;
  }
  td small {
    font: 600 11px/1 var(--ewo-mono);
    color: var(--mute);
  }
  td small.met {
    color: var(--earth);
  }
  td small.miss {
    color: var(--fire);
  }
  tr.now td small {
    color: var(--ink-2);
  }
  .key {
    margin: 10px 0 4px;
    font-size: 12px;
    color: var(--mute);
  }
</style>
