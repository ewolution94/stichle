// Stichle's deck in Prägung (letterpress): 52 number cards, four Wizards and four Jesters (one per
// element) and the back, drawn in code. Every function returns an SVG string. Drawn first for the
// user's review in the workspace (plans/stichle/deck.js and its contact sheet); this is the copy the
// app uses, and the one to change.
//
// A page injects defs() once, in an <svg width="0" height="0"> of its own: the pressed-ink filter and
// the engravings live there, and the cards draw them with <use> (an engraving is a few thousand
// points; sixty copies of it would be most of the page). The foil gradients are each card's own, so a
// card can move its gold with its tilt: they carry class="foil" and data-k, how far they slide per
// degree (the page sets gradientTransform="translate(x*k -y*k)").
//
// Card sizes are in a 250 × 350 viewBox (63 × 88 mm, a poker card). The corner index is sized for the
// hand: a card 74 px wide shows a strip of about 26 px, which is 88 units here.

import type { BackId } from './achievements';
import { ellipse, FIGURES, silhouette, smooth, star, type Figure } from './figures.js';
import { personOf } from './people.js';

export type Suit = 'fire' | 'water' | 'earth' | 'air';
/** How the cards look: the people of a medieval town (the default), or the classic letterpress deck. */
export type Art = 'figures' | 'classic';
export type Lang = 'de' | 'en';
/** The special cards (R3, a house rule): one each, no suit. */
export type Special = 'dragon' | 'fairy' | 'thief';
export const SPECIALS: Special[] = ['dragon', 'fairy', 'thief'];
/** A card as the deck draws it: a number card, a Wizard (z) or a Jester (n), a special card (x), or the back. */
export type Face = { k: 'num'; s: Suit; v: number } | { k: 'z'; s: Suit } | { k: 'n'; s: Suit } | { k: 'x'; name: Special } | { k: 'back' };

export const SUITS: Suit[] = ['fire', 'water', 'earth', 'air'];
type Shape = 'tri' | 'circle' | 'square' | 'diamond';
export const SHAPE: Record<Suit, Shape> = { fire: 'tri', water: 'circle', earth: 'square', air: 'diamond' };
/**
 * The four inks on paper, chosen to tell apart at a glance on a phone (the user, 2026-10-12): a true
 * red, a cobalt blue, a fresh green and a golden yellow, far apart in hue and not all dark.
 */
export const INK: Record<Suit, string> = { fire: '#cc2b2b', water: '#1c5bc4', earth: '#17834a', air: '#c99700' };
/** Each suit's paper, lightly tinted with its ink, so even a sliver of a card in the hand reads as its suit. */
export const TINT: Record<Suit, string> = { fire: '#fbe9e6', water: '#e8effb', earth: '#e6f3ea', air: '#fbf1d6' };
/** The same, brighter, for marks on black and ultramarine. */
export const LUM: Record<Suit, string> = { fire: '#f0594a', water: '#6f9cf5', earth: '#4cc07e', air: '#f2c02c' };
export const PAPER = '#f8f6f1';
export const BLACK = '#1c1a22';
export const ULTRAMARINE = '#1d2b62';

export const WORDS = {
  de: { z: 'Z', n: 'N', zName: 'Zauberer', nName: 'Narr', back: 'Rückseite',
        suit: { fire: 'Feuer', water: 'Wasser', earth: 'Erde', air: 'Luft' },
        x: { dragon: 'Drache', fairy: 'Fee', thief: 'Dieb' } as Record<Special, string> },
  en: { z: 'W', n: 'J', zName: 'Wizard', nName: 'Jester', back: 'Back',
        suit: { fire: 'Fire', water: 'Water', earth: 'Earth', air: 'Air' },
        x: { dragon: 'Dragon', fairy: 'Fairy', thief: 'Thief' } as Record<Special, string> },
};

/**
 * A card id from the server (server/rules.mjs): "fire-7", "z-water" (a Wizard), "n-air" (a Jester).
 * Anything else is the back.
 */
