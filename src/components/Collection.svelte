<!--
  Your collection (R2): your record on this device, the twelve achievements as seals (earned in gold,
  the rest as pale imprints with how far you've got), and the looks they unlock: the table, the cards'
  backs and their edges. A code carries it all to another device. Opened from Settings and from the
  start page.
-->
<script lang="ts">
  import { ACHIEVEMENTS, progress, unlocked, unlockedBy, type BackId, type TableId } from '../lib/achievements';
  import { rewardName, t } from '../lib/i18n.svelte';
  import { choose, exportCode, importCode, profile } from '../lib/profile.svelte';
  import { ui } from '../lib/ui.svelte';
  import Card from './Card.svelte';
  import Seal from './Seal.svelte';

  const BACKS: BackId[] = ['ultramarin', 'bordeaux', 'waldgruen', 'nacht', 'silber', 'kupfer', 'gold'];
  const TABLES: TableId[] = ['spieltisch', 'burgtafel', 'pergament', 'millefleurs', 'karmesin', 'nachtblau'];

  let shown = $state(false);
  $effect(() => {
    if (ui.collection) shown = true;
  });

  const metShare = $derived(profile.rounds ? Math.round((profile.met / profile.rounds) * 100) : 0);
  const lockedBy = (kind: 'back' | 'table' | 'edge', id: string) => {
    const a = unlockedBy(kind, id);
    return a ? t('lockedBy', { name: t(`ach_${a.id}`) }) : '';
  };

  let copied = $state(false);
  let paste = $state('');
  let message = $state('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(exportCode());
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      paste = exportCode();
    }
  }
  function load(e: SubmitEvent) {
    e.preventDefault();
    message = importCode(paste) ? t('codeLoaded') : t('codeBad');
    if (message === t('codeLoaded')) paste = '';
  }
</script>

