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
  import { prefs, setArt } from '../lib/prefs.svelte';
  import type { Art } from '../lib/deck';
  import { play, setSound, sound } from '../lib/sound.svelte';
  import { earnedCount } from '../lib/profile.svelte';
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
      <h3 class="label">Stichle</h3>
      <div class="row">
        <span class="name">{t('yourCollection')}<small>{t('earnedOf', { n: earnedCount(), of: ACHIEVEMENTS.length })}</small></span>
        <button class="btn small" type="button" onclick={() => (onclose(), (ui.collection = true))}>{t('collection')}</button>
      </div>
      <div class="row">
        <span class="name">{t('cardArt')}</span>
        <ewo-segmented stretch value={prefs.art} label={t('cardArt')} onchange={(e) => setArt(e.detail.value as Art)}>
          <option value="figures">{t('art_figures')}</option>
          <option value="classic">{t('art_classic')}</option>
        </ewo-segmented>
      </div>
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
    gap: 12px;
    padding-bottom: 8px;
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