export function fromId(id: string | null | undefined): Face {
  if (id === 'dragon' || id === 'fairy' || id === 'thief') return { k: 'x', name: id };
  const m = /^(?:(z|n)-(fire|water|earth|air)|(fire|water|earth|air)-(\d{1,2}))$/.exec(id ?? '');
  if (!m) return { k: 'back' };
  if (m[1]) return { k: m[1] as 'z' | 'n', s: m[2] as Suit };
  return { k: 'num', s: m[3] as Suit, v: Number(m[4]) };
}

/** The 60 cards in deck order: each suit 1 to 13, then the Wizards, then the Jesters. */
export function deck(): Face[] {
  const cards: Face[] = [];
  for (const s of SUITS) for (let v = 1; v <= 13; v++) cards.push({ k: 'num', s, v });
  for (const s of SUITS) cards.push({ k: 'z', s });
  for (const s of SUITS) cards.push({ k: 'n', s });
  return cards;
}

export function nameOf(c: Face, lang: Lang = 'de') {
  const t = WORDS[lang];
  if (c.k === 'num') return `${t.suit[c.s]} ${c.v}`;
  if (c.k === 'z') return `${t.zName} · ${t.suit[c.s]}`;
  if (c.k === 'n') return `${t.nName} · ${t.suit[c.s]}`;
  if (c.k === 'x') return t.x[c.name];
  return t.back;
}

// ---------- Geometry ----------

const f = (n: number) => +n.toFixed(1);

function circleD(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/** A suit's shape: fire a triangle, water a circle, earth a square, air a diamond. */
export function shapeD(kind: Shape, cx: number, cy: number, s: number) {
  if (kind === 'tri') return `M${f(cx)} ${f(cy - s * 1.04)}L${f(cx + s)} ${f(cy + s * 0.7)}L${f(cx - s)} ${f(cy + s * 0.7)}Z`;
  if (kind === 'circle') return circleD(cx, cy, s * 0.86);
  if (kind === 'square') { const h = s * 0.76; return `M${f(cx - h)} ${f(cy - h)}H${f(cx + h)}V${f(cy + h)}H${f(cx - h)}Z`; }
  return `M${f(cx)} ${f(cy - s)}L${f(cx + s * 0.74)} ${f(cy)}L${f(cx)} ${f(cy + s)}L${f(cx - s * 0.74)} ${f(cy)}Z`;
}

/** Guilloche: n rings of k lobes each, offset in phase so they weave into a band. */
function rosette(cx: number, cy: number, R: number, A: number, k: number, n: number) {
  const pts = 72 + k * 10;
  let d = '';
  for (let j = 0; j < n; j++) {
    const ph = (j / n) * 2 * Math.PI;
    for (let i = 0; i <= pts; i++) {
      const t = (i / pts) * 2 * Math.PI, r = R + A * Math.sin(k * t + ph);
      d += (i ? 'L' : 'M') + f(cx + r * Math.cos(t)) + ' ' + f(cy + r * Math.sin(t));
    }
    d += 'Z';
  }
  return d;
}

/** A compass rose: four long points, four short ones. */
function rose(cx: number, cy: number, R1: number, R2: number, r: number) {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 8, rad = i % 4 === 0 ? R1 : i % 2 === 0 ? R2 : r;
    d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rad) + ' ' + f(cy + Math.sin(a) * rad);
  }
  return d + 'Z';
}

/** The Jester's cap: three horns and a band. */
function capD(cx: number, cy: number, s: number) {
  const P = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return `M${P(-.72, .36)}Q${P(-.98, -.08)} ${P(-1.02, -.56)}Q${P(-.56, -.24)} ${P(-.22, .36)}Z` +
    `M${P(-.3, .36)}Q${P(-.2, -.42)} ${P(0, -.92)}Q${P(.2, -.42)} ${P(.3, .36)}Z` +
    `M${P(.22, .36)}Q${P(.56, -.24)} ${P(1.02, -.56)}Q${P(.98, -.08)} ${P(.72, .36)}Z` +
    `M${P(-.8, .34)}H${f(cx + .8 * s)}V${f(cy + .58 * s)}H${f(cx - .8 * s)}Z`;
}
const bellsAt = (cx: number, cy: number, s: number) => [[-1.02, -.56], [0, -.92], [1.02, -.56]].map(([x, y]) => [f(cx + x * s), f(cy + y * s)]);

