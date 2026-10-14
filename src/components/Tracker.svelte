<!--
  Feeds your record (src/lib/profile.svelte.ts) from what your own view shows, nothing more: your
  hand as dealt, the tricks you took and with what, each round's bid and tricks, the final standings
  of a game played to the end. Every one is counted once by its key (table, game, round, trick), so a
  reload or a second tab never counts it twice. Draws nothing.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { countDeal, countGame, countRound, countTrick } from '../lib/achievements';
  import { counted, profile } from '../lib/profile.svelte';
  import type { Room } from '../lib/room.svelte';

  let { room }: { room: Room } = $props();

  /** Wizards dealt to you, per round (unknown after a reload mid-round). */
  const dealt = new Map<string, number>();

  $effect(() => {
    const v = room.view;
    const g = v?.game;
    if (!v || !g || !v.me) return;
    // The record changes as it counts; only the view should run this again.
    untrack(() => record(v, g, g.seats.indexOf(v.me!)));
  });

  function record(v: NonNullable<Room['view']>, g: NonNullable<NonNullable<Room['view']>['game']>, mine: number) {
    if (mine < 0) return;
    const base = `${v.code}:${g.startedAt}`;
    const round = `${base}:${g.round}`;

    // The deal: your whole hand, before you've played a card.
    if (g.phase === 'round' && g.hand && g.hand.length === g.round && !dealt.has(round)) {
      dealt.set(round, g.hand.filter((c) => c.startsWith('z-')).length);
      counted(countDeal(profile, `${round}:deal`, g.hand));
    }

    // A trick you took, and the card you took it with.
    const t = g.lastTrick;
    // A stolen trick (the Dieb) is nobody's.
    if (t && t.winner === mine && !t.stolen) {
      const card = t.cards.find((c) => c.seat === mine)?.card ?? null;
      counted(countTrick(profile, `${round}:t${t.n}`, card, g.trump));
    }

    // Each round's result, in order (one that ended before you arrived counts when first seen).
    for (const row of g.pad) {
      const key = `${base}:${row.round}:end`;
      if (profile.counted.includes(key)) continue;
      counted(
        countRound(profile, key, {
          bid: row.bids[mine],
          won: row.won[mine],
          // The last round of a full game (R3: a half or short game's last round is smaller).
          last: row.final ?? row.round === g.rounds,
          wizards: dealt.get(`${base}:${row.round}`) ?? null,
        }),
      );
    }

    // A game played to the end (a game ended early doesn't count).
    if (v.phase === 'final' && g.ended === 'done') {
      counted(
        countGame(profile, `${base}:game`, {
          totals: g.totals,
          mine,
          points: g.pad.map((row) => row.points),
          bids: g.pad.map((row) => row.bids),
          won: g.pad.map((row) => row.won),
          players: g.seats.length,
          full: (g.length ?? 'full') === 'full',
        }),
      );
    }
  }
</script>
