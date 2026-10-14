// The ranks against each other: many rounds with bots of different ranks at one table (the seats
// rotate every deal, so no rank keeps the good seat), and each rank's average points per round, how
// often it met its bid, and how long its decisions took. Each rank should clearly beat the one below.
//
//   node tools/ladder.mjs                         PLAYERS=4 DEALS=400
//   LINEUP=apprentice,journeyman,master,journeyman   one rank per seat (also: plain = the bots before
//                                                    the ranks, random = a random bid and card)
//   SPECIALS=1 BIDDING=uneven|secret SEED=7
import { botBid, botPlay, botTrump } from '../server/bots.mjs';
import { bid, deal, legalCards, pickTrump, play, roundsFor, SUITS } from '../server/rules.mjs';

const PLAYERS = Number(process.env.PLAYERS ?? 4);
const DEALS = Number(process.env.DEALS ?? 400);
const SPECIALS = process.env.SPECIALS === '1';
const BIDDING = process.env.BIDDING ?? 'open';
const LINEUP = (process.env.LINEUP ?? 'apprentice,journeyman,master,journeyman').split(',');
if (LINEUP.length !== PLAYERS) throw new Error(`LINEUP needs ${PLAYERS} ranks`);

function seeded(seed) {
  let a = seed >>> 0;
  return (n) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}
const rand = seeded(Number(process.env.SEED ?? 7));
const temper = 'steady';

const stats = new Map();
const of = (level) => {
  if (!stats.has(level)) stats.set(level, { points: 0, sq: 0, n: 0, met: 0, ms: 0, moves: 0, slowest: 0 });
  return stats.get(level);
};
const timed = (level, fn) => {
  const t = performance.now();
  const out = fn();
  const ms = performance.now() - t;
  const st = of(level);
  st.ms += ms;
  st.moves++;
  st.slowest = Math.max(st.slowest, ms);
  return out;
};

const rounds = roundsFor(PLAYERS, SPECIALS);
for (let d = 0; d < DEALS; d++) {
  const round = 1 + rand(rounds);
  const dealer = rand(PLAYERS);
  const levelAt = (seat) => LINEUP[(seat + d) % PLAYERS];
  const s = deal({ players: PLAYERS, round, dealer, randomInt: rand, bidding: BIDDING, specials: SPECIALS });
  if (s.phase === 'trump') pickTrump(s, dealer, levelAt(dealer) === 'random' ? SUITS[rand(4)] : botTrump(s, dealer));
  while (s.phase === 'bid') {
    const seat = BIDDING === 'secret' ? s.bids.findIndex((b) => b === null) : s.turn;
    const level = levelAt(seat);
    let n = level === 'random' ? rand(round + 1) : timed(level, () => botBid(s, seat, { level, temper }));
    try {
      bid(s, seat, n);
    } catch {
      bid(s, seat, n === 0 ? 1 : n - 1);
    }
  }
  while (s.phase === 'play') {
    const seat = s.turn;
    const level = levelAt(seat);
    const legal = legalCards(s, seat);
    const card = level === 'random' ? legal[rand(legal.length)] : timed(level, () => botPlay(s, seat, { level, temper }));
    play(s, seat, card);
  }
  s.points.forEach((p, seat) => {
    const st = of(levelAt(seat));
    st.points += p;
    st.sq += p * p;
    st.n++;
    if (s.bids[seat] === s.won[seat]) st.met++;
  });
}

console.log(`${PLAYERS} players, ${DEALS} deals${SPECIALS ? ', special cards' : ''}${BIDDING !== 'open' ? `, ${BIDDING} bids` : ''}`);
console.log('rank        points/round   ±       met    ms/move  slowest');
for (const [level, st] of [...stats].sort((a, b) => a[1].points / a[1].n - b[1].points / b[1].n)) {
  const mean = st.points / st.n;
  const se = Math.sqrt(Math.max(0, st.sq / st.n - mean * mean) / st.n);
  console.log(`${level.padEnd(11)} ${mean.toFixed(1).padStart(8)}   ${se.toFixed(1).padStart(6)}   ${((st.met / st.n) * 100).toFixed(0).padStart(4)} %   ${(st.moves ? st.ms / st.moves : 0).toFixed(2).padStart(6)}   ${st.slowest.toFixed(0).padStart(5)} ms`);
}