function harlequin(x0: number, x1: number, cy: number, hh: number, n: number) {
  const w = (x1 - x0) / n;
  return Array.from({ length: n }, (_, i) => {
    const cx = x0 + w * (i + .5);
    return `M${f(cx)} ${f(cy - hh)}L${f(cx + w / 2)} ${f(cy)}L${f(cx)} ${f(cy + hh)}L${f(cx - w / 2)} ${f(cy)}Z`;
  });
}

// The Wizards' engravings differ by element, so the four can be told apart at a glance.
const WIZARD_LOBES: Record<Suit, number> = { fire: 9, water: 11, earth: 12, air: 14 };

/** Filters and engravings, once per page. */
export function defs() {
  let d = `<filter id="st-press" x="-8%" y="-8%" width="116%" height="116%">
    <feOffset in="SourceAlpha" dx="0" dy="1.8" result="o"/><feGaussianBlur in="o" stdDeviation="1.1" result="b"/>
    <feComposite in="SourceAlpha" in2="b" operator="out" result="inner"/><feFlood flood-color="#000" flood-opacity=".45"/>
    <feComposite in2="inner" operator="in" result="shade"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/></feMerge>
  </filter>`;
  // A number card's engraving has as many lobes as its value.
  for (let v = 1; v <= 13; v++) d += `<path id="st-ros-${v}" d="${rosette(125, 175, 70, 9, v, 6)}"/>`;
  for (const s of SUITS) d += `<path id="st-wros-${s}" d="${rosette(125, 175, 76, 10, WIZARD_LOBES[s], 6)}"/>`;
  d += `<path id="st-bros" d="${rosette(125, 175, 52, 8, 10, 5)}"/>`;
  let waves = '';
  for (let y = 16; y <= 336; y += 7.5) for (let x = 10, i = 0; x <= 240; x += 5, i++) waves += (i ? 'L' : 'M') + f(x) + ' ' + f(y + 3.4 * Math.sin(x / 9 + y * .41));
  d += `<path id="st-waves" d="${waves}"/>`;
  return `<defs>${d}</defs>`;
}

// ---------- Foil ----------

