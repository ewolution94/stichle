<!--
  The end of a game: who won, everyone's total, the scores as lines across the rounds, and two
  awards (the sharpest predictions, the most tricks). The host deals again at the same table or goes
  back to the lobby; anyone can leave. A game the host ended early says so (development/plans/end-game.md).
-->
<script lang="ts">
  import { ApiError, type View } from '../lib/api';
  import { errorText, names, score, t } from '../lib/i18n.svelte';
  import type { Room } from '../lib/room.svelte';
  import { actAt } from '../lib/waits';
  import Avatar from './Avatar.svelte';

  let { room, view, onleave }: { room: Room; view: View; onleave: (from?: Event) => void } = $props();

  const game = $derived(view.game!);
  const isHost = $derived(view.me === view.host);
  const hostName = $derived(view.players.find((p) => p.id === view.host)?.name ?? '');
  const playerAt = (seat: number) => view.players.find((p) => p.id === game.seats[seat]);
  const nameAt = (seat: number) => (game.seats[seat] === view.me ? t('you') : (playerAt(seat)?.name ?? '?'));
  /** Line colours per seat: the four inks, then ink and gold. */
  const COLOURS = ['#c23a22', '#1f3c8f', '#1d6849', '#a87405', '#1c1a22', '#9a7329'];

  const standings = $derived(
    game.seats
      .map((_, seat) => ({ seat, total: game.totals[seat], met: game.pad.filter((r) => r.bids[seat] === r.won[seat]).length, tricks: game.pad.reduce((s, r) => s + r.won[seat], 0) }))
      .sort((a, b) => b.total - a.total),
  );
  const best = $derived(standings[0]?.total ?? 0);
  const winners = $derived(game.pad.length ? standings.filter((s) => s.total === best) : []);
  const stoppedBy = $derived(game.ended === 'stopped' && game.stoppedBy ? (view.players.find((p) => p.id === game.stoppedBy)?.name ?? '') : null);

  /** The awards: whoever met the most bids, and whoever took the most tricks (ties share). */
  const awards = $derived.by(() => {
    if (!game.pad.length) return [];
    const top = (key: 'met' | 'tricks') => {
      const max = Math.max(...standings.map((s) => s[key]));
      return { value: max, seats: standings.filter((s) => s[key] === max).map((s) => s.seat) };
    };
    return [
      { title: t('awardSeer'), ...top('met'), line: (v: number) => t('awardSeerLine', { n: v, of: game.pad.length }) },
      { title: t('awardTricks'), ...top('tricks'), line: (v: number) => t('awardTricksLine', { n: v }) },
    ];
  });

  // The chart: running totals per seat, round by round, from 0.
  const W = 320;
  const H = 150;
  const series = $derived.by(() => {
    const sums = game.seats.map(() => 0);
    const points = game.seats.map(() => [0]);
    for (const row of game.pad) row.points.forEach((p, i) => points[i].push((sums[i] += p)));
    return points;
  });
  const lo = $derived(Math.min(0, ...series.flat()));
  const hi = $derived(Math.max(20, ...series.flat()));
  const x = (i: number) => 8 + (i / Math.max(1, game.pad.length)) * (W - 16);
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);

  let error = $state('');
  async function act(action: string, body: unknown, from: Event) {
    error = '';
    try {
      await actAt(room, action, body, from);
    } catch (e) {
      error = errorText(e instanceof ApiError ? e.code : 'other');
    }
  }
</script>

