<!--
  Your collection (R2), in three tabs so each has room (the user, 2026-10-13: "too crammed"): the
  twelve achievements as seals (earned in gold, the rest as pale imprints with how far you've got);
  the looks they unlock (the table, the cards' backs, their edges); and your record on this device,
  with the code that carries it all to another. Opened from Settings and from the start page.
-->
<script lang="ts">
  import { ACHIEVEMENTS, progress, unlocked, unlockedBy, type BackId, type TableId } from '../lib/achievements';
  import { rewardName, t } from '../lib/i18n.svelte';
  import { choose, earnedCount, exportCode, importCode, profile } from '../lib/profile.svelte';
  import { ui } from '../lib/ui.svelte';
  import Card from './Card.svelte';
  import Seal from './Seal.svelte';

  const BACKS: BackId[] = ['ultramarin', 'bordeaux', 'waldgruen', 'nacht', 'silber', 'kupfer', 'gold'];
  const TABLES: TableId[] = ['spieltisch', 'burgtafel', 'pergament', 'millefleurs', 'karmesin', 'nachtblau'];

  type Tab = 'achievements' | 'look' | 'record';
  let tab: Tab = $state('achievements');
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
      <ewo-segmented stretch value={tab} label={t('collection')} onchange={(e) => (tab = e.detail.value as Tab)}>
        <option value="achievements">{t('achievements')}</option>
        <option value="look">{t('look')}</option>
        <option value="record">{t('record')}</option>
      </ewo-segmented>

      {#if tab === 'achievements'}
        <section>
          <p class="hint">{t('achievementsHint', { n: earnedCount(), of: ACHIEVEMENTS.length })}</p>
          <ul class="achievements">
            {#each ACHIEVEMENTS as a (a.id)}
              {@const earned = Boolean(profile.earned[a.id])}
              <li class:earned>
                <Seal glyph={a.glyph} {earned} size={46} />
                <span class="what">
                  <b>{t(`ach_${a.id}`)}</b>
                  <small>{t(`achDesc_${a.id}`)}</small>
                  {#if a.goal && !earned}
                    <small class="progress"><span class="bar"><i style:width="{(progress(profile, a.id) / a.goal) * 100}%"></i></span>{progress(profile, a.id)}/{a.goal}</small>
                  {/if}
                  <small class="reward">{t('unlocks', { what: rewardName(a.reward) })}</small>
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {:else if tab === 'look'}
        <p class="hint">{t('lookHint')}</p>
        <section>
          <h3 class="label">{t('lookTable')}</h3>
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
                  {#if profile.look.table === table}<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5 10 16.5 18 8" /></svg>{/if}
                  {#if !open}<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{/if}
                </span>
                <small>{t(`look_${table}`)}</small>
                {#if !open}<small class="how">{lockedBy('table', table)}</small>{/if}
              </button>
            {/each}
          </div>
        </section>
        <section>
          <h3 class="label">{t('lookBack')}</h3>
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
                  {#if profile.look.back === back}<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5 10 16.5 18 8" /></svg>{/if}
                  {#if !open}<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{/if}
                </span>
                <small>{t(`look_${back}`)}</small>
              </button>
            {/each}
          </div>
        </section>
        <section>
          <h3 class="label">{t('lookEdge')}</h3>
          <div class="pair">
            {#each ['plain', 'gold'] as edge (edge)}
              {@const open = unlocked(profile, 'edge', edge)}
              <button type="button" class="chip" aria-pressed={profile.look.edge === edge} disabled={!open} title={open ? '' : lockedBy('edge', edge)} onclick={() => choose('edge', edge)}>
                {t(`look_${edge as 'plain' | 'gold'}`)}
              </button>
            {/each}
          </div>
        </section>
      {:else}
        <section>
          <dl class="stats">
            <div><dt>{t('statsGames')}</dt><dd class="display">{profile.games}</dd></div>
            <div><dt>{t('statsWins')}</dt><dd class="display">{profile.wins}</dd></div>
            <div><dt>{t('statsRounds')}</dt><dd class="display">{profile.rounds}</dd></div>
            <div><dt>{t('statsMet')}</dt><dd class="display">{metShare}%</dd></div>
            <div><dt>{t('statsStreak')}</dt><dd class="display">{profile.bestStreak}</dd></div>
          </dl>
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
      {/if}
    </div>
  {/if}
</ewo-sheet>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 12px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    margin: 0;
  }
  .stats div {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 6px;
    padding: 14px 6px 12px;
    border-radius: 12px;
    background: var(--paper-2);
  }
  .stats dt {
    font: 600 11px/1.2 var(--ewo-sans);
    letter-spacing: 0.04em;
    color: var(--mute);
    text-align: center;
  }
  .stats dd {
    margin: 0;
    font-size: 30px;
    line-height: 1;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  /* Parts of one tab: a hairline and some air between them. */
  section + section {
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  h3 {
    margin: 0;
  }
  .achievements {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0 18px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .achievements li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgb(28 26 34 / 0.08);
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
  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 0;
    font-family: var(--ewo-mono);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    position: relative;
    width: 96px;
    height: 4px;
    border-radius: 2px;
    background: rgb(28 26 34 / 0.12);
    overflow: hidden;
  }
  .bar i {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: var(--gold);
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
  /* The one in use: a broad gold ring with a glow, a gold tick in its corner, its name in gold (the
     user, 2026-10-15: the thin ring was too easy to miss). */
  .table[aria-checked='true'] .mini-table,
  .back[aria-checked='true'] .mini {
    box-shadow:
      0 0 0 2px var(--paper),
      0 0 0 5px var(--gold),
      0 8px 18px -6px rgb(176 138 58 / 0.75);
  }
  .table[aria-checked='true'] small:first-of-type,
  .back[aria-checked='true'] small {
    color: var(--gold-lo);
    font-weight: 700;
  }
  .tick {
    position: absolute;
    z-index: 2;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 0 2px var(--paper);
    fill: none;
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mini .tick {
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
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