const GOLD: [number, string][] = [[0, '#6e4f16'], [.16, '#b98b34'], [.3, '#f3dc94'], [.38, '#fff6d6'], [.46, '#d6aa4c'], [.6, '#7b5719'], [.76, '#c79a3c'], [.88, '#f0d68a'], [1, '#94702a']];
const COPPER: [number, string][] = [[0, '#5a2a14'], [.16, '#9c5430'], [.3, '#e8a77c'], [.38, '#ffe1c8'], [.46, '#c47546'], [.6, '#6b331a'], [.76, '#b06a3e'], [.88, '#e9a77a'], [1, '#7a3d1f']];
const SILVER: [number, string][] = [[0, '#5b616c'], [.18, '#a7aeb9'], [.32, '#e9eef5'], [.4, '#ffffff'], [.48, '#bcc3ce'], [.62, '#6a707b'], [.78, '#c3cad4'], [.9, '#eef1f5'], [1, '#878e99']];
const foil = (id: string, stops: [number, string][], k: number) =>
  `<linearGradient id="${id}" class="foil" data-k="${k}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="250" y2="350" spreadMethod="reflect">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

// ---------- The cards ----------

/** The app's display face (src/app.css → @font-face): Metamorphous with a round u. */
const DISPLAY = `font-family="'Stichle Display', Georgia, 'Times New Roman', serif"`;
const svg = (defs: string, body: string) => `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
const corners = (inner: string) => `<g>${inner}</g><g transform="rotate(180 125 175)">${inner}</g>`;
const frames = (st: string) => `<rect x="11" y="11" width="228" height="328" rx="8" fill="none" stroke="${st}" stroke-width="1"/><rect x="15.5" y="15.5" width="219" height="319" rx="6" fill="none" stroke="${st}" stroke-width="2.2"/>`;
const index = (txt: string | number, fill: string, mark: string) => `<text x="47" y="63" text-anchor="middle" ${DISPLAY} font-weight="800" font-size="50" fill="${fill}">${txt}</text>${mark}`;
/** Stichle Display's capitals, in thousandths of an em (the font's own advance widths). */
const CAPS: Record<string, number> = {
  A: 749, B: 747, C: 748, D: 750, E: 749, F: 666, G: 830, H: 829, I: 414, J: 333, K: 749, L: 666, M: 1086,
  N: 832, O: 832, P: 665, Q: 832, R: 749, S: 666, T: 749, U: 830, V: 747, W: 1085, X: 749, Y: 747, Z: 666,
  Ä: 749, Ö: 832, Ü: 830, ' ': 333, '-': 664, "'": 250,
};
/** How wide a name sets in px of the card (letter-spacing follows every letter, the last one too). */
const capsWidth = (txt: string, size: number, spacing: number) => [...txt].reduce((w, ch) => w + ((CAPS[ch] ?? 750) * size) / 1000 + spacing, 0);
/** From the left frame to the bottom-right index's plate: the room a name has. */
const NAME_LEFT = 24;
const NAME_RIGHT = 170;
const NAME_STEPS: [number, number][] = [[13, 5], [12, 3.5], [11.5, 2.4], [10.5, 1.6], [10, 1.2], [9.5, 0.8]];
/**
 * The person's name under the picture, in spaced capitals. The bottom-right index takes the right
 * side, so a longer name (Kerzenzieherin, Lady of the harbour) sets smaller and tighter and moves
 * left, to stay clear of it: the largest step that fits, measured with the font's own widths; the
 * very longest is pressed to the room there is.
 */
const label = (txt: string, fill: string) => {
  const caps = txt.toUpperCase();
  const room = NAME_RIGHT - NAME_LEFT;
  const [size, spacing] = NAME_STEPS.find(([s, sp]) => capsWidth(caps, s, sp) <= room) ?? NAME_STEPS[NAME_STEPS.length - 1];
  const width = Math.min(capsWidth(caps, size, spacing), room);
  const x = Math.min(125, NAME_RIGHT - width / 2);
  const press = capsWidth(caps, size, spacing) > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${f(x)}" y="318" text-anchor="middle" ${DISPLAY} font-weight="700" font-size="${size}" letter-spacing="${spacing}"${press} fill="${fill}">${caps}</text>`;
};

/** The fire in a figure's hands is orange; the other elements glow in their own colour. */
const GLOW: Record<Suit, string> = { fire: '#ff8a3c', water: '#8fd0ff', earth: '#7be0a2', air: '#ffe27a' };
const LINEN = '#fbfaf6';

/**
 * A figure card (the user's pick, 2026-10-12): the number's person as a paper cut, a black silhouette
 * against a disc of the suit's colour, standing on black ground; gold stays foil. The Wizards stand
 * against gold, the Jesters against silver, each with its element's light. The corner indices sit on
 * plates of the card's own paper, so the hand reads exactly as with the classic deck.
 */
