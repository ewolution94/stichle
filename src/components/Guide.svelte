<!--
  How to play, as full-screen pages (the user, 2026-10-13: "the classic full-screen tutorials with the
  nav pills at the bottom"): Folio's <ewo-guide> brings the frame (swipe, the dots, Back and Next,
  Done), these are Stichle's pages, each drawn with the game's own cards. Opens once on a device's
  first visit (Home), and from the start page and Settings.
-->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import { ui } from '../lib/ui.svelte';
  import Card from './Card.svelte';
  import Seal from './Seal.svelte';

  // The pages are drawn the first time it opens, and kept: the exit animation needs them.
  let shown = $state(false);
  $effect(() => {
    if (ui.guide) shown = true;
  });
  const close = () => (ui.guide = false);
</script>

<ewo-guide
  open={ui.guide}
  label={t('guideOpen')}
  next-label={t('guideNext')}
  back-label={t('guideBack')}
  skip-label={t('guideSkip')}
  done-label={t('guideDone')}
  oncancel={close}
  onclose={close}
>
  {#if shown}
    <section class="page">
      <div class="art goal" aria-hidden="true">
        <span class="c" style="--x:-58px;--r:-12deg"><Card id="water-7" /></span>
        <span class="c" style="--x:0px;--y:-10px;--r:0deg"><Card id="z-fire" /></span>
        <span class="c" style="--x:58px;--r:12deg"><Card id="earth-12" /></span>
        <span class="bid display">2</span>
      </div>
      <h2 class="display">{t('guide1Title')}</h2>
      <p>{t('guide1Text')}</p>
    </section>

    <section class="page">
      <div class="art deck" aria-hidden="true">
        {#each ['fire-13', 'water-1', 'earth-7', 'air-11', 'z-water', 'n-earth'] as id, i (id)}
          <span class="c small" style="--x:{(i - 2.5) * 40}px;--y:{Math.abs(i - 2.5) * 6}px;--r:{(i - 2.5) * 7}deg"><Card {id} /></span>
        {/each}
      </div>
      <h2 class="display">{t('guide2Title')}</h2>
      <p>{t('guide2Text')}</p>
    </section>

    <section class="page">
      <div class="art trump" aria-hidden="true">
        {#each [0, 1, 2] as i (i)}
          <span class="c small" style="--x:{-52 + i * 3}px;--y:{-i * 3}px;--r:-4deg"><Card back /></span>
        {/each}
        <span class="c small" style="--x:44px;--y:4px;--r:8deg"><Card id="air-9" /></span>
        <span class="tag"><span class="suit air"></span>{t('guideTrump')}</span>
      </div>
      <h2 class="display">{t('guide3Title')}</h2>
      <p>{t('guide3Text')}</p>
    </section>

    <section class="page">
      <div class="art dial sheet" aria-hidden="true">
        <span class="step">−</span>
        <span class="value"><b class="display">2</b></span>
        <span class="step">+</span>
      </div>
      <h2 class="display">{t('guide4Title')}</h2>
      <p>{t('guide4Text')}</p>
    </section>

    <section class="page">
      <div class="art trick" aria-hidden="true">
        <span class="c small" style="--x:-40px;--y:-6px;--r:-11deg"><Card id="fire-9" /></span>
        <span class="c small" style="--x:36px;--y:-12px;--r:9deg"><Card id="fire-12" /></span>
        <span class="c small win" style="--x:0px;--y:14px;--r:-3deg"><Card id="water-3" /></span>
        <span class="tag"><span class="suit water"></span>{t('guideTrump')}</span>
      </div>
      <h2 class="display">{t('guide5Title')}</h2>
      <p>{t('guide5Text')}</p>
    </section>

    <section class="page">
      <div class="art pair" aria-hidden="true">
        <span class="c win" style="--x:-50px;--r:-6deg"><Card id="z-fire" /></span>
        <span class="c dim" style="--x:50px;--r:6deg"><Card id="n-air" /></span>
      </div>
      <h2 class="display">{t('guide6Title')}</h2>
      <p>{t('guide6Text')}</p>
    </section>

    <section class="page">
      <div class="art trick" aria-hidden="true">
        <span class="c small win" style="--x:-44px;--y:-8px;--r:-10deg"><Card id="dragon" /></span>
        <span class="c small" style="--x:0px;--y:10px;--r:2deg"><Card id="fairy" /></span>
        <span class="c small" style="--x:44px;--y:-8px;--r:10deg"><Card id="thief" /></span>
      </div>
      <h2 class="display">{t('guideSpecialsTitle')}</h2>
      <p>{t('guideSpecialsText')}</p>
    </section>

    <section class="page">
      <div class="art pad sheet" aria-hidden="true">
        <span class="row"><span>{t('guideBid')} 2 · 2 {t('guideTook')}</span><b class="display good">+40</b></span>
        <span class="row"><span>{t('guideBid')} 1 · 3 {t('guideTook')}</span><b class="display bad">−20</b></span>
        <span class="row"><span>{t('guideBid')} 0 · 0 {t('guideTook')}</span><b class="display good">+20</b></span>
      </div>
      <h2 class="display">{t('guide7Title')}</h2>
      <p>{t('guide7Text')}</p>
    </section>

    <section class="page">
      <div class="art hand" aria-hidden="true">
        {#each ['earth-2', 'fire-8', 'air-13', 'water-10', 'n-fire'] as id, i (id)}
          <span class="c small" class:up={i === 2} style="--x:{(i - 2) * 38}px;--y:{Math.abs(i - 2) * 6 + (i === 2 ? -34 : 0)}px;--r:{(i - 2) * 8}deg"><Card {id} /></span>
        {/each}
        <svg class="flick" viewBox="0 0 60 90"><path d="M30 84V14M14 30 30 12 46 30" /></svg>
      </div>
      <h2 class="display">{t('guide8Title')}</h2>
      <p>{t('guide8Text')}</p>
    </section>

    <section class="page">
      <div class="art seals" aria-hidden="true">
        <Seal glyph="13" earned size={70} />
        <Seal glyph="Ω" earned size={70} />
        <Seal glyph="1" size={70} />
      </div>
      <h2 class="display">{t('guide9Title')}</h2>
      <p>{t('guide9Text')}</p>
    </section>
  {/if}
</ewo-guide>

<style>
  /* The guide in the card table's room: dark wood, the text in the cloth's paper colour, the main
     button paper with the gold hairline, the dots gold. */
  ewo-guide {
    --ewo-guide-bg: radial-gradient(120% 70% at 50% 0%, #3a2015, #120a07 70%) #140b08;
    --ewo-guide-fg: var(--on-cloth);
    --ewo-guide-fg-2: var(--on-cloth-2);
    --ewo-guide-accent: var(--paper);
    --ewo-guide-accent-ink: var(--ink);
    /* One size for every dot, so colour alone marks the page: the paper at half strength is 4:1 on
       the wood and 3:1 under the gold. */
    --ewo-guide-dot: rgb(236 230 214 / 0.5);
    --ewo-guide-dot-on: var(--gold-hi);
  }
  ewo-guide::part(next) {
    box-shadow: inset 0 0 0 2px var(--paper), inset 0 0 0 3px var(--gold);
    font: 700 17px/1 var(--display);
  }
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px 28px 8px;
    text-align: center;
  }
  h2 {
    margin: 8px 0 0;
    font-size: 30px;
    line-height: 1.08;
    text-wrap: balance;
    color: var(--on-cloth);
  }
  p {
    margin: 0;
    max-width: 34ch;
    font-size: 16px;
    line-height: 1.5;
    color: var(--on-cloth-2);
    text-wrap: pretty;
  }

  /* The pictures: cards laid out from a centre point (--x, --y, --r), like on the table. */
  .art {
    position: relative;
    flex: none;
    width: min(100%, 320px);
    height: 230px;
  }
  .c {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 92px;
    translate: calc(-50% + var(--x, 0px)) calc(-50% + var(--y, 0px));
    rotate: var(--r, 0deg);
    filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.5));
  }
  .c.small {
    width: 74px;
  }
  .c.win {
    filter: drop-shadow(0 0 10px rgb(243 220 148 / 0.75)) drop-shadow(0 10px 14px rgb(0 0 0 / 0.5));
  }
  .c.dim {
    filter: brightness(0.62) saturate(0.7) drop-shadow(0 10px 14px rgb(0 0 0 / 0.5));
  }
  .bid {
    position: absolute;
    right: 18px;
    top: 6px;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: linear-gradient(var(--gold-hi), var(--gold));
    color: var(--ink);
    font-size: 30px;
    box-shadow: 0 0 0 2px var(--gold-lo), 0 8px 16px -6px rgb(0 0 0 / 0.6);
  }
  .tag {
    position: absolute;
    left: 50%;
    bottom: 4px;
    translate: -50% 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgb(18 11 7 / 0.7);
    color: var(--gold-hi);
    font: 700 14px/1 var(--display);
  }
  .dial {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
    width: min(100%, 280px);
    height: 170px;
    padding: 0 18px;
  }
  .dial .step {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1.5px solid var(--ink);
    color: var(--ink);
    font: 600 26px/1 var(--ewo-sans);
  }
  .dial .value {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--ink);
  }
  /* The number alone, as in the bid itself (Table.svelte), with room for the face's old-style digits. */
  .dial b {
    font-size: 76px;
    line-height: 1.34;
  }
  .pad {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: min(100%, 290px);
    height: 180px;
    padding: 18px 24px;
    color: var(--ink);
    text-align: left;
  }
  /* Each row in the middle between its rules, the words and the score centred on each other (they
     sat 2 to 5 px low on a shared baseline: plans/text-centering.md, 2026-10-14). */
  .pad .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    /* Two pixels more below than above: the rule is part of the row, and the score's caps stand a
       little low in its line (measured: tools/text-audit.mjs → stackAudit). */
    padding: 8px 0 10px;
    border-bottom: 1px solid rgb(28 26 34 / 0.12);
    font-size: 14px;
  }
  .pad .row:last-child {
    padding-bottom: 11px;
    border-bottom: 0;
  }
  .pad b {
    font-size: 22px;
    font-variant-numeric: tabular-nums;
  }
  .good {
    color: var(--good);
  }
  .bad {
    color: var(--bad);
  }
  .flick {
    position: absolute;
    left: 50%;
    top: -6px;
    width: 34px;
    translate: 40px 0;
    fill: none;
    stroke: var(--gold-hi);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: nudge 1.6s ease-in-out infinite;
  }
  @keyframes nudge {
    50% {
      translate: 40px -8px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flick {
      animation: none;
    }
  }
  .seals {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 170px;
  }
  @media (max-height: 700px) {
    .art {
      height: 190px;
    }
    h2 {
      font-size: 26px;
    }
  }
</style>
