// The elements' own people (the user, 2026-10-12: "a fire smith, a water fisher"; the list on
// development/plans/stichle/people.html): the number still gives the standing, from the poorest at 1
// to the crown at 13, and the element gives the trade. Drawn like figures.js's people (layered parts in
// the card's 250 × 350 space, standing on the ground at y ≈ 290, printed as a paper cut), and on the
// same bodies where a rank keeps its pose: the church, the knights and the court change what they hold
// and wear. Six of figures.js's people already belong to an element and stand here as they are.
//
// Plain JavaScript with its types beside it (people.d.ts), like figures.js.

import { FIGURES, smooth, poly, ellipse, circle, limb, star, head, face, legs, feet, gown } from './figures.js';

// The card's corner plates cover the picture's top left (x < 72, y < 81) and bottom right (x > 178,
// y > 244) in these units: a prop there is hidden. Buckets, blades and heads stay out of them.

// ---- bodies and pieces -------------------------------------------------------------------------

/** An arm along points, its hand at the end. */
const arm = (pts, w = 13, role = 'cloth') => {
  const [x, y] = pts[pts.length - 1];
  return [[role, limb(pts, w)], ['skin', circle(x, y, 6)]];
};
/** A man in a belted tunic to `hem`, on his legs. */
const man = (hem = 236) => [
  ...legs(hem - 6),
  ['cloth', smooth([[108, 121], [125, 126], [142, 121], [156, 131, 1], [152, 180], [157, hem, 1], [93, hem, 1], [98, 180], [94, 131, 1]])],
  ['dark', poly([[97, 178], [153, 178], [153.5, 185], [96.5, 185]])],
];
/** A long robe to the ground. */
const robe = () => [
  ['cloth', smooth([[106, 118], [125, 126], [144, 118], [160, 134, 1], [158, 186], [166, 290, 1], [84, 290, 1], [92, 186], [90, 134, 1]])],
  ['dark', ellipse(112, 291, 10, 4.5)],
  ['dark', ellipse(138, 291, 10, 4.5)],
];
/** A woman's gown to the ground. */
const woman = (hem = 289, l = 82, r = 168) => [['cloth', gown(hem, l, r)], ...feet()];
/** An apron in linen (it shows white in the paper cut). */
const apron = (top = 150, hem = 266) => ['linen', smooth([[110, top], [140, top, 1], [145, 210], [148, hem, 1], [102, hem, 1], [105, 210], [110, top, 1]])];
const coif = () => ['linen', smooth([[107, 96], [108, 74], [125, 64], [142, 74], [143, 96], [140, 112, 1], [137, 88], [125, 79], [113, 88], [110, 112, 1]])];
const scarf = () => ['cloth2', smooth([[108, 92], [110, 74], [125, 66], [140, 74], [142, 92], [146, 104], [140, 100], [139, 84], [125, 79], [111, 84]])];
const cap = () => ['cloth2', smooth([[108, 84], [110, 70], [125, 63], [140, 70], [142, 84], [125, 80]])];
const hair = () => ['hair', smooth([[110, 86], [113, 74], [125, 70], [137, 74], [140, 86], [134, 79], [125, 77], [116, 79]])];
const beard = (len = 120) => ['hair', smooth([[109, 94], [111, 112], [125, len], [139, 112], [141, 94], [136, 104], [125, 106], [114, 104]])];
const brim = (w = 31) => [['wood', smooth([[108, 79], [110, 63], [125, 57], [140, 63], [142, 79]])], ['wood', ellipse(125, 79, w, 6)]];
const eyes = () => [['feature', circle(119.4, 93, 1.5)], ['feature', circle(130.6, 93, 1.5)]];
/** A bucket with a hoop handle; `fill` its contents' role (glow for water or embers). */
const bucket = (x, y, w = 34, h = 30, fill = 'glow') => [
  ['wood', smooth([[x - w / 2, y, 1], [x + w / 2, y, 1], [x + w / 2 - 4, y + h, 1], [x - w / 2 + 4, y + h, 1]])],
  [fill, ellipse(x, y + 1, w / 2 - 3, 3.4)],
  ['wood', limb([[x - w / 2 + 1, y], [x - w / 4, y - 14], [x, y - 17], [x + w / 4, y - 14], [x + w / 2 - 1, y]], 2.2)],
];
/** A curl of smoke or steam rising from (x, y), in paper. */
const smoke = (x, y, h = 60, s = 1) =>
  ['wool', smooth([[x - 4 * s, y], [x - 10 * s, y - h * 0.25], [x - 2 * s, y - h * 0.45], [x - 9 * s, y - h * 0.7], [x + 2 * s, y - h], [x + 8 * s, y - h * 0.72], [x + 2 * s, y - h * 0.47], [x + 10 * s, y - h * 0.25], [x + 4 * s, y]])];
/** A flame standing on (x, y). */
const flame = (x, y, h = 22, w = 8) => smooth([[x - w, y], [x - w * 0.8, y - h * 0.45], [x, y - h, 1], [x + w * 0.8, y - h * 0.45], [x + w, y], [x, y + w * 0.5]]);

/** One of figures.js's people with some parts left out (by index) and others added. */
function from(id, drop = [], add = [], names) {
  const parts = FIGURES[id].parts.filter((_, i) => !drop.includes(i));
  return { names, parts: [...parts, ...add] };
}
/** The same with parts put in front of the figure (behind it in the drawing). */
function behind(fig, back) {
  return { names: fig.names, parts: [...back, ...fig.parts] };
}

// ---- the crowns, for the queens and kings --------------------------------------------------

const crowns = {
  fire: () => [['gold', poly([[108, 82], [108, 66], [113, 74], [116, 54], [121, 70], [125, 44], [129, 70], [134, 54], [137, 74], [142, 66], [142, 82]])], ['glow', circle(125, 77, 2.6)]],
  water: () => [['gold', smooth([[108, 82, 1], [108, 66], [113, 70], [118, 62], [123, 70], [128, 62], [133, 70], [138, 62], [142, 68], [142, 82, 1]])], ['glow', circle(125, 76, 2.6)]],
  earth: () => [
    ['gold', poly([[108, 82], [108, 74], [142, 74], [142, 82]])],
    ...[112, 118.5, 125, 131.5, 138].map((x, i) => ['gold', ellipse(x, 64 - (i === 2 ? 4 : i % 2 ? 1 : 0), 3.4, 10)]),
  ],
  air: () => [['gold', poly([[108, 82], [108, 74], [142, 74], [142, 82]])], ['gold', star(112, 64, 6)], ['gold', star(125, 56, 8)], ['gold', star(138, 64, 6)]],
};
// figures.js: the queen's crown is parts 15 and 16, her rose 8 and 9; the king's crown 19 and 20,
// his sceptre 11 and 12.

// ---- the people -------------------------------------------------------------------------------

