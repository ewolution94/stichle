<!--
  The start: who you are (a seal and your name), then a new table, or a table by its code.
-->
<script lang="ts">
  import { api, ApiError, CODE, type Seat } from '../lib/api';
  import type { Avatar } from '../lib/avatar';
  import { errorText, t } from '../lib/i18n.svelte';
  import { saveAvatar, savedAvatar, savedName } from '../lib/session';
  import { newKey, waitAt } from '../lib/waits';
  import { earnedCount } from '../lib/profile.svelte';
  import { ACHIEVEMENTS } from '../lib/achievements';
  import { ui } from '../lib/ui.svelte';
  import AvatarMaker from './AvatarMaker.svelte';

  /** `oncreate` resolves once the new room's lobby can show (its first view): the button waits for that. */
  let {
    oncreate,
    onjoin,
  }: { oncreate: (seat: Seat, name: string, signal: AbortSignal) => Promise<void>; onjoin: (code: string) => void } = $props();

  let name = $state(savedName());
  let avatar: Avatar = $state(savedAvatar());
  let code = $state('');
  let error = $state('');
  /** One key per "New game", kept for its retries (a timed-out first try may have made the room). */
  let key = newKey();

  const cleanCode = $derived(code.trim().toUpperCase());

  function changeAvatar(next: Avatar) {
    avatar = next;
    saveAvatar(next);
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = errorText('name');
      return;
    }
    error = '';
    const who = name.trim();
    try {
      await waitAt(event, async (signal) => oncreate(await api.create(who, avatar, key, signal), who, signal), t('wait_create'));
      key = newKey();
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (CODE.test(cleanCode)) onjoin(cleanCode);
  }
</script>

<div class="home">
  <form class="sheet card" onsubmit={create}>
    <h1 class="display">{t('whoAreYou')}</h1>
    <AvatarMaker {avatar} onchange={changeAvatar} />
    <label class="field">
      <span class="label">{t('yourName')}</span>
      <input class="input" bind:value={name} maxlength="16" autocomplete="nickname" placeholder={t('namePlaceholder')} />
    </label>
    <button class="btn primary block" type="submit">{t('newGame')}</button>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  <form class="join on-cloth" onsubmit={join}>
    <span class="label">{t('joinWithCode')}</span>
    <div class="row">
      <input
        class="input code"
        bind:value={code}
        maxlength="4"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        placeholder={t('codePlaceholder')}
        aria-label={t('code')}
      />
      <button class="btn paper" type="submit" disabled={!CODE.test(cleanCode)}>{t('join')}</button>
    </div>
  </form>

  <button class="btn ghost collection" type="button" onclick={() => (ui.collection = true)}>
    {t('yourCollection')} · {t('earnedOf', { n: earnedCount(), of: ACHIEVEMENTS.length })}
  </button>

  <details class="rules on-cloth">
    <summary class="label">{t('rules')}</summary>
    <p>{t('rulesDeck')}</p>
    <p>{t('rulesRound')}</p>
    <p>{t('rulesPlay')}</p>
    <p>{t('rulesScore')}</p>
  </details>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 440px;
    margin: 14px auto 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 26px 22px 22px;
  }
  h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.1;
    text-align: center;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .join {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    gap: 10px;
  }
  .code {
    flex: 1;
    min-width: 0;
    font-family: var(--ewo-mono);
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .collection {
    align-self: flex-start;
  }
  .rules {
    padding: 0 4px;
  }
  .rules summary {
    cursor: pointer;
    width: fit-content;
  }
  .rules p {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--on-cloth);
  }
</style>