function figureCard(c: Face & { s: Suit }, fig: Figure, lang: Lang, u: string) {
  const t = WORDS[lang];
  const ink = INK[c.s];
  const g = `url(#st-gold-${u})`;
  const special = c.k !== 'num';
  const ground = special ? PAPER : TINT[c.s];
  const disc = c.k === 'z' ? g : c.k === 'n' ? `url(#st-silver-${u})` : ink;
  const rule = c.k === 'z' ? g : c.k === 'n' ? BLACK : ink;
  const mark =
    c.k === 'num'
      ? `<path d="${shapeD(SHAPE[c.s], 47, 88, 12)}" fill="${ink}"/>`
      : c.k === 'z'
        ? `<path d="${rose(47, 87, 12, 7, 3)}" fill="${g}"/>`
        : `<path d="${shapeD('diamond', 47, 88, 11)}" fill="url(#st-silver-${u})" stroke="${BLACK}" stroke-width=".8"/>`;
  const txt = c.k === 'num' ? c.v : c.k === 'z' ? t.z : t.n;
  const art = silhouette(fig, {
    gold: g,
    glow: c.k === 'num' ? GLOW[c.s] : LUM[c.s],
    paper: LINEN,
    emblem: () => `<path d="${shapeD(SHAPE[c.s], 92, 182, 15)}" fill="${ink}"/>`,
  });
  return svg(foil(`st-gold-${u}`, GOLD, 9) + foil(`st-silver-${u}`, SILVER, 9), `<rect width="250" height="350" rx="14" fill="${ground}"/>
    <circle cx="125" cy="150" r="88" fill="${disc}"/><circle cx="125" cy="150" r="96" fill="none" stroke="${rule}" stroke-width="1.2"/>
    <path d="M30,294C70,284 100,288 125,290C150,292 185,284 220,294V300H30Z" fill="${BLACK}"/>
    <g transform="translate(125 294) scale(.92) translate(-125 -292)">${art}</g>
    <path d="M17,17H76V84Q76,100 60,100H17Z" fill="${ground}"/>
    <path d="M233,333H174V266Q174,250 190,250H233Z" fill="${ground}"/>
    ${frames(rule)}
    ${corners(index(txt, rule === BLACK ? BLACK : rule, mark))}
    ${label(fig.names[lang], BLACK)}`);
}

/** One card as SVG. `uid` keeps the card's own gradient ids apart from every other card on the page. */
/** The backs: the cloth's ultramarine in gold, and what the achievements unlock (R2). */
const BACKS: Record<BackId, { ground: string; foil: [number, string][]; lines?: string }> = {
  ultramarin: { ground: ULTRAMARINE, foil: GOLD },
  bordeaux: { ground: '#5b1427', foil: GOLD },
  waldgruen: { ground: '#173f2b', foil: GOLD },
  nacht: { ground: '#141219', foil: GOLD },
  silber: { ground: ULTRAMARINE, foil: SILVER },
  kupfer: { ground: '#3a1d10', foil: COPPER },
  // The gold back: the whole ground is foil, the engraving in black.
  gold: { ground: 'foil', foil: GOLD, lines: BLACK },
};

/**
 * The special cards' looks (R3): the Drache on copper foil, the Fee on lilac, the Dieb under a pale
 * moon; each with its own sign in the corners instead of a letter (Drache and Dieb share a D).
 */
const SPECIAL_LOOK: Record<Special, { disc: string; ink: string; glow: string }> = {
  dragon: { disc: 'copper', ink: '#8a3f1c', glow: '#ff8a3c' },
  fairy: { disc: '#cdb8ef', ink: '#5b3fa8', glow: '#ffffff' },
  thief: { disc: '#b8c4d6', ink: '#2b3a5a', glow: '#ffe27a' },
};
/** The corner signs: the Drache's flame, the Fee's star, the Dieb's mask. */
const SIGN: Record<Special, (cx: number, cy: number) => string> = {
  dragon: (x, y) => smooth([[x, y - 24, 1], [x + 9, y - 8], [x + 13, y + 6], [x + 7, y + 18], [x, y + 21], [x - 7, y + 18], [x - 13, y + 6], [x - 9, y - 8]]),
  fairy: (x, y) => star(x, y, 21),
  thief: (x, y) =>
    smooth([[x - 25, y - 6], [x - 12, y - 12], [x, y - 7], [x + 12, y - 12], [x + 25, y - 6], [x + 21, y + 8], [x + 8, y + 10], [x, y + 4], [x - 8, y + 10], [x - 21, y + 8]]) +
    ellipse(x - 10, y - 1, 5.5, 3.5) +
    ellipse(x + 10, y - 1, 5.5, 3.5),
};