export const PEOPLE_FIGURES = {
  // ======== Fire: the hearth, the forge, the sun ========

  // 1 · Aschenputtel: in a ragged dress, sweeping the hearth, a bucket of cinders still glowing.
  ashgirl: {
    names: { de: 'Aschenputtel', en: 'Ash girl' },
    parts: [
      ['cloth', smooth([[110, 121], [125, 127], [140, 121], [152, 131, 1], [149, 176], [156, 232], [162, 282, 1], [152, 275, 1], [142, 284, 1], [132, 275, 1], [122, 284, 1], [112, 275, 1], [102, 284, 1], [92, 275, 1], [86, 282, 1], [94, 232], [101, 176], [98, 131, 1]])],
      ...feet(),
      ['wood', limb([[176, 84], [166, 252]], 4)],
      ['wood', smooth([[160, 246, 1], [172, 246, 1], [178, 292, 1], [148, 292, 1]])],
      ['dark', 'M156,256L152,290M164,256L163,290M170,256L172,290'],
      ...bucket(58, 260, 36, 30),
      ['glow', circle(50, 256, 3.4)],
      ['glow', circle(62, 253, 3)],
      ...arm([[100, 132], [94, 166], [102, 194]]),
      ...arm([[150, 132], [164, 118], [174, 112]]),
      ...head(),
      scarf(),
      ...face(),
    ],
  },

  // 2 · Die Küchenmagd: in a coif and apron, stirring the pot over the fire.
  cook: {
    names: { de: 'Küchenmagd', en: 'Kitchen maid' },
    parts: [
      ...woman(289, 84, 168),
      apron(),
      ['wood', limb([[52, 268], [46, 290]], 4)],
      ['wood', limb([[82, 268], [88, 290]], 4)],
      ['glow', poly([[50, 290], [56, 272], [62, 282], [67, 266], [72, 282], [78, 272], [84, 290]])],
      ['dark', ellipse(67, 250, 28, 22)],
      ['dark', ellipse(67, 230, 30, 5)],
      smoke(60, 220, 52, 0.9),
      ['wood', limb([[100, 192], [76, 226]], 3.4)],
      ...arm([[100, 132], [92, 162], [100, 190]]),
      ...arm([[150, 132], [164, 160], [150, 182]]),
      ...head(),
      coif(),
      ...face(),
    ],
  },

  // 3 · Der Köhler: a shovel in his hands, the charcoal pile smoking behind him.
  burner: {
    names: { de: 'Köhler', en: 'Charcoal burner' },
    parts: [
      ['dark', smooth([[12, 290, 1], [18, 262], [36, 240], [58, 232], [80, 240], [96, 262], [100, 290, 1]])],
      ['glow', ellipse(54, 284, 9, 5)],
      smoke(56, 230, 70),
      ...man(),
      ['wood', limb([[118, 196], [150, 128], [178, 72]], 5)],
      ['steel', smooth([[172, 56, 1], [190, 34, 1], [206, 48, 1], [192, 74, 1], [180, 78, 1]])],
      ...arm([[98, 134], [104, 168], [124, 186]]),
      ...arm([[150, 132], [162, 150], [152, 140]]),
      ...head(),
      beard(118),
      cap(),
      ...eyes(),
    ],
  },

  // 4 · Die Kerzenzieherin: candles hanging from a rod in one hand, one lit in the other.
  chandler: {
    names: { de: 'Kerzenzieherin', en: 'Candle maker' },
    parts: [
      ...woman(289, 84, 166),
      apron(),
      ['wood', limb([[44, 96], [110, 96]], 3)],
      ...[54, 68, 82, 96].map((x, i) => ['linen', poly([[x - 3.5, 98], [x + 3.5, 98], [x + 3.5, 134 - (i % 2) * 8], [x - 3.5, 134 - (i % 2) * 8]])]),
      ...arm([[100, 132], [94, 114], [104, 98]]),
      ['gold', ellipse(164, 186, 12, 3.6)],
      ['gold', limb([[164, 186], [164, 176]], 3)],
      ['linen', poly([[159, 146], [169, 146], [169, 176], [159, 176]])],
      ['glow', flame(164, 142, 20, 6)],
      ...arm([[150, 132], [166, 160], [164, 178]]),
      ...head(),
      coif(),
      ...face(),
    ],
  },

  // 5 · Der Bäcker: in a tall linen cap, a loaf on the peel, the oven glowing behind him.
  baker: {
    names: { de: 'Bäcker', en: 'Baker' },
    parts: [
      ['dark', smooth([[14, 290, 1], [16, 250], [28, 222], [50, 208], [72, 214], [86, 236], [90, 290, 1]])],
      ['glow', smooth([[36, 290, 1], [36, 268], [44, 256], [56, 256], [64, 268], [64, 290, 1]])],
      ...man(),
      apron(140, 244),
      ['wood', limb([[178, 290], [178, 128]], 4.5)],
      ['wood', ellipse(178, 106, 17, 23)],
      ['gold', ellipse(178, 104, 12, 8)],
      ['dark', limb([[172, 102], [176, 99]], 1.4)],
      ['dark', limb([[178, 104], [182, 101]], 1.4)],
      ...arm([[98, 134], [92, 168], [100, 196]]),
      ...arm([[152, 132], [168, 150], [176, 142]]),
      ...head(),
      ['linen', smooth([[108, 84], [103, 66], [110, 50], [125, 45], [140, 50], [147, 66], [142, 84]])],
      ...face(),
    ],
  },

  // 6 · Der Glasbläser: the pipe at his lips, a glowing bulb at its end, the furnace beside him.
  glassblower: {
    names: { de: 'Glasbläser', en: 'Glassblower' },
    parts: [
      ['dark', poly([[16, 290], [16, 210], [74, 210], [74, 290]])],
      ['dark', poly([[12, 210], [78, 210], [72, 198], [18, 198]])],
      ['glow', circle(45, 248, 13)],
      ...man(),
      ['linen', smooth([[112, 140, 1], [138, 140, 1], [146, 200], [149, 250, 1], [101, 250, 1], [104, 200]])],
      ['steel', limb([[134, 106], [204, 120]], 3.4)],
      ['glow', circle(214, 122, 12)],
      ...arm([[98, 134], [118, 150], [146, 110]]),
      ...arm([[152, 132], [170, 140], [176, 114]]),
      ...head(),
      hair(),
      ...eyes(),
    ],
  },

  // 8 · Der Alchemist: in a long robe and a cap, his flask held up, a flame under the stand.
  alchemist: {
    names: { de: 'Alchemist', en: 'Alchemist' },
    parts: [
      ...robe(),
      ['steel', limb([[46, 290], [56, 252]], 3)],
      ['steel', limb([[80, 290], [70, 252]], 3)],
      ['steel', smooth([[44, 250, 1], [82, 250, 1], [76, 262, 1], [50, 262, 1]])],
      ['glow', flame(63, 248, 22, 8)],
      ...arm([[98, 134], [88, 166], [94, 194]]),
      ...arm([[152, 132], [168, 118], [172, 100]]),
      ['linen', poly([[172, 44], [180, 44], [180, 62], [172, 62]])],
      ['linen', circle(176, 76, 15)],
      ['glow', ellipse(176, 81, 11, 7)],
      ...head(),
      ['wool', smooth([[111, 98], [114, 122], [125, 146, 1], [136, 122], [139, 98], [133, 108], [125, 110], [117, 108]])],
      ['cloth2', smooth([[106, 84], [108, 66], [125, 58], [142, 66], [144, 84], [125, 80]])],
      ...eyes(),
    ],
  },

  // 9 · Der Weihrauchmönch: the monk swinging the censer, its smoke curling up.
  censer: from('monk', [4, 5, 6, 7], [
    ...arm([[98, 138], [92, 170], [98, 196]], 12),
    ...arm([[150, 140], [166, 150], [168, 166]], 12),
    ['steel', limb([[164, 170], [168, 204]], 1.4)],
    ['steel', limb([[172, 170], [176, 204]], 1.4)],
    ['gold', smooth([[158, 204, 1], [186, 204, 1], [182, 220], [172, 226], [162, 220]])],
    ['gold', smooth([[160, 204, 1], [166, 194], [172, 190], [178, 194], [184, 204, 1]])],
    smoke(176, 188, 56, 0.8),
  ], { de: 'Mönch', en: 'Monk' }),

  // 10 · Der Drachentöter: the knight, sword up, the dragon's head at his feet.
  dragonslayer: from('knight', [], [
    ['dark', smooth([[104, 276, 1], [86, 266], [70, 260], [56, 256], [48, 246, 1], [44, 258], [34, 250, 1], [36, 264], [26, 274], [26, 292, 1], [66, 292], [82, 288], [100, 284, 1]])],
    ['dark', poly([[104, 276], [74, 272], [102, 268]])],
    ['glow', circle(58, 266, 3.2)],
    ['linen', poly([[94, 276], [91, 281], [88, 276]])],
    ['linen', poly([[84, 276], [81, 281], [78, 276]])],
  ], { de: 'Drachentöter', en: 'Dragon slayer' }),

  // 11 · Die Burgherrin: a circlet and a veil, the torch held high.
  castlelady: from('duchess', [0, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14], [
    ...arm([[98, 132], [90, 170], [100, 196]], 12),
    ['cloth', limb([[152, 132], [166, 118], [172, 100]], 12)],
    ['wood', limb([[172, 116], [174, 52]], 5)],
    ['glow', flame(174, 50, 30, 10)],
    ['skin', circle(172, 98, 6)],
    ['cloth2', smooth([[108, 86], [111, 72], [125, 66], [139, 72], [142, 86], [152, 136, 1], [98, 136, 1]])],
    ...head(125, 94, 13.5, 16.5),
    ['gold', limb([[110, 82], [140, 82]], 3.2)],
    ...face(125, 94),
  ], { de: 'Burgherrin', en: 'Lady of the castle' }),

  // 12 · Die Feuerkönigin: a crown of flames, an oil lamp burning in her hand.
  firequeen: from('queen', [8, 9, 15, 16], [
    ...crowns.fire(),
    ['gold', smooth([[116, 160, 1], [142, 156], [156, 148, 1], [150, 164], [126, 170]])],
    ['glow', flame(156, 146, 16, 5)],
  ], { de: 'Feuerkönigin', en: 'Queen of fire' }),

  // 13 · Der Sonnenkönig: a crown of rays, the sun at the top of his sceptre.
  sunking: from('king', [12, 19, 20], [
    ['gold', poly([[108, 82], [108, 70], [142, 70], [142, 82]])],
    ...Array.from({ length: 7 }, (_, i) => {
      const a = ((-150 + i * 20) * Math.PI) / 180;
      const [cx, cy] = [125, 74];
      const p = (r, d) => [cx + Math.cos(a + d) * r, cy + Math.sin(a + d) * r];
      return ['gold', poly([p(14, -0.12), p(34, 0), p(14, 0.12)])];
    }),
    ['gold', circle(162, 70, 9)],
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return ['gold', poly([[162 + Math.cos(a - 0.2) * 9, 70 + Math.sin(a - 0.2) * 9], [162 + Math.cos(a) * 17, 70 + Math.sin(a) * 17], [162 + Math.cos(a + 0.2) * 9, 70 + Math.sin(a + 0.2) * 9]])];
    }),
  ], { de: 'Sonnenkönig', en: 'Sun king' }),

  // ======== Water: the river, the sea, the brewhouse ========

  // 1 · Der Wasserträger: a yoke over his shoulders, a bucket at either end.
  carrier: {
    names: { de: 'Wasserträger', en: 'Water carrier' },
    parts: [
      ...man(),
      ['wood', limb([[52, 128], [90, 120], [125, 118], [160, 120], [198, 128]], 6)],
      ['wood', limb([[54, 130], [50, 188]], 1.6)],
      ['wood', limb([[196, 130], [200, 188]], 1.6)],
      ...bucket(52, 196, 36, 34),
      ...bucket(198, 196, 36, 34),
      ...arm([[100, 132], [80, 132], [64, 128]]),
      ...arm([[150, 132], [170, 132], [186, 128]]),
      ...head(),
      cap(),
      ...face(),
    ],
  },

  // 2 · Die Wäscherin: sleeves rolled, wringing a sheet over her tub.
  washerwoman: {
    names: { de: 'Wäscherin', en: 'Washerwoman' },
    parts: [
      ...woman(289, 90, 170),
      apron(),
      ['wood', smooth([[24, 248, 1], [94, 248, 1], [88, 290, 1], [30, 290, 1]])],
      ['glow', ellipse(59, 249, 32, 5)],
      ['wood', poly([[56, 184], [92, 184], [92, 250], [56, 250]])],
      ['linen', poly([[60, 194], [88, 194], [88, 240], [60, 240]])],
      ['dark', 'M60,202H88M60,210H88M60,218H88M60,226H88M60,234H88'],
      ['skin', limb([[100, 140], [92, 168], [86, 190]], 11)],
      ['cloth', limb([[100, 132], [99, 146]], 15)],
      ['skin', circle(86, 192, 6)],
      ['skin', limb([[150, 140], [126, 170], [100, 196]], 11)],
      ['cloth', limb([[150, 132], [146, 148]], 15)],
      ['skin', circle(98, 198, 6)],
      ...head(),
      scarf(),
      ...face(),
    ],
  },

  // 3 · Der Flößer: on the logs of his raft, the long pole in his hands.
  raftsman: {
    names: { de: 'Flößer', en: 'Raftsman' },
    parts: [
      ...man(),
      ['wood', limb([[200, 20], [64, 300]], 4.5)],
      ...[22, 50, 78, 106, 134, 162, 190, 218].map((x) => ['wood', ellipse(x, 292, 14, 9)]),
      ...[22, 50, 78, 106, 134, 162, 190, 218].map((x) => ['linen', ellipse(x, 292, 6, 4)]),
      ...arm([[100, 132], [104, 160], [124, 168]]),
      ...arm([[150, 132], [164, 116], [168, 86]]),
      ...head(),
      ...brim(32),
      ...face(),
    ],
  },

  // 4 · Die Netzflickerin: a fishing net over her arm, hanging to the ground.
  netmender: {
    names: { de: 'Netzflickerin', en: 'Net mender' },
    parts: [
      ...woman(289, 84, 164),
      ['linen', smooth([[150, 150], [196, 156], [214, 210], [222, 290, 1], [160, 290, 1], [162, 220]])],
      ['dark', 'M156,170L206,170M158,190L212,190M160,210L216,210M161,230L218,230M162,250L220,250M162,270L221,270M168,152L162,290M180,154L176,290M192,156L190,290M204,160L206,290M214,190L218,290'],
      ...arm([[100, 132], [94, 164], [112, 186]]),
      ...arm([[150, 132], [164, 148], [160, 166]]),
      ['steel', limb([[112, 186], [124, 176]], 1.6)],
      ...head(),
      scarf(),
      ...face(),
    ],
  },

  // 5 · Der Fischer: the rod over his shoulder, a fish on the line, his creel at his hip.
  fisher: {
    names: { de: 'Fischer', en: 'Fisher' },
    parts: [
      ...man(),
      ['wood', limb([[150, 160], [178, 90], [214, 26]], 3.2)],
      ['dark', limb([[214, 26], [222, 60], [222, 112]], 1)],
      ['dark', smooth([[214, 116], [222, 112], [230, 118], [238, 128], [230, 138], [222, 142], [214, 138], [218, 128]])],
      ['dark', poly([[214, 134], [204, 144], [206, 128]])],
      ['glow', circle(226, 122, 2)],
      ['wood', smooth([[84, 200, 1], [108, 200, 1], [106, 232, 1], [86, 232, 1]])],
      ['wood', limb([[96, 200], [128, 138]], 2)],
      ...arm([[98, 134], [92, 166], [98, 192]]),
      ...arm([[152, 132], [160, 150], [152, 162]]),
      ...head(),
      ['wood', smooth([[106, 82], [108, 66], [125, 60], [142, 66], [144, 82]])],
      ['wood', smooth([[96, 84], [154, 84], [146, 90], [104, 90]])],
      ...face(),
    ],
  },

  // 6 · Der Fährmann: leaning on his oar, the bow of his boat beside him.
  ferryman: {
    names: { de: 'Fährmann', en: 'Ferryman' },
    parts: [
      ['dark', smooth([[8, 292, 1], [10, 264], [24, 240], [44, 222, 1], [48, 240], [62, 262], [86, 272], [96, 292, 1]])],
      ['linen', limb([[22, 250], [46, 232]], 2.4)],
      ...man(),
      ['wood', limb([[168, 40], [166, 228]], 4.5)],
      ['wood', smooth([[158, 222, 1], [174, 222, 1], [176, 284, 1], [156, 284, 1]])],
      ...arm([[98, 134], [92, 168], [98, 196]]),
      ...arm([[152, 132], [164, 116], [167, 96]]),
      ...head(),
      beard(124),
      cap(),
      ...eyes(),
    ],
  },

  // 7 · Der Brauer: the mash paddle in his hand, his barrel beside him.
  brewer: {
    names: { de: 'Brauer', en: 'Brewer' },
    parts: [
      ...man(),
      ['linen', smooth([[112, 140, 1], [138, 140, 1], [146, 200], [149, 250, 1], [101, 250, 1], [104, 200]])],
      ['wood', smooth([[24, 222], [76, 222], [84, 256], [76, 290, 1], [24, 290, 1], [16, 256]])],
      ['linen', limb([[19, 238], [81, 238]], 3)],
      ['linen', limb([[19, 274], [81, 274]], 3)],
      ['wood', limb([[166, 46], [166, 200]], 4)],
      ['wood', smooth([[156, 196, 1], [176, 196, 1], [178, 240, 1], [166, 248], [154, 240, 1]])],
      ['linen', circle(166, 210, 3)],
      ['linen', circle(166, 228, 3)],
      ...arm([[98, 134], [92, 168], [98, 196]]),
      ...arm([[152, 132], [162, 118], [165, 98]]),
      ...head(),
      beard(116),
      cap(),
      ...eyes(),
    ],
  },

  // 8 · Der Seekaufmann: in a furred coat and a hat, a ship in his hand, a chest at his feet.
  seamerchant: {
    names: { de: 'Seekaufmann', en: 'Sea merchant' },
    parts: [
      ['cloth', smooth([[108, 121], [125, 128], [142, 121], [156, 134, 1], [154, 180], [164, 289, 1], [86, 289, 1], [96, 180], [94, 134, 1]])],
      ['wool', smooth([[86, 289, 1], [164, 289, 1], [162, 278], [88, 278]])],
      ...feet(),
      ['wood', smooth([[32, 258, 1], [82, 258, 1], [82, 290, 1], [32, 290, 1]])],
      ['wood', smooth([[30, 258, 1], [36, 244], [57, 240], [78, 244], [84, 258, 1]])],
      ['gold', poly([[54, 262], [60, 262], [60, 272], [54, 272]])],
      ...arm([[98, 134], [92, 168], [98, 196]]),
      ...arm([[152, 132], [166, 120], [172, 102]]),
      ['dark', smooth([[150, 92, 1], [196, 92, 1], [190, 104], [156, 104]])],
      ['steel', limb([[173, 92], [173, 46]], 1.6)],
      ['linen', smooth([[175, 50, 1], [194, 62], [194, 86, 1], [175, 86, 1]])],
      ['linen', smooth([[171, 54, 1], [171, 86, 1], [154, 86, 1], [156, 68]])],
      ['wool', smooth([[100, 120], [125, 132], [150, 120], [152, 132], [125, 144], [98, 132]])],
      ...head(),
      beard(114),
      ['cloth2', smooth([[104, 84], [106, 72], [125, 64], [144, 72], [146, 84], [125, 90]])],
      ['cloth', smooth([[110, 72], [114, 58], [125, 54], [136, 58], [140, 72], [125, 70]])],
      ...eyes(),
    ],
  },

  // 9 · Der Pilger: the scallop shell on his broad hat, staff and gourd.
  pilgrim: {
    names: { de: 'Pilger', en: 'Pilgrim' },
    parts: [
      ...robe(),
      ['wood', limb([[94, 196], [156, 196]], 4)],
      ['cloth2', smooth([[96, 128], [154, 128], [164, 176], [125, 184], [86, 176]])],
      ['wood', limb([[180, 292], [178, 40]], 4.5)],
      ['dark', circle(186, 92, 7)],
      ['dark', circle(186, 106, 9)],
      ['dark', limb([[179, 84], [186, 85]], 1.6)],
      ...arm([[98, 134], [90, 168], [98, 194]]),
      ...arm([[152, 132], [166, 148], [176, 140]]),
      ...head(),
      beard(122),
      ['wood', smooth([[106, 82], [108, 66], [125, 58], [142, 66], [144, 82]])],
      ['wood', ellipse(125, 80, 40, 7)],
      ['gold', smooth([[116, 72, 1], [125, 60], [134, 72, 1], [125, 76]])],
      ['dark', 'M125,62L125,74M120,66L123,74M130,66L127,74'],
      ...eyes(),
    ],
  },

  // 10 · Der Seeritter: the anchor on his shield, a spear in his hand.
  seaknight: from('knight', [9, 10, 11, 12, 13, 17], [
    ['steel', limb([[162, 26], [162, 290]], 3)],
    ['steel', poly([[162, 8], [170, 30], [162, 38], [154, 30]])],
    ['metal', circle(162, 186, 7)],
    ['gold', circle(92, 158, 4.6)],
    ['gold', limb([[92, 162], [92, 212]], 3.2)],
    ['gold', limb([[82, 172], [102, 172]], 3)],
    ['gold', limb([[76, 198], [80, 208], [92, 214], [104, 208], [108, 198]], 3)],
  ], { de: 'Seeritter', en: 'Knight of the sea' }),

  // 11 · Die Hafenherrin: pearls at her throat and on her cap, a chalice raised.
  harbourlady: from('duchess', [0, 6, 7, 8, 9, 10, 13, 14], [
    ['gold', smooth([[64, 78, 1], [90, 78, 1], [86, 92], [77, 98], [68, 92]])],
    ['gold', limb([[77, 98], [77, 104]], 2.4)],
    ['gold', ellipse(77, 106, 7, 2.6)],
    ...[112, 118, 125, 132, 138].map((x, i) => ['linen', circle(x, 126 + (i === 2 ? 3 : i % 2 ? 1.5 : 0), 2.6)]),
    ['cloth2', smooth([[108, 88], [110, 72], [125, 64], [140, 72], [142, 88], [125, 82]])],
    ...[112, 125, 138].map((x) => ['linen', circle(x, 76, 2.4)]),
  ], { de: 'Hafenherrin', en: 'Lady of the harbour' }),

  // 12 · Die Meereskönigin: a crown of waves, a shell in her hand.
  seaqueen: from('queen', [8, 9, 15, 16], [
    ...crowns.water(),
    ['linen', smooth([[124, 152], [140, 146], [150, 154], [146, 168], [130, 170], [124, 162]])],
    ['dark', 'M128,160Q136,150 144,156M130,166Q138,158 146,162'],
  ], { de: 'Meereskönigin', en: 'Queen of the sea' }),

  // 13 · Der Seekönig: a crown of waves and the trident.
  seaking: from('king', [11, 12, 19, 20], [
    ...crowns.water(),
    ['gold', poly([[160, 62], [164.5, 62], [163.5, 210], [160.5, 210]])],
    ['gold', smooth([[146, 62, 1], [178, 62, 1], [178, 68, 1], [146, 68, 1]])],
    ['gold', poly([[146, 64], [150, 64], [150, 40], [148, 34], [146, 40]])],
    ['gold', poly([[160, 64], [164.5, 64], [164.5, 32], [162.2, 24], [160, 32]])],
    ['gold', poly([[174, 64], [178, 64], [178, 40], [176, 34], [174, 40]])],
  ], { de: 'Seekönig', en: 'Sea king' }),

  // ======== Earth: the field, the mine, the harvest ========

  // 1 · Die Ährenleserin: a few ears gathered in her apron, more at her feet.
  gleaner: {
    names: { de: 'Ährenleserin', en: 'Gleaner' },
    parts: [
      ['cloth', smooth([[110, 121], [125, 127], [140, 121], [152, 131, 1], [149, 176], [156, 232], [162, 282, 1], [150, 276, 1], [140, 284, 1], [128, 276, 1], [116, 284, 1], [104, 276, 1], [92, 284, 1], [88, 282, 1], [94, 232], [101, 176], [98, 131, 1]])],
      ...feet(),
      ['linen', smooth([[100, 150], [150, 150], [156, 196], [125, 212], [94, 196]])],
      ...[106, 116, 126, 136, 146].map((x, i) => ['gold', ellipse(x, 146 - (i % 2) * 6, 3, 10)]),
      ...[40, 52, 196, 208].map((x, i) => ['gold', ellipse(x, 280 - (i % 2) * 4, 2.6, 8)]),
      ...arm([[100, 132], [96, 160], [106, 186]]),
      ...arm([[150, 132], [154, 160], [144, 186]]),
      ...head(),
      scarf(),
      ...face(),
    ],
  },

  // 2 · Die Gänsemagd: a switch in her hand, two geese at her feet.
  goosegirl: {
    names: { de: 'Gänsemagd', en: 'Goose girl' },
    parts: [
      ...woman(289, 90, 160),
      apron(),
      ['wood', limb([[160, 172], [196, 214], [220, 248]], 1.8)],
      // Two geese at her feet, the second a step behind the first.
      ...[[72, -8], [42, 0]].flatMap(([x, dy]) => [
        ['wool', smooth([[x - 22, 268 + dy], [x - 12, 256 + dy], [x + 6, 254 + dy], [x + 18, 262 + dy], [x + 22, 274 + dy], [x + 8, 282 + dy], [x - 14, 280 + dy]])],
        ['wool', limb([[x - 16, 262 + dy], [x - 22, 240 + dy], [x - 20, 226 + dy]], 6)],
        ['wool', circle(x - 20, 224 + dy, 6)],
        ['gold', poly([[x - 25, 222 + dy], [x - 34, 226 + dy], [x - 25, 228 + dy]])],
        ['gold', limb([[x - 4, 280 + dy], [x - 6, 292]], 2)],
        ['gold', limb([[x + 6, 280 + dy], [x + 6, 292]], 2)],
      ]),
      ...arm([[100, 132], [94, 164], [104, 188]]),
      ...arm([[150, 132], [160, 152], [160, 172]]),
      ...head(),
      coif(),
      ...face(),
    ],
  },

  // 3 · Der Holzfäller: the axe over his shoulder, a stump at his side.
  woodcutter: {
    names: { de: 'Holzfäller', en: 'Woodcutter' },
    parts: [
      ['wood', smooth([[24, 248, 1], [76, 248, 1], [80, 292, 1], [20, 292, 1]])],
      ['linen', ellipse(50, 248, 26, 6)],
      ['dark', 'M50,248m-14,0a14,3.2 0 1 0 28,0a14,3.2 0 1 0 -28,0'],
      ...man(),
      ['wood', limb([[134, 182], [160, 120], [188, 52]], 4.5)],
      ['steel', smooth([[176, 86, 1], [183, 64, 1], [202, 56], [212, 78], [204, 102, 1]])],
      ['steel', poly([[176, 86], [183, 64], [176, 62], [169, 84]])],
      ...arm([[98, 134], [92, 168], [96, 198]]),
      ...arm([[152, 132], [162, 150], [150, 160]]),
      ...head(),
      beard(120),
      cap(),
      ...eyes(),
    ],
  },

  // 6 · Der Bergmann: a pick on his shoulder, his lamp in his hand, the miner's hood.
  miner: {
    names: { de: 'Bergmann', en: 'Miner' },
    parts: [
      ...man(),
      ['wood', limb([[100, 196], [150, 110], [172, 72]], 4.5)],
      ['steel', smooth([[146, 60], [172, 68], [200, 92, 1], [174, 76], [150, 70]])],
      ['steel', limb([[66, 196], [66, 214]], 1.6)],
      ['dark', smooth([[56, 214, 1], [76, 214, 1], [74, 244, 1], [58, 244, 1]])],
      ['glow', ellipse(66, 228, 6, 9)],
      ...arm([[98, 134], [80, 166], [66, 192]]),
      ...arm([[152, 132], [160, 154], [146, 160]]),
      ...head(),
      ['cloth2', smooth([[106, 96], [108, 72], [125, 62], [138, 58], [152, 44, 1], [146, 66], [144, 96], [140, 84], [125, 80], [110, 84]])],
      ...face(),
    ],
  },

  // 7 · Der Steinmetz: mallet and chisel at a block of stone.
  mason: {
    names: { de: 'Steinmetz', en: 'Stonemason' },
    parts: [
      ['linen', poly([[24, 212], [94, 212], [94, 292], [24, 292]])],
      ['dark', 'M38,228L58,234M68,250L86,244M32,270L52,276M60,262L78,268'],
      ...man(),
      ['steel', limb([[104, 204], [90, 220]], 3)],
      ...arm([[98, 134], [94, 170], [104, 202]]),
      ['wood', limb([[166, 94], [150, 72]], 3.4)],
      ['wood', smooth([[132, 74, 1], [150, 60, 1], [160, 70, 1], [142, 84, 1]])],
      ...arm([[152, 132], [170, 118], [166, 94]]),
      ...head(),
      hair(),
      ...eyes(),
    ],
  },

  // 9 · Der Klostergärtner: the monk with his spade, a basket of herbs.
  gardener: from('monk', [4, 5, 6, 7], [
    ...arm([[98, 138], [92, 170], [98, 196]], 12),
    ['wood', limb([[184, 122], [184, 262]], 4.5)],
    ['wood', limb([[176, 122], [192, 122]], 4)],
    ['steel', smooth([[174, 258, 1], [194, 258, 1], [196, 284, 1], [184, 292, 1], [172, 284, 1]])],
    ...arm([[152, 140], [172, 150], [182, 140]], 12),
    ['wood', smooth([[40, 262, 1], [84, 262, 1], [80, 290, 1], [44, 290, 1]])],
    ['wood', limb([[42, 262], [52, 240], [62, 236], [72, 240], [82, 262]], 2.2)],
    ...[[48, 252, -20], [58, 248, 0], [68, 250, 14], [76, 254, 30]].map(([x, y, r]) => ['dark', limb([[x, y + 10], [x + Math.sin((r * Math.PI) / 180) * 12, y - 6]], 4)]),
    ...[[50, 242], [60, 238], [70, 240]].map(([x, y]) => ['gold', circle(x, y, 3.2)]),
  ], { de: 'Klostergärtner', en: 'Monastery gardener' }),

  // 10 · Der Burgvogt: a tower on his shield, the castle's keys in his hand.
  warden: from('knight', [9, 10, 11, 12, 13, 17], [
    ['metal', circle(162, 186, 7)],
    ['gold', 'M162,193m-6,0a6,6 0 1 0 12,0a6,6 0 1 0 -12,0m2.6,0a3.4,3.4 0 1 1 6.8,0a3.4,3.4 0 1 1 -6.8,0z'],
    ['gold', limb([[158, 198], [154, 232]], 2.6)],
    ['gold', poly([[150, 226], [156, 226], [156, 232], [150, 232]])],
    ['gold', limb([[166, 198], [170, 228]], 2.6)],
    ['gold', poly([[168, 222], [174, 222], [174, 228], [168, 228]])],
    ['dark', poly([[80, 208], [80, 172], [84, 172], [84, 166], [89, 166], [89, 172], [95, 172], [95, 166], [100, 166], [100, 172], [104, 172], [104, 208]])],
    ['linen', smooth([[89, 208, 1], [89, 194], [92, 190], [95, 194], [95, 208, 1]])],
  ], { de: 'Burgvogt', en: 'Castle warden' }),

  // 11 · Die Gutsherrin: the horn of plenty in her arm.
  estatelady: from('duchess', [0, 5, 6, 7, 8, 9, 10, 13, 14], [
    ...arm([[98, 132], [90, 170], [100, 196]], 12),
    ['gold', smooth([[132, 196], [150, 196], [164, 180], [174, 156], [178, 136, 1], [160, 146], [146, 164], [134, 180]])],
    ['dark', circle(176, 130, 6)],
    ['glow', circle(166, 132, 5.5)],
    ['dark', circle(184, 138, 5)],
    ['dark', ellipse(172, 120, 3.2, 7)],
    ['cloth2', smooth([[108, 92], [110, 74], [125, 66], [140, 74], [142, 92], [146, 104], [140, 100], [139, 84], [125, 79], [111, 84]])],
    ['gold', limb([[110, 82], [140, 82]], 3)],
  ], { de: 'Gutsherrin', en: 'Lady of the estate' }),

  // 12 · Die Erntekönigin: a crown of wheat, a sheaf in her arm.
  harvestqueen: from('queen', [8, 9, 15, 16], [
    ...crowns.earth(),
    ['gold', smooth([[122, 196, 1], [150, 196, 1], [142, 168], [136, 150], [130, 168]])],
    ...[[-26, 10], [-13, 13], [0, 14], [13, 13], [26, 10]].map(([r, l]) => {
      const a = (r * Math.PI) / 180;
      return ['gold', limb([[136, 150], [136 + Math.sin(a) * l * 1.6, 150 - Math.cos(a) * l * 1.6], [136 + Math.sin(a) * l * 2.6, 150 - Math.cos(a) * l * 2.6]], 6)];
    }),
    ['dark', poly([[128, 162], [144, 162], [144, 167], [128, 167]])],
  ], { de: 'Erntekönigin', en: 'Harvest queen' }),

  // 13 · Der Bergkönig: a crown of oak leaves and a pick of gold.
  mountainking: from('king', [11, 12, 19, 20], [
    ['gold', poly([[108, 82], [108, 74], [142, 74], [142, 82]])],
    ...[[111, 66, -24], [118, 62, -10], [125, 60, 0], [132, 62, 10], [139, 66, 24]].map(([x, y, r]) => ['gold', smooth([[x, y + 12], [x - 5, y + 4], [x - 3, y - 2], [x - 6, y - 8], [x, y - 12], [x + 6, y - 8], [x + 3, y - 2], [x + 5, y + 4]].map(([px, py]) => {
      const a = (r * Math.PI) / 180;
      return [x + (px - x) * Math.cos(a) - (py - y) * Math.sin(a), y + (px - x) * Math.sin(a) + (py - y) * Math.cos(a)];
    }))]),
    ['gold', poly([[160, 70], [164.5, 70], [163.5, 210], [160.5, 210]])],
    ['gold', smooth([[132, 82, 1], [146, 70], [162, 64], [178, 70], [192, 82, 1], [178, 76], [162, 72], [146, 76]])],
  ], { de: 'Bergkönig', en: 'Mountain king' }),

  // ======== Air: the wind, the birds, the bells, the stars ========

  // 1 · Der Vogelfänger: a cage on his back, his net on a pole.
  birdcatcher: {
    names: { de: 'Vogelfänger', en: 'Bird catcher' },
    parts: [
      ['wood', smooth([[58, 110, 1], [104, 110, 1], [104, 176, 1], [58, 176, 1]])],
      ['wood', smooth([[56, 110, 1], [64, 92], [81, 86], [98, 92], [106, 110, 1]])],
      ['linen', poly([[63, 116], [99, 116], [99, 170], [63, 170]])],
      ['dark', 'M72,116V170M81,116V170M90,116V170'],
      ['dark', smooth([[78, 150], [84, 144], [90, 148], [88, 156], [80, 158]])],
      ...man(),
      ['wood', limb([[150, 200], [176, 120], [192, 70]], 3)],
      ['wool', 'M192,66m-18,0a18,14 0 1 0 36,0a18,14 0 1 0 -36,0'],
      ['dark', 'M180,58L204,74M178,70L200,82M186,54L206,64M176,64L196,54M184,80L204,58'],
      ...arm([[98, 134], [90, 166], [96, 196]]),
      ...arm([[152, 132], [164, 150], [164, 166]]),
      ...head(),
      ['gold', limb([[112, 78], [104, 56], [100, 44]], 3)],
      cap(),
      ...face(),
    ],
  },

  // 2 · Die Taubenmagd: doves rising from her hands.
  dovekeeper: {
    names: { de: 'Taubenmagd', en: 'Dove keeper' },
    parts: [
      ...woman(289, 86, 166),
      apron(),
      ...arm([[100, 132], [86, 114], [78, 92]]),
      ...arm([[150, 132], [164, 114], [172, 92]]),
      ...[[60, 112, -1], [186, 58, 1], [124, 30, 1]].flatMap(([x, y, k]) => [
        ['wool', smooth([[x - 14 * k, y + 4], [x - 4 * k, y - 2], [x + 10 * k, y], [x + 16 * k, y + 6], [x + 4 * k, y + 10], [x - 10 * k, y + 10]])],
        ['wool', smooth([[x - 4 * k, y], [x - 10 * k, y - 18], [x + 4 * k, y - 22], [x + 6 * k, y - 4]])],
        ['wool', circle(x + 14 * k, y + 1, 4.6)],
        ['gold', poly([[x + 18 * k, y], [x + 24 * k, y + 2], [x + 18 * k, y + 4]])],
      ]),
      ...head(),
      scarf(),
      ...face(),
    ],
  },

  // 3 · Der Turmbläser: blowing the hour from the wall on his long horn.
  trumpeter: {
    names: { de: 'Turmbläser', en: 'Tower trumpeter' },
    parts: [
      ['dark', poly([[14, 292], [14, 238], [26, 238], [26, 228], [40, 228], [40, 238], [56, 238], [56, 228], [70, 228], [70, 238], [82, 238], [82, 292]])],
      ...man(),
      ['dark', limb([[136, 104], [212, 64]], 4)],
      ['dark', poly([[206, 58], [234, 38], [240, 74], [210, 70]])],
      ...arm([[98, 134], [126, 132], [150, 104]]),
      ...arm([[152, 132], [172, 124], [182, 88]]),
      ...head(),
      cap(),
      ...eyes(),
    ],
  },

  // 4 · Die Imkerin: her straw skep in her arms, bees around it.
  beekeeper: {
    names: { de: 'Imkerin', en: 'Beekeeper' },
    parts: [
      ...woman(289, 84, 166),
      ['gold', smooth([[98, 196, 1], [152, 196, 1], [150, 176], [140, 156], [125, 148], [110, 156], [100, 176]])],
      ['dark', 'M101,186H149M104,172H146M112,160H138'],
      ['dark', smooth([[120, 196, 1], [130, 196, 1], [130, 186], [125, 182], [120, 186]])],
      ...arm([[100, 132], [92, 168], [104, 192]]),
      ...arm([[150, 132], [158, 168], [146, 192]]),
      ...[[70, 140], [184, 128], [176, 168], [60, 186], [196, 96]].flatMap(([x, y]) => [
        ['dark', ellipse(x, y, 4.2, 3)],
        ['wool', ellipse(x - 1, y - 4.4, 2.4, 3.2)],
        ['wool', ellipse(x + 2.4, y - 4.2, 2.4, 3.2)],
      ]),
      ...head(),
      ['wood', smooth([[106, 82], [108, 68], [125, 62], [142, 68], [144, 82]])],
      ['wood', ellipse(125, 82, 30, 5.4)],
      ['linen', smooth([[96, 84], [154, 84], [150, 116], [100, 116]])],
      ...eyes(),
    ],
  },

  // 5 · Der Spielmann: the bagpipe under his arm, one leg up in a dance, a feather in his cap.
  minstrel: {
    names: { de: 'Spielmann', en: 'Minstrel' },
    parts: [
      ['dark', limb([[113, 230], [110, 286]], 13)],
      ['dark', ellipse(107, 289, 11, 4.5)],
      ['dark', limb([[137, 230], [158, 252], [152, 274]], 13)],
      ['dark', ellipse(156, 278, 10, 4.5)],
      ['cloth', smooth([[108, 121], [125, 126], [142, 121], [156, 131, 1], [152, 180], [157, 236, 1], [93, 236, 1], [98, 180], [94, 131, 1]])],
      ['dark', poly([[97, 178], [153, 178], [153.5, 185], [96.5, 185]])],
      ['dark', smooth([[84, 150], [112, 140], [124, 158], [118, 182], [92, 186], [78, 172]])],
      ['wood', limb([[86, 152], [54, 110]], 4)],
      ['wood', limb([[96, 146], [80, 92]], 4)],
      ['wood', limb([[90, 182], [70, 228]], 4)],
      ['wood', limb([[112, 144], [130, 110]], 3)],
      ...arm([[100, 132], [98, 150], [104, 170]]),
      ...arm([[150, 132], [154, 170], [100, 186]]),
      ...head(),
      ['cloth2', smooth([[108, 84], [110, 70], [125, 63], [140, 70], [142, 84], [125, 80]])],
      ['gold', limb([[138, 72], [156, 50], [170, 40]], 3)],
      ...face(),
    ],
  },

  // 7 · Der Segelmacher: the needle in his hand, a sail swelling from it.
  sailmaker: {
    names: { de: 'Segelmacher', en: 'Sailmaker' },
    parts: [
      ['linen', smooth([[150, 60, 1], [206, 92], [226, 150], [210, 210], [158, 240, 1], [176, 150]])],
      ['dark', 'M170,90Q196,150 172,226M188,82Q216,150 190,220'],
      ...man(),
      ['steel', limb([[148, 168], [164, 150]], 2)],
      ['dark', limb([[164, 150], [186, 120]], 0.9)],
      ...arm([[98, 134], [92, 168], [98, 196]]),
      ...arm([[152, 132], [162, 158], [148, 168]]),
      ...head(),
      hair(),
      beard(114),
      ...eyes(),
    ],
  },

  // 8 · Der Sterndeuter: under a hat sewn with stars, holding his astrolabe up to the sky.
  astrologer: {
    names: { de: 'Sterndeuter', en: 'Astrologer' },
    parts: [
      ...robe(),
      ['gold', star(104, 236, 5)],
      ['gold', star(144, 260, 4)],
      ...arm([[98, 134], [88, 166], [94, 194]]),
      ...arm([[152, 132], [166, 112], [172, 90]]),
      ['dark', 'M174,62m-22,0a22,22 0 1 0 44,0a22,22 0 1 0 -44,0m5,0a17,17 0 1 1 34,0a17,17 0 1 1 -34,0z'],
      ['linen', circle(174, 62, 17)],
      ['dark', limb([[160, 52], [188, 72]], 2.4)],
      ['dark', circle(174, 62, 4)],
      ['dark', circle(174, 36, 4.4)],
      ['gold', star(214, 30, 7)],
      ['gold', star(36, 70, 6)],
      ...head(),
      ['wool', smooth([[112, 98], [116, 120], [125, 140, 1], [134, 120], [138, 98], [132, 108], [125, 110], [118, 108]])],
      ['cloth2', smooth([[106, 82], [114, 60], [125, 36, 1], [136, 60], [144, 82]])],
      ['cloth2', ellipse(125, 82, 26, 5)],
      ['gold', star(125, 64, 4.5)],
      ...eyes(),
    ],
  },

  // 9 · Der Glöckner: pulling the rope, the bell swinging above him.
  bellringer: from('monk', [4, 5, 6, 7], [
    ['gold', smooth([[132, 54, 1], [136, 34], [152, 22], [168, 34], [172, 54, 1], [178, 60, 1], [126, 60, 1]])],
    ['gold', circle(152, 64, 4)],
    ['wood', limb([[152, 64], [152, 196]], 2)],
    ...arm([[104, 134], [126, 122], [148, 112]], 12),
    ...arm([[148, 136], [160, 152], [154, 166]], 12),
  ], { de: 'Glöckner', en: 'Bell ringer' }),

  // 10 · Der Bannerträger: the banner flying from his pole.
  bannerman: from('knight', [9, 10, 11, 12, 13], [
    ['wood', limb([[162, 22], [162, 290]], 4)],
    ['gold', circle(162, 20, 4)],
    ['linen', smooth([[164, 30, 1], [214, 36], [236, 50], [214, 58], [232, 74], [206, 74], [164, 70, 1]])],
    ['gold', limb([[166, 50], [214, 54]], 3)],
    ['metal', circle(162, 186, 7)],
  ], { de: 'Bannerträger', en: 'Standard bearer' }),

  // 12 · Die Sternenkönigin: a crown of stars, her veil blowing, a star in her hand.
  starqueen: from('queen', [8, 9, 15, 16], [
    ...crowns.air(),
    ['gold', star(134, 158, 9)],
  ], { de: 'Sternenkönigin', en: 'Queen of the stars' }),

  // 13 · Der Sturmkönig: an eagle on his arm, his cloak in the wind.
  stormking: from('king', [0, 6, 11, 12, 13], [
    ['cloth', limb([[152, 134], [170, 126], [178, 106]], 16)],
    ['skin', circle(178, 102, 6.5)],
    ['dark', smooth([[170, 80], [158, 62], [142, 44], [132, 40, 1], [136, 54], [126, 56, 1], [138, 64], [130, 70, 1], [148, 76], [166, 90]])],
    ['dark', smooth([[186, 80], [198, 62], [214, 44], [224, 40, 1], [220, 54], [230, 56, 1], [218, 64], [226, 70, 1], [208, 76], [190, 90]])],
    ['dark', smooth([[168, 98], [168, 76], [178, 68], [188, 76], [188, 98], [178, 104]])],
    ['dark', poly([[170, 96], [164, 112], [178, 106], [192, 112], [186, 96]])],
    ['dark', circle(178, 62, 7.5)],
    ['linen', poly([[184, 60], [194, 64], [184, 67]])],
    ['glow', circle(180, 60, 1.8)],
  ], { de: 'Sturmkönig', en: 'Storm king' }),
};

