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

export type Suit = 'fire' | 'water' | 'earth' | 'air';
export type Lang = 'de' | 'en';
/** A card as the deck draws it: a number card, a Wizard (z) or a Jester (n), or the back. */
export type Face = { k: 'num'; s: Suit; v: number } | { k: 'z'; s: Suit } | { k: 'n'; s: Suit } | { k: 'back' };

export const SUITS: Suit[] = ['fire', 'water', 'earth', 'air'];
type Shape = 'tri' | 'circle' | 'square' | 'diamond';
export const SHAPE: Record<Suit, Shape> = { fire: 'tri', water: 'circle', earth: 'square', air: 'diamond' };
/** The four inks on paper. */
export const INK: Record<Suit, string> = { fire: '#c23a22', water: '#1f3c8f', earth: '#1d6849', air: '#a87405' };
/** The same, brighter, for marks on black and ultramarine. */
export const LUM: Record<Suit, string> = { fire: '#e8573b', water: '#5f8ae8', earth: '#46ae79', air: '#e9b032' };
export const PAPER = '#f8f6f1';
export const BLACK = '#1c1a22';
export const ULTRAMARINE = '#1d2b62';

export const WORDS = {
  de: { z: 'Z', n: 'N', zName: 'Zauberer', nName: 'Narr', back: 'Rückseite',
        suit: { fire: 'Feuer', water: 'Wasser', earth: 'Erde', air: 'Luft' } },
  en: { z: 'W', n: 'J', zName: 'Wizard', nName: 'Jester', back: 'Back',
        suit: { fire: 'Fire', water: 'Water', earth: 'Earth', air: 'Air' } },
};

/**
 * A card id from the server (server/rules.mjs): "fire-7", "z-water" (a Wizard), "n-air" (a Jester).
 * Anything else is the back.
 */
export function fromId(id: string | null | undefined): Face {
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
const SILVER: [number, string][] = [[0, '#5b616c'], [.18, '#a7aeb9'], [.32, '#e9eef5'], [.4, '#ffffff'], [.48, '#bcc3ce'], [.62, '#6a707b'], [.78, '#c3cad4'], [.9, '#eef1f5'], [1, '#878e99']];
const foil = (id: string, stops: [number, string][], k: number) =>
  `<linearGradient id="${id}" class="foil" data-k="${k}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="250" y2="350" spreadMethod="reflect">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

// ---------- The cards ----------

const BODONI = `font-family="'Bodoni Moda Variable', 'Bodoni Moda', Didot, 'Times New Roman', serif"`;
const svg = (defs: string, body: string) => `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
const corners = (inner: string) => `<g>${inner}</g><g transform="rotate(180 125 175)">${inner}</g>`;
const frames = (st: string) => `<rect x="11" y="11" width="228" height="328" rx="8" fill="none" stroke="${st}" stroke-width="1"/><rect x="15.5" y="15.5" width="219" height="319" rx="6" fill="none" stroke="${st}" stroke-width="2.2"/>`;
const index = (txt: string | number, fill: string, mark: string) => `<text x="47" y="63" text-anchor="middle" ${BODONI} font-weight="800" font-size="50" style="font-variation-settings:'opsz' 14" fill="${fill}">${txt}</text>${mark}`;
const label = (txt: string, fill: string) => `<text x="125" y="318" text-anchor="middle" ${BODONI} font-weight="700" font-size="13" letter-spacing="5" fill="${fill}">${txt.toUpperCase()}</text>`;

/** One card as SVG. `uid` keeps the card's own gradient ids apart from every other card on the page. */
export function card(c: Face, { lang = 'de', uid = 0 }: { lang?: Lang; uid?: number | string } = {}) {
  const t = WORDS[lang], u = String(uid);
  if (c.k === 'num') {
    const ink = INK[c.s], sh = SHAPE[c.s], size = c.v > 9 ? 84 : 96;
    return svg('', `<rect width="250" height="350" rx="14" fill="${PAPER}"/>${frames(ink)}
      <use href="#st-ros-${c.v}" fill="none" stroke="${ink}" stroke-width=".55" opacity=".5"/>
      <circle cx="125" cy="175" r="57" fill="${PAPER}" stroke="${ink}" stroke-width=".9"/>
      <circle cx="125" cy="175" r="84" fill="none" stroke="${ink}" stroke-width=".9"/>
      <text x="125" y="${f(175 + size * .35)}" text-anchor="middle" ${BODONI} font-weight="700" font-size="${size}" style="font-variation-settings:'opsz' 72" fill="${ink}" filter="url(#st-press)">${c.v}</text>
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
  // The back.
  const g = `url(#st-gold-${u})`;
  const four = SUITS.map((s, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 2, x = 125 + Math.cos(a) * 82, y = 175 + Math.sin(a) * 82;
    return `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="${ULTRAMARINE}" stroke="${g}" stroke-width="1"/><path d="${shapeD(SHAPE[s], x, y, 6.5)}" fill="${LUM[s]}"/>`;
  }).join('');
  return svg(foil(`st-gold-${u}`, GOLD, 9) + `<clipPath id="st-clip-${u}"><rect x="12" y="12" width="226" height="326" rx="8"/></clipPath>`,
    `<rect width="250" height="350" rx="14" fill="${PAPER}"/><rect x="12" y="12" width="226" height="326" rx="8" fill="${ULTRAMARINE}"/>
    <g clip-path="url(#st-clip-${u})"><use href="#st-waves" fill="none" stroke="${g}" stroke-width=".55" opacity=".8"/></g>
    <rect x="12" y="12" width="226" height="326" rx="8" fill="none" stroke="${g}" stroke-width="1.4"/>
    <circle cx="125" cy="175" r="66" fill="${ULTRAMARINE}" stroke="${g}" stroke-width="1.6"/>
    <use href="#st-bros" fill="none" stroke="${g}" stroke-width=".6"/>
    <circle cx="125" cy="175" r="40" fill="${ULTRAMARINE}" stroke="${g}" stroke-width="1"/>
    <path d="${rose(125, 175, 34, 22, 9)}" fill="${g}"/>${four}`);
}