/** A special card: its figure on its disc, as the paper cut (both decks draw it so). */
function specialCard(c: Face & { k: 'x' }, lang: Lang, u: string) {
  const t = WORDS[lang];
  const look = SPECIAL_LOOK[c.name];
  const copper = `url(#st-copper-${u})`;
  const disc = look.disc === 'copper' ? copper : look.disc;
  const ink = look.disc === 'copper' ? copper : look.ink;
  const art = silhouette(FIGURES[c.name], { gold: `url(#st-gold-${u})`, glow: look.glow, paper: LINEN, emblem: () => '' });
  const sign = `<path d="${SIGN[c.name](47, 52)}" fill="${ink}" fill-rule="evenodd"/>`;
  return svg(foil(`st-gold-${u}`, GOLD, 9) + foil(`st-copper-${u}`, COPPER, 9), `<rect width="250" height="350" rx="14" fill="${PAPER}"/>
    <circle cx="125" cy="150" r="88" fill="${disc}"/><circle cx="125" cy="150" r="96" fill="none" stroke="${ink}" stroke-width="1.2"/>
    <path d="M30,294C70,284 100,288 125,290C150,292 185,284 220,294V300H30Z" fill="${BLACK}"/>
    <g transform="translate(125 294) scale(.92) translate(-125 -292)">${art}</g>
    <path d="M17,17H76V84Q76,100 60,100H17Z" fill="${PAPER}"/>
    <path d="M233,333H174V266Q174,250 190,250H233Z" fill="${PAPER}"/>
    ${frames(ink)}
    ${corners(sign)}
    ${label(t.x[c.name], BLACK)}`);
}

