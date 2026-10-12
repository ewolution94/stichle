<!--
  A freshly earned achievement, shown for a moment at the top of the screen: its seal stamped in, its
  name, and what it unlocked. One at a time, in the order they came.
-->
<script lang="ts">
  import { ACHIEVEMENTS } from '../lib/achievements';
  import { rewardName, t } from '../lib/i18n.svelte';
  import { fresh } from '../lib/profile.svelte';
  import { play } from '../lib/sound.svelte';
  import Seal from './Seal.svelte';

  const current = $derived(fresh.list[0] ? ACHIEVEMENTS.find((a) => a.id === fresh.list[0])! : null);

  $effect(() => {
    if (!current) return;
    play.made();
    const timer = setTimeout(() => (fresh.list = fresh.list.slice(1)), 4200);
    return () => clearTimeout(timer);
  });
</script>

{#if current}
  {#key current.id}
    <button class="earned" type="button" onclick={() => (fresh.list = fresh.list.slice(1))} aria-live="polite">
      <Seal glyph={current.glyph} earned size={46} />
      <span class="text">
        <span class="label">{t('achievement')}</span>
        <b class="display">{t(`ach_${current.id}`)}</b>
        <small>{t('unlocks', { what: rewardName(current.reward) })}</small>
      </span>
    </button>
  {/key}
{/if}

<style>
  .earned {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + 10px);
    left: 50%;
    z-index: 70;
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(92vw, 380px);
    padding: 10px 16px 10px 10px;
    border: 0;
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink);
    text-align: left;
    box-shadow: 0 0 0 1.5px var(--gold), 0 18px 34px -14px rgb(0 0 0 / 0.75);
    translate: -50% 0;
    animation: stamp 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  @keyframes stamp {
    from {
      translate: -50% -24px;
      scale: 1.12;
      opacity: 0;
    }
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  b {
    font-size: 18px;
  }
  small {
    font-size: 12.5px;
    color: var(--mute);
  }
</style>