// The air's queen veil and the storm king's cloak blow behind them.
PEOPLE_FIGURES.starqueen = behind(PEOPLE_FIGURES.starqueen, [
  ['cloth2', smooth([[136, 80], [168, 92], [200, 112], [232, 104, 1], [216, 128], [236, 146, 1], [200, 150], [170, 136], [146, 112]])],
]);
PEOPLE_FIGURES.stormking = behind(PEOPLE_FIGURES.stormking, [
  ['cloth2', smooth([[96, 124, 1], [154, 124, 1], [190, 168], [232, 196, 1], [212, 214], [236, 248, 1], [204, 250], [180, 290, 1], [72, 290, 1], [78, 200]])],
]);

/** Who stands on each number in each element (index 0 is empty). A string is one of figures.js's people. */
export const PEOPLE = {
  fire: [null, 'ashgirl', 'cook', 'burner', 'chandler', 'baker', 'glassblower', 'smith', 'alchemist', 'censer', 'dragonslayer', 'castlelady', 'firequeen', 'sunking'],
  water: [null, 'carrier', 'washerwoman', 'raftsman', 'netmender', 'fisher', 'ferryman', 'brewer', 'seamerchant', 'pilgrim', 'seaknight', 'harbourlady', 'seaqueen', 'seaking'],
  earth: [null, 'gleaner', 'goosegirl', 'woodcutter', 'shepherdess', 'farmer', 'miner', 'mason', 'merchant', 'gardener', 'warden', 'estatelady', 'harvestqueen', 'mountainking'],
  air: [null, 'birdcatcher', 'dovekeeper', 'trumpeter', 'beekeeper', 'minstrel', 'miller', 'sailmaker', 'astrologer', 'bellringer', 'bannerman', 'duchess', 'starqueen', 'stormking'],
};

/** The person on a number card of an element: their drawing and their names. */
export function personOf(suit, value) {
  const id = PEOPLE[suit][value];
  return PEOPLE_FIGURES[id] ?? FIGURES[id];
}