export function card(c: Face, { lang = 'de', uid = 0, art = 'figures', back = 'ultramarin' }: { lang?: Lang; uid?: number | string; art?: Art; back?: BackId } = {}) {
  const t = WORDS[lang], u = String(uid);
  if (c.k === 'x') return specialCard(c, lang, u);
  if (art === 'figures' && c.k !== 'back') {
    // The number's person in its element (people.js); the Wizard and the Jester are everyone's.
    const fig = c.k === 'num' ? personOf(c.s, c.v) : FIGURES[c.k === 'z' ? 'wizard' : 'jester'];
    if (fig) return figureCard(c, fig, lang, u);
  }
  if (c.k === 'num') {
    const ink = INK[c.s], tint = TINT[c.s], sh = SHAPE[c.s], size = c.v > 9 ? 84 : 96;
    return svg('', `<rect width="250" height="350" rx="14" fill="${tint}"/>${frames(ink)}
      <use href="#st-ros-${c.v}" fill="none" stroke="${ink}" stroke-width=".55" opacity=".5"/>
      <circle cx="125" cy="175" r="57" fill="${tint}" stroke="${ink}" stroke-width=".9"/>
      <circle cx="125" cy="175" r="84" fill="none" stroke="${ink}" stroke-width=".9"/>
      <text x="125" y="${f(175 + size * .35)}" text-anchor="middle" ${DISPLAY} font-weight="700" font-size="${size}" fill="${ink}" filter="url(#st-press)">${c.v}</text>
      <path d="${shapeD(sh, 125, 72, 13)}" fill="${ink}"/>
      <path d="${shapeD(sh, 125, 278, 13)}" fill="${ink}" transform="rotate(180 125 278)"/>
      ${corners(index(c.v, ink, `<path d="${shapeD(sh, 47, 88, 12)}" fill="${ink}"/>`))}`);
  }
  if (c.k === 'z') {
    const g = `url(#st-gold-${u})`;
    const four = SUITS.map((s, i) => {
      const a = -Math.PI / 4 + i * Math.PI / 2;
      return `<path d="${shapeD(SHAPE[s], 125 + Math.cos(a) * 50, 175 + Math.sin(a) * 50, 8)}" fill="${LUM[s]}" opacity="${s === c.s ? 1 : .55}"/>`;
    }).join('');
    return svg(foil(`st-gold-${u}`, GOLD, 9), `<rect width="250" height="350" rx="14" fill="${BLACK}"/>${frames(g)}
      <use href="#st-wros-${c.s}" fill="none" stroke="${g}" stroke-width=".6"/>
      <circle cx="125" cy="175" r="90" fill="none" stroke="${g}" stroke-width=".9"/>
      <path d="${rose(125, 175, 62, 36, 14)}" fill="${g}"/>
      <circle cx="125" cy="175" r="16" fill="${BLACK}" stroke="${g}" stroke-width="1.6"/>
      <path d="${shapeD(SHAPE[c.s], 125, c.s === 'fire' ? 177 : 175, 8.5)}" fill="${LUM[c.s]}"/>${four}
      ${label(t.zName, g)}
      ${corners(index(t.z, g, `<path d="${rose(47, 87, 12, 7, 3)}" fill="${g}"/>`))}`);
  }
  if (c.k === 'n') {
    const s = `url(#st-silver-${u})`;
    const dia = harlequin(17.5, 232.5, 175, 34, 6).map((d, i) => `<path d="${d}" fill="${i % 2 ? INK[c.s] : s}"/>`).join('');
    const bells = bellsAt(125, 184, 32).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${s}" stroke="${BLACK}" stroke-width=".9"/>`).join('');
    return svg(foil(`st-silver-${u}`, SILVER, 9), `<rect width="250" height="350" rx="14" fill="${PAPER}"/>${frames(BLACK)}${dia}
      <circle cx="125" cy="175" r="52" fill="${PAPER}" stroke="${BLACK}" stroke-width="2"/>
      <path d="${capD(125, 184, 32)}" fill="${BLACK}"/>${bells}
      ${label(t.nName, BLACK)}
      ${corners(index(t.n, BLACK, `<path d="${shapeD('diamond', 47, 88, 11)}" fill="${s}" stroke="${BLACK}" stroke-width=".8"/>`))}`);
  }
  // The back, in the look this device chose.
  const look = BACKS[back] ?? BACKS.ultramarin;
  const g = `url(#st-gold-${u})`;
  const ground = look.ground === 'foil' ? g : look.ground;
  const line = look.lines ?? g;
  const four = SUITS.map((s, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 2, x = 125 + Math.cos(a) * 82, y = 175 + Math.sin(a) * 82;
    return `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="${look.lines ? BLACK : ground}" stroke="${line}" stroke-width="1"/><path d="${shapeD(SHAPE[s], x, y, 6.5)}" fill="${LUM[s]}"/>`;
  }).join('');
  return svg(foil(`st-gold-${u}`, look.foil, 9) + `<clipPath id="st-clip-${u}"><rect x="12" y="12" width="226" height="326" rx="8"/></clipPath>`,
    `<rect width="250" height="350" rx="14" fill="${PAPER}"/><rect x="12" y="12" width="226" height="326" rx="8" fill="${ground}"/>
    <g clip-path="url(#st-clip-${u})"><use href="#st-waves" fill="none" stroke="${line}" stroke-width=".55" opacity="${look.lines ? .45 : .8}"/></g>
    <rect x="12" y="12" width="226" height="326" rx="8" fill="none" stroke="${line}" stroke-width="1.4"/>
    <circle cx="125" cy="175" r="66" fill="${look.lines ? BLACK : ground}" stroke="${line}" stroke-width="1.6"/>
    <use href="#st-bros" fill="none" stroke="${look.lines ? g : line}" stroke-width=".6"/>
    <circle cx="125" cy="175" r="40" fill="${look.lines ? BLACK : ground}" stroke="${look.lines ? g : line}" stroke-width="1"/>
    <path d="${rose(125, 175, 34, 22, 9)}" fill="${look.lines ? g : line}"/>${four}`);
}
