<!--
  Settings, the family's way (plans/settings-alignment.md): Folio's ewo-sheet, opened from the
  bar's ewo-settings-button, with General first. Stichle is light only (plans/stichle.md), so General
  is the language alone; the game's own settings live in the lobby, with the host.

  During a game (`room` given) it opens with "This game" first: the host can end it for everyone,
  anyone can leave, each after a second tap that says what it does (development/plans/end-game.md).
-->
<script lang="ts">
  import { themeShift } from '../../vendor/ewo/elements/theme-shift.js';
  import { ApiError } from '../lib/api';
  import { errorText, i18n, setLanguage, systemLang, t, type LangChoice } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { prefs, setArt, setHand, type HandLayout } from '../lib/prefs.svelte';
  import type { Art } from '../lib/deck';
  import { play, setSound, sound } from '../lib/sound.svelte';
  import { earnedCount, profile } from '../lib/profile.svelte';
  import Seal from './Seal.svelte';
  import { ACHIEVEMENTS } from '../lib/achievements';
  import { ui } from '../lib/ui.svelte';
  import { actAt } from '../lib/waits';

  let {
    open,
    onclose,
    room = null,
    onleave,
  }: { open: boolean; onclose: () => void; room?: Room | null; onleave?: (from: Event) => Promise<void> } = $props();

  const view = $derived(room?.view ?? null);
    const isHost = $derived(Boolean(view && view.me === view.host));
  const hostName = $derived(view?.players.find((p) => p.id === view.host)?.name ?? '');
  /** Which of the two waits for its second tap. */
  let sure: 'end' | 'leave' | null = $state(null);
  let error = $state('');
  $effect(() => {
    if (!open) {
      sure = null;
      error = '';
    }
  });

  async function end(from: Event) {
    error = '';
    try {
      await actAt(room!, 'stop', undefined, from);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  async function leave(from: Event) {
    error = '';
    try {
      await onleave?.(from);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  // The content stays until the sheet's exit animation is over (its close event), or the sheet
  // slides out as a header-only box.
  let shown = $state(false);
  $effect(() => {
    if (open) shown = true;
  });
  function closed() {
    shown = false;
    onclose();
  }

  /**
   * The picked control updates at once; the page changes under themeShift's veil when it really
   * changes, and at once when it doesn't (System while the system already shows that language).
   */
  function pickLanguage(next: LangChoice) {
    if (next === i18n.choice) return;
    const shows = next === 'system' ? systemLang() : next;
    if (shows === i18n.lang) setLanguage(next);
    else themeShift(() => setLanguage(next));
  }

  // Whether this is the desktop table (Table.svelte → DESK): only there is the hand's layout a choice.
  let desk = $state(typeof matchMedia === 'function' && matchMedia('(min-width: 1100px) and (min-height: 740px)').matches);
  $effect(() => {
    const mq = matchMedia('(min-width: 1100px) and (min-height: 740px)');
    const on = () => (desk = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
</script>

<ewo-sheet {open} label={t('settings')} oncancel={onclose} onclose={closed}>
  <span slot="heading">{t('settings')}</span>
  {#if shown}
    {#if room && view?.phase === 'play'}
      <section class="game">
        <h3 class="label">{t('thisGame')}</h3>
        {#if sure === 'end'}
          <p class="sure">{t('endSure')}</p>
          <div class="pair">
            <button class="btn danger-fill" type="button" onclick={end}>{t('endYes')}</button>
            <button class="btn" type="button" onclick={() => (sure = null)}>{t('keepPlaying')}</button>
          </div>
        {:else if sure === 'leave'}
          <p class="sure">{isHost ? t('leaveSureHost') : t('leaveSure')}</p>
          <div class="pair">
            <button class="btn danger-fill" type="button" onclick={leave}>{t('leaveYes')}</button>
            <button class="btn" type="button" onclick={() => (sure = null)}>{t('keepPlaying')}</button>
          </div>
        {:else}
          <div class="pair">
            {#if isHost}
              <button class="btn" type="button" onclick={() => (sure = 'end')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                {t('stopGame')}
              </button>
            {/if}
            <button class="btn quiet" type="button" onclick={() => (sure = 'leave')}>{t('leaveGame')}</button>
          </div>
          {#if !isHost}<p class="hint">{t('endHint', { name: hostName })}</p>{/if}
        {/if}
        {#if error}<p class="error" role="alert">{error}</p>{/if}
      </section>
    {/if}
    <!-- Your collection: its own panel, apart from the settings (the user, 2026-10-13). -->
    <button class="collection" type="button" onclick={() => (onclose(), (ui.collection = true))}>
      <span class="seals" aria-hidden="true">
        {#each ACHIEVEMENTS.slice(0, 3) as a (a.id)}<Seal glyph={a.glyph} earned={Boolean(profile.earned[a.id])} size={34} />{/each}
      </span>
      <span class="name"><b>{t('yourCollection')}</b><small>{t('earnedOf', { n: earnedCount(), of: ACHIEVEMENTS.length })}</small></span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
    <button class="collection guide" type="button" onclick={() => (onclose(), (ui.guide = true))}>
      <svg class="book" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M10 9h4M10 13h4" /></svg>
      <span class="name"><b>{t('guide')}</b><small>{t('guideOpen')}</small></span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
    <section>
      <h3 class="label">{t('general')}</h3>
      <div class="row">
        <span class="name">{t('language')}</span>
        <ewo-segmented stretch value={i18n.choice} label={t('language')} onchange={(e) => pickLanguage(e.detail.value as LangChoice)}>
          <option value="system">{t('langSystem')}</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </ewo-segmented>
      </div>
    </section>
    <section>
      <h3 class="label">{t('cardsAndSound')}</h3>
      <div class="row">
        <span class="name">{t('cardArt')}</span>
        <ewo-segmented stretch value={prefs.art} label={t('cardArt')} onchange={(e) => setArt(e.detail.value as Art)}>
          <option value="figures">{t('art_figures')}</option>
          <option value="classic">{t('art_classic')}</option>
        </ewo-segmented>
      </div>
      {#if desk}
        <!-- The desktop table only (the user, 2026-10-14): the hand laid out flat, or the phone's fan. -->
        <div class="row">
          <span class="name">{t('handLayout')}</span>
          <ewo-segmented stretch value={prefs.hand} label={t('handLayout')} onchange={(e) => setHand(e.detail.value as HandLayout)}>
            <option value="flat">{t('hand_flat')}</option>
            <option value="fan">{t('hand_fan')}</option>
          </ewo-segmented>
        </div>
      {/if}
      <div class="row">
        <span class="name">{t('soundsHint')}</span>
        <ewo-switch
          checked={sound.on}
          aria-label={t('sounds')}
          onchange={(e) => {
            setSound(e.detail.checked);
            if (e.detail.checked) play.won();
          }}
        ></ewo-switch>
      </div>
    </section>
  {/if}
</ewo-sheet>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 8px;
  }
  /* The parts apart: a hairline and some air between them. */
  section + section {
    padding-top: 20px;
    border-top: 1px solid var(--line);
  }
  .collection {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    margin-bottom: 20px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--paper-2);
    color: var(--ink);
    text-align: left;
    -webkit-tap-highlight-color: transparent;
  }
  .collection.guide {
    margin-top: -10px;
  }
  .book {
    flex: none;
    width: 34px;
    height: 34px;
    padding: 6px;
    border-radius: 50%;
    background: var(--paper);
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linecap: round;
    box-shadow: 0 0 0 1px var(--line);
  }
  .collection .seals {
    display: flex;
    flex: none;
  }
  .collection .seals > :global(* + *) {
    margin-left: -10px;
  }
  .collection .name {
    flex: 1;
    min-width: 0;
  }
  .collection b {
    font: 700 16px/1.2 var(--display);
  }
  .chev {
    flex: none;
    width: 20px;
    height: 20px;
    fill: none;
    stroke: var(--mute);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (hover: hover) {
    .collection:hover {
      background: #ece6d8;
    }
  }
  h3 {
    margin: 0;
  }
  .game {
    padding-bottom: 16px;
    margin-bottom: 4px;
    border-bottom: 1.5px solid var(--line);
  }
  .game svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--mute);
  }
  .error {
    margin: 0;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 14px;
  }
  .name small {
    font-size: 12px;
    color: var(--mute);
  }
  ewo-segmented {
    flex: none;
    width: min(300px, 62%);
  }
  @media (max-width: 480px) {
    .row:has(ewo-segmented) {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    ewo-segmented {
      width: 100%;
    }
  }
</style>