<ewo-sheet open={ui.collection} label={t('collection')} oncancel={() => (ui.collection = false)} onclose={() => ((shown = false), (ui.collection = false))}>
  <span slot="heading">{t('collection')}</span>
  {#if shown}
    <div class="body">
      <dl class="stats">
        <div><dt>{t('statsGames')}</dt><dd class="display">{profile.games}</dd></div>
        <div><dt>{t('statsWins')}</dt><dd class="display">{profile.wins}</dd></div>
        <div><dt>{t('statsRounds')}</dt><dd class="display">{profile.rounds}</dd></div>
        <div><dt>{t('statsMet')}</dt><dd class="display">{metShare}%</dd></div>
        <div><dt>{t('statsStreak')}</dt><dd class="display">{profile.bestStreak}</dd></div>
      </dl>

      <section>
        <h3 class="label">{t('achievements')}</h3>
        <ul class="achievements">
          {#each ACHIEVEMENTS as a (a.id)}
            {@const earned = Boolean(profile.earned[a.id])}
            <li class:earned>
              <Seal glyph={a.glyph} {earned} size={46} />
              <span class="what">
                <b>{t(`ach_${a.id}`)}</b>
                <small>{t(`achDesc_${a.id}`)}{#if a.goal && !earned} · {progress(profile, a.id)}/{a.goal}{/if}</small>
                <small class="reward">{t('unlocks', { what: rewardName(a.reward) })}</small>
              </span>
            </li>
          {/each}
        </ul>
      </section>

      <section>
        <h3 class="label">{t('look')}</h3>
        <span class="sub">{t('lookTable')}</span>
        <div class="tables" role="radiogroup" aria-label={t('lookTable')}>
          {#each TABLES as table (table)}
            {@const open = unlocked(profile, 'table', table)}
            <button
              type="button"
              role="radio"
              class="table"
              aria-checked={profile.look.table === table}
              disabled={!open}
              title={open ? t(`look_${table}`) : lockedBy('table', table)}
              onclick={() => choose('table', table)}
            >
              <span class="mini-table" class:locked={!open}>
                <span class="board" data-table={table}><span class="felt" data-table={table}></span></span>
                {#if !open}<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{/if}
              </span>
              <small>{t(`look_${table}`)}</small>
              {#if !open}<small class="how">{lockedBy('table', table)}</small>{/if}
            </button>
          {/each}
        </div>
        <span class="sub">{t('lookBack')}</span>
        <div class="backs" role="radiogroup" aria-label={t('lookBack')}>
          {#each BACKS as back (back)}
            {@const open = unlocked(profile, 'back', back)}
            <button
              type="button"
              role="radio"
              class="back"
              aria-checked={profile.look.back === back}
              disabled={!open}
              title={open ? t(`look_${back}`) : lockedBy('back', back)}
              onclick={() => choose('back', back)}
            >
              <span class="mini" class:locked={!open}>
                <Card back previewBack={back} />
                {#if !open}<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{/if}
              </span>
              <small>{t(`look_${back}`)}</small>
            </button>
          {/each}
        </div>
        <span class="sub">{t('lookEdge')}</span>
        <div class="pair">
          {#each ['plain', 'gold'] as edge (edge)}
            {@const open = unlocked(profile, 'edge', edge)}
            <button type="button" class="chip" aria-pressed={profile.look.edge === edge} disabled={!open} title={open ? '' : lockedBy('edge', edge)} onclick={() => choose('edge', edge)}>
              {t(`look_${edge as 'plain' | 'gold'}`)}
            </button>
          {/each}
        </div>
      </section>

      <section>
        <h3 class="label">{t('transfer')}</h3>
        <p class="hint">{t('transferHint')}</p>
        <button class="btn small" type="button" onclick={copy}>{copied ? t('codeCopied') : t('copyCode')}</button>
        <form class="load" onsubmit={load}>
          <input class="input" bind:value={paste} placeholder={t('pasteCode')} aria-label={t('pasteCode')} autocomplete="off" spellcheck="false" />
          <button class="btn small" type="submit" disabled={!paste.trim()}>{t('loadCode')}</button>
        </form>
        {#if message}<p class="hint" role="status">{message}</p>{/if}
      </section>
    </div>
  {/if}
</ewo-sheet>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 12px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
  }
  .stats div {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 2px;
    padding: 8px 2px;
    border-radius: 10px;
    background: var(--paper-2);
  }
  .stats dt {
    font: 600 10px/1.2 var(--ewo-sans);
    letter-spacing: 0.04em;
    color: var(--mute);
    text-align: center;
  }
  .stats dd {
    margin: 0;
    font-size: 22px;
    line-height: 1;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    margin: 0;
  }
  .achievements {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .achievements li {
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.72;
  }
  .achievements li.earned {
    opacity: 1;
  }
  .what {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .what b {
    font: 700 15px/1.2 var(--display);
  }
  .what small {
    font-size: 12px;
    color: var(--mute);
  }
  .what .reward {
    color: var(--gold-lo);
  }
  .sub {
    font: 600 12px/1 var(--ewo-sans);
    color: var(--ink-2);
  }
  .backs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .tables {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 12px 10px;
  }
  .table,
  .back {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
  }
  /* A table in small: its room round it, its rail and its cloth (src/app.css → .board). */
  .mini-table {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.25);
  }
  /* Locked: still in its colours (it's what you're playing for), a little dimmed, a lock in the corner. */
  .mini-table.locked .board,
  .mini.locked > :global(:not(.lock)) {
    filter: brightness(0.7) saturate(0.85);
  }
  .lock {
    position: absolute;
    right: 5px;
    bottom: 5px;
    width: 13px;
    height: 13px;
    padding: 4px;
    border-radius: 50%;
    background: var(--paper);
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    box-sizing: content-box;
  }
  .mini .lock {
    right: 2px;
    bottom: 2px;
    width: 9px;
    height: 9px;
    padding: 3px;
  }
  .table[aria-checked='true'] .mini-table,
  .back[aria-checked='true'] .mini {
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--gold);
  }
  .table small,
  .back small {
    font-size: 11px;
    color: var(--mute);
  }
  .table small:first-of-type {
    color: var(--ink);
    font-weight: 600;
  }
  .table .how {
    margin-top: -3px;
    text-align: center;
    line-height: 1.25;
  }
  .table:disabled,
  .back:disabled {
    cursor: default;
  }

  .mini {
    position: relative;
    display: block;
    width: 40px;
    border-radius: 4px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--mute);
  }
  .load {
    display: flex;
    gap: 8px;
  }
  .load .input {
    flex: 1;
    min-width: 0;
    font-family: var(--ewo-mono);
    font-size: 16px;
  }
</style>