<div class="final">
  <section class="sheet head">
    {#if stoppedBy !== null}<span class="label early">{t('endedBy', { name: stoppedBy })}</span>{/if}
    {#if winners.length}
      <div class="crown">
        {#each winners as w (w.seat)}
          {@const p = playerAt(w.seat)}
          {#if p}<Avatar avatar={p.avatar} size={64} />{/if}
        {/each}
      </div>
      <h1 class="display">{winners.length > 1 ? t('winnersAre', { names: names(winners.map((w) => nameAt(w.seat))) }) : winners[0].seat === game.seats.indexOf(view.me ?? '') ? t('youWin') : t('winnerIs', { name: nameAt(winners[0].seat) })}</h1>
      <p class="sub">{t('withPoints', { n: best })} · {t('roundsPlayed', { n: game.pad.length, of: game.rounds })}</p>
    {:else}
      <h1 class="display">{t('noRounds')}</h1>
    {/if}

    <ol class="standings">
      {#each standings as s, i (s.seat)}
        {@const p = playerAt(s.seat)}
        <li class:me={game.seats[s.seat] === view.me}>
          <span class="rank display">{i + 1}</span>
          <i class="dot" style:background={COLOURS[s.seat % COLOURS.length]}></i>
          {#if p}<Avatar avatar={p.avatar} size={26} />{/if}
          <span class="who">{nameAt(s.seat)}</span>
          <span class="met">{t('metOf', { n: s.met, of: game.pad.length })}</span>
          <b class="display">{score(s.total)}</b>
        </li>
      {/each}
    </ol>

    {#if game.pad.length > 1}
      <svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={t('chartLabel')}>
        <line x1="8" x2={W - 8} y1={y(0)} y2={y(0)} class="zero" />
        {#each series as pts, seat (seat)}
          <polyline points={pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} style:stroke={COLOURS[seat % COLOURS.length]} />
          <circle cx={x(pts.length - 1)} cy={y(pts.at(-1)!)} r="3" style:fill={COLOURS[seat % COLOURS.length]} />
        {/each}
      </svg>
    {/if}
  </section>

  {#if awards.length}
    <div class="awards">
      {#each awards as a (a.title)}
        <section class="sheet award">
          <span class="label">{a.title}</span>
          <b>{names(a.seats.map(nameAt))}</b>
          <small>{a.line(a.value)}</small>
        </section>
      {/each}
    </div>
  {/if}

  <div class="actions on-cloth">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if isHost}
      <button class="btn primary block" type="button" onclick={(e) => act('rematch', undefined, e)}>{t('again')}</button>
      <button class="btn paper block" type="button" onclick={(e) => act('rematch', { lobby: true }, e)}>{t('toLobby')}</button>
    {:else}
      <p class="wait">{t('waitAgain', { name: hostName })}</p>
    {/if}
    <button class="btn quiet" type="button" onclick={(e) => onleave(e)}>{t('leaveGame')}</button>
  </div>
</div>

<style>
  .final {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 460px;
    margin: 10px auto 0;
  }
  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 20px 20px;
    text-align: center;
  }
  .early {
    color: var(--fire);
  }
  .crown {
    display: flex;
    gap: 6px;
  }
  h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.1;
    text-wrap: balance;
  }
  .sub {
    margin: 0;
    font-size: 14px;
    color: var(--mute);
  }
  .standings {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    text-align: left;
  }
  .standings li {
    display: grid;
    grid-template-columns: 22px 8px auto minmax(0, 1fr) auto 44px;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 999px;
  }
  .standings li.me {
    background: var(--paper-2);
  }
  .rank {
    font-size: 16px;
    color: var(--mute);
    text-align: center;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .who {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .met {
    font-size: 12px;
    color: var(--mute);
  }
  .standings b {
    font-size: 19px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .chart {
    width: 100%;
    height: auto;
    margin-top: 6px;
    overflow: visible;
  }
  .chart polyline {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .chart .zero {
    stroke: var(--line);
    stroke-dasharray: 3 4;
  }
  .awards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .award {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 16px 14px;
  }
  .award b {
    font: 700 17px/1.2 var(--display);
  }
  .award small {
    font-size: 12px;
    color: var(--mute);
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  /* The two ways on, a pair: the same type as "Again" (the user, 2026-10-15: one font for both). */
  .actions .btn.paper.block {
    font: 700 18px / 1 var(--display);
    letter-spacing: 0.02em;
  }
  .wait {
    margin: 0;
    color: var(--on-cloth-2);
  }
</style>
