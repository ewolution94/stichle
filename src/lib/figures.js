// The people on the figure cards (the user's pick, 2026-10-12: C, the paper cut): who stands on each
// number, from the beggar at 1 to the king at 13, plus the Wizard and the Jester. Each is drawn once
// as layered parts in the card's 250 × 350 space, standing on the ground at y ≈ 292, and printed as a
// black silhouette (src/lib/deck.ts puts it on the card). The parts keep their roles (a dress, a
// face, a bucket …) so another way of printing them stays possible; the paper cut shows only the
// outline, plus what stays bright: gold, the element's glow, white wool and linen, the suit's sign.
//
// Plain JavaScript with its types beside it (figures.d.ts), so the same file can be loaded by a
// review page in the workspace (plans/stichle/figures.html).

const F = (n) => Math.round(n * 10) / 10;

/** Catmull-Rom through points [x, y, corner?]; a corner point gets sharp tangents (Vollmond's kit). */
function smooth(pts, closed = true, k = 0.2) {
  const n = pts.length;
  const P = (i) => pts[(i + n) % n];
  let d = `M${F(pts[0][0])},${F(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const s1 = p1[2] || (!closed && i === 0);
    const s2 = p2[2] || (!closed && i === n - 2);
    const c1 = s1 ? p1 : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = s2 ? p2 : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${F(c1[0])},${F(c1[1])} ${F(c2[0])},${F(c2[1])} ${F(p2[0])},${F(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const poly = (p) => 'M' + p.map(([x, y]) => `${F(x)},${F(y)}`).join('L') + 'Z';
const ellipse = (cx, cy, rx, ry) => `M${F(cx - rx)},${F(cy)}a${F(rx)},${F(ry)} 0 1 0 ${F(2 * rx)},0a${F(rx)},${F(ry)} 0 1 0 ${F(-2 * rx)},0Z`;
const circle = (cx, cy, r) => ellipse(cx, cy, r, r);
/** A limb: a band of width w along a smooth line of points, square at both ends. */
function limb(pts, w) {
  const out = [];
  const back = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
    out.push([pts[i][0] + nx, pts[i][1] + ny]);
    back.unshift([pts[i][0] - nx, pts[i][1] - ny]);
  }
  out[0][2] = 1;
  back[back.length - 1][2] = 1;
  out[out.length - 1][2] = 1;
  back[0][2] = 1;
  return smooth([...out, ...back]);
}
/** A small four-pointed star. */
function star(x, y, r) {
  const k = r * 0.3;
  return poly([[x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]]);
}

const head = (cx = 125, cy = 92, rx = 14.5, ry = 17.5) => [
  ['skin', poly([[cx - 6, cy + 12], [cx + 6, cy + 12], [cx + 7, cy + 32], [cx - 7, cy + 32]])],
  ['skin', ellipse(cx, cy, rx, ry)],
];
const face = (cx = 125, cy = 92) => [
  ['feature', circle(cx - 5.6, cy + 1, 1.5)],
  ['feature', circle(cx + 5.6, cy + 1, 1.5)],
  ['line', `M${cx - 3.2},${cy + 10}Q${cx},${cy + 12} ${cx + 3.2},${cy + 10}`],
];
const legs = (y0 = 230) => [
  ['dark', limb([[113, y0], [110, 286]], 13)],
  ['dark', limb([[137, y0], [140, 286]], 13)],
  ['dark', ellipse(107, 289, 11, 4.5)],
  ['dark', ellipse(143, 289, 11, 4.5)],
];
const feet = () => [['dark', ellipse(110, 291, 10, 4.5)], ['dark', ellipse(140, 291, 10, 4.5)]];
const gown = (hem = 289, left = 82, right = 168) => smooth([[110, 121], [125, 127], [140, 121], [152, 131, 1], [149, 176], [158, 232], [right, hem, 1], [left, hem, 1], [92, 232], [101, 176], [98, 131, 1]]);

export const FIGURES = {
  // 1 · Der Bettler: hunched in a ragged cloak, on a crutch, holding out a bowl with a coin in it.
  beggar: {
    names: { de: 'Bettler', en: 'Beggar' },
    parts: [
      ['wood', limb([[76, 150], [71, 220], [64, 290]], 4.5)],
      ['cloth', limb([[100, 146], [86, 170], [76, 186]], 11)],
      ['skin', circle(74, 188, 5.5)],
      ['skin', ellipse(134, 290, 8, 4)],
      ['skin', ellipse(152, 290, 8, 4)],
      ['cloth', smooth([[122, 94], [142, 92], [156, 104], [160, 130], [158, 172], [163, 230], [167, 284, 1], [158, 277, 1], [149, 288, 1], [140, 278, 1], [130, 288, 1], [120, 278, 1], [110, 288, 1], [100, 279, 1], [91, 286, 1], [93, 236], [90, 180], [93, 132], [104, 106]])],
      ['skin', ellipse(149, 115, 7, 9)],
      ['cloth', limb([[150, 146], [166, 160], [178, 168]], 12)],
      ['skin', circle(181, 170, 5.5)],
      ['wood', 'M172,174L204,174Q202,189 188,189Q174,189 172,174Z'],
      ['gold', circle(186, 171, 3.4)],
    ],
  },


  // 2 · Die Magd: fetching water, in a coif and apron, a bucket in her hand.
  maid: {
    names: { de: 'Magd', en: 'Maid' },
    parts: [
      ['cloth', gown(289, 79, 171)],
      ...feet(),
      ['cloth2', smooth([[110, 148], [140, 148, 1], [146, 210], [150, 270, 1], [100, 270, 1], [104, 210], [110, 148, 1]])],
      ['cloth', limb([[101, 132], [93, 160], [88, 196]], 15)],
      ['skin', circle(88, 203, 6.5)],
      ['wood', smooth([[66, 216, 1], [104, 216, 1], [99, 252, 1], [71, 252, 1]])],
      ['glow', ellipse(85, 217, 17, 3.6)],
      ['wood', limb([[67, 216], [76, 202], [85, 198], [94, 202], [103, 216]], 2.4)],
      ['cloth', limb([[149, 132], [162, 158], [150, 183]], 14)],
      ['skin', circle(146, 186, 6)],
      ...head(),
      ['linen', smooth([[107, 96], [108, 74], [125, 64], [142, 74], [143, 96], [140, 112, 1], [137, 88], [125, 79], [113, 88], [110, 112, 1]])],
      ...face(),
    ],
  },

  // 3 · Der Knecht: a farmhand in a straw hat, the pitchfork upright beside him.
  farmhand: {
    names: { de: 'Knecht', en: 'Farmhand' },
    parts: [
      ...legs(),
      ['cloth', smooth([[108, 121], [125, 126], [142, 121], [156, 131, 1], [152, 180], [157, 236, 1], [93, 236, 1], [98, 180], [94, 131, 1]])],
      ['dark', poly([[97, 178], [153, 178], [153.5, 185], [96.5, 185]])],
      ['cloth', limb([[96, 132], [88, 168], [92, 198]], 13)],
      ['skin', circle(93, 202, 6)],
      ['wood', limb([[170, 290], [168, 62]], 4.5)],
      ['steel', poly([[152, 60], [184, 60], [184, 66], [152, 66]])],
      ['steel', limb([[154, 62], [154, 30]], 3)],
      ['steel', limb([[168, 62], [168, 24]], 3)],
      ['steel', limb([[182, 62], [182, 30]], 3)],
      ['cloth', limb([[154, 132], [166, 150], [168, 164]], 13)],
      ['skin', circle(168, 168, 6)],
      ...head(),
      ['wood', smooth([[108, 79], [110, 63], [125, 57], [140, 63], [142, 79]])],
      ['wood', ellipse(125, 79, 31, 6)],
      ...face(),
    ],
  },

  // 4 · Die Hirtin: a shepherdess with her crook, a lamb at her feet.
  shepherdess: {
    names: { de: 'Hirtin', en: 'Shepherdess' },
    parts: [
      ['cloth', gown(289, 86, 166)],
      ...feet(),
      ['cloth2', smooth([[98, 128], [125, 150], [152, 128], [156, 146], [125, 172], [94, 146]])],
      ['wood', limb([[174, 290], [172, 64], [172, 50], [178, 41], [188, 42], [193, 51], [187, 59]], 4.5)],
      ['cloth', limb([[150, 132], [164, 150], [172, 158]], 13)],
      ['skin', circle(172, 160, 6)],
      ['cloth', limb([[100, 134], [100, 160], [116, 168]], 13)],
      ['skin', circle(119, 168, 5.5)],
      // The lamb.
      ['dark', limb([[64, 272], [63, 290]], 3.2)],
      ['dark', limb([[72, 275], [72, 290]], 3.2)],
      ['dark', limb([[87, 275], [87, 290]], 3.2)],
      ['dark', limb([[95, 271], [96, 290]], 3.2)],
      ['wool', smooth([[56, 262], [60, 251], [72, 246], [86, 248], [98, 254], [102, 266], [94, 276], [76, 279], [62, 274]])],
      ['dark', ellipse(52, 258, 7.5, 6)],
      ['dark', ellipse(58, 252, 5, 2.4)],
      ...head(),
      ['cloth2', smooth([[108, 92], [110, 74], [125, 66], [140, 74], [142, 92], [146, 104], [140, 100], [139, 84], [125, 79], [111, 84]])],
      ...face(),
    ],
  },

  // 5 · Der Bauer: a farmer with the scythe over his shoulder and a sheaf of wheat at his feet.
  farmer: {
    names: { de: 'Bauer', en: 'Farmer' },
    parts: [
      ...legs(238),
      ['cloth', smooth([[108, 121], [125, 126], [142, 121], [156, 131, 1], [152, 182], [158, 244, 1], [92, 244, 1], [98, 182], [94, 131, 1]])],
      ['gold', smooth([[48, 290, 1], [70, 290, 1], [66, 262], [76, 230], [63, 224], [61, 206], [58, 224], [45, 230], [53, 262]])],
      ['dark', poly([[50, 258], [68, 258], [68, 264], [50, 264]])],
      ['wood', limb([[96, 238], [134, 162], [174, 84]], 5)],
      ['steel', smooth([[177, 86, 1], [158, 62], [127, 51], [93, 56, 1], [124, 59], [153, 70]])],
      ['cloth', limb([[96, 132], [100, 168], [116, 196]], 13)],
      ['skin', circle(118, 198, 6)],
      ['cloth', limb([[154, 132], [152, 144], [143, 150]], 13)],
      ['skin', circle(141, 149, 6)],
      ['cloth2', smooth([[100, 118], [125, 124], [150, 118], [160, 138], [125, 152], [90, 138]])],
      ...head(),
      ['hair', smooth([[110, 96], [112, 110], [125, 116], [138, 110], [140, 96], [135, 104], [125, 106], [115, 104]])],
      ['cloth2', smooth([[108, 82], [110, 68], [125, 62], [140, 68], [142, 82]])],
      ['cloth2', ellipse(125, 82, 20, 4)],
      ['feature', circle(119.4, 93, 1.5)],
      ['feature', circle(130.6, 93, 1.5)],
    ],
  },

  // 6 · Die Müllerin: a miller with a sack of flour on her shoulder, her windmill behind her.
  miller: {
    names: { de: 'Müllerin', en: 'Miller' },
    parts: [
      ['dark', limb([[57, 206], [82, 181]], 8)],
      ['dark', limb([[57, 206], [32, 181]], 8)],
      ['dark', limb([[57, 206], [82, 231]], 8)],
      ['dark', limb([[57, 206], [32, 231]], 8)],
      ['dark', poly([[40, 292], [74, 292], [66, 214], [48, 214]])],
      ['dark', poly([[44, 216], [70, 216], [57, 200]])],
      ['cloth', gown(289, 82, 164)],
      ...feet(),
      ['linen', smooth([[110, 150], [140, 150, 1], [145, 210], [148, 266, 1], [102, 266, 1], [105, 210], [110, 150, 1]])],
      ['cloth', limb([[100, 132], [88, 158], [100, 182]], 14)],
      ['skin', circle(104, 185, 6)],
      ['cloth', limb([[150, 132], [160, 120], [164, 108]], 13)],
      ['wool', smooth([[162, 90], [156, 79, 1], [165, 84], [174, 78, 1], [171, 91], [184, 104], [190, 126], [181, 145], [161, 149], [146, 137], [146, 113], [153, 98]])],
      ['dark', limb([[157, 92], [173, 92]], 4.2)],
      ['skin', circle(162, 112, 6)],
      ...head(),
      ['cloth2', smooth([[108, 92], [110, 74], [125, 66], [140, 74], [142, 92], [139, 84], [125, 79], [111, 84]])],
      ...face(),
    ],
  },


  // 7 · Der Schmied: the hammer raised, tongs and a red-hot iron on the anvil at his side.
  smith: {
    names: { de: 'Schmied', en: 'Smith' },
    parts: [
      ['dark', limb([[112, 226], [109, 284]], 15)],
      ['dark', limb([[138, 226], [141, 284]], 15)],
      ['dark', ellipse(106, 289, 12, 5)],
      ['dark', ellipse(144, 289, 12, 5)],
      ['cloth', smooth([[107, 120], [125, 126], [143, 120], [162, 131, 1], [158, 182], [162, 236, 1], [88, 236, 1], [92, 182], [88, 131, 1]])],
      ['cloth2', smooth([[112, 140, 1], [138, 140, 1], [146, 200], [149, 250, 1], [101, 250, 1], [104, 200]])],
      ['steel', smooth([[44, 258, 1], [98, 258, 1], [98, 266, 1], [88, 268, 1], [86, 280], [96, 292, 1], [56, 292, 1], [66, 280], [64, 268, 1], [52, 268, 1], [36, 262]])],
      ['skin', limb([[92, 160], [86, 182], [84, 202]], 12)],
      ['cloth', limb([[93, 132], [90, 152], [89, 164]], 17)],
      ['skin', circle(84, 205, 6.5)],
      ['steel', limb([[84, 208], [80, 236], [76, 252]], 3.2)],
      ['steel', limb([[86, 208], [86, 236], [84, 252]], 3.2)],
      ['glow', smooth([[64, 250, 1], [90, 250, 1], [90, 258, 1], [64, 258, 1]])],
      ['skin', limb([[170, 118], [176, 98], [174, 78]], 12)],
      ['cloth', limb([[155, 132], [166, 124], [172, 116]], 17)],
      ['wood', limb([[174, 80], [170, 60], [167, 44]], 6)],
      ['steel', smooth([[152, 36, 1], [182, 32, 1], [184, 46, 1], [154, 50, 1]])],
      ['skin', circle(174, 79, 6.8)],
      ['skin', poly([[118, 104], [132, 104], [133, 124], [117, 124]])],
      ['skin', ellipse(125, 92, 15, 17.5)],
      ['hair', smooth([[109, 94], [111, 112], [125, 122], [139, 112], [141, 94], [136, 104], [125, 106], [114, 104]])],
      ['hair', smooth([[110, 86], [113, 74], [125, 70], [137, 74], [140, 86], [134, 79], [125, 77], [116, 79]])],
      ['feature', circle(119.4, 93, 1.5)],
      ['feature', circle(130.6, 93, 1.5)],
    ],
  },

  // 8 · Die Kauffrau: a merchant in a fur-trimmed gown and a rolled hat, holding up her scales.
  merchant: {
    names: { de: 'Kauffrau', en: 'Merchant' },
    parts: [
      ['cloth', gown(289, 78, 172)],
      ['cloth2', smooth([[78, 289, 1], [172, 289, 1], [168, 276], [82, 276]])],
      ...feet(),
      ['dark', limb([[100, 176], [100, 186]], 2)],
      ['dark', smooth([[94, 186], [106, 186], [110, 206], [101, 213], [91, 206]])],
      ['cloth', limb([[98, 132], [92, 166], [98, 182]], 13)],
      ['skin', circle(100, 184, 6)],
      ['cloth', limb([[152, 132], [166, 120], [172, 104]], 12)],
      ['skin', circle(172, 102, 5.5)],
      ['gold', limb([[172, 98], [172, 84]], 3)],
      ['gold', limb([[148, 84], [196, 84]], 3.2)],
      ['gold', circle(172, 82, 3.2)],
      ['gold', limb([[150, 84], [144, 108]], 1.5)],
      ['gold', limb([[150, 84], [156, 108]], 1.5)],
      ['gold', 'M140,108H160Q158,117 150,117Q142,117 140,108Z'],
      ['gold', limb([[194, 84], [188, 104]], 1.5)],
      ['gold', limb([[194, 84], [200, 104]], 1.5)],
      ['gold', 'M184,104H204Q202,113 194,113Q186,113 184,104Z'],
      ['cloth2', smooth([[100, 120], [125, 132], [150, 120], [152, 132], [125, 144], [98, 132]])],
      ...head(),
      ['cloth2', smooth([[104, 84], [106, 72], [125, 64], [144, 72], [146, 84], [125, 90]])],
      ['cloth', smooth([[110, 72], [114, 58], [125, 54], [136, 58], [140, 72], [125, 70]])],
      ...face(),
    ],
  },

  // 9 · Der Mönch: hooded, in a long habit and a rope belt, holding a book.
  monk: {
    names: { de: 'Mönch', en: 'Monk' },
    parts: [
      ['cloth', smooth([[106, 118], [125, 126], [144, 118], [160, 134, 1], [158, 186], [166, 290, 1], [84, 290, 1], [92, 186], [90, 134, 1]])],
      ['wood', limb([[94, 196], [156, 196]], 4)],
      ['wood', limb([[134, 196], [136, 244]], 3)],
      ['gold', poly([[134, 244], [138, 244], [138, 250], [143, 250], [143, 254], [138, 254], [138, 264], [134, 264], [134, 254], [129, 254], [129, 250], [134, 250]])],
      ['cloth', smooth([[96, 138], [125, 158], [154, 138], [158, 172], [125, 184], [92, 172]])],
      ['gold', poly([[111, 150], [139, 150], [141, 172], [109, 172]])],
      ['dark', poly([[124, 154], [126, 154], [126, 168], [124, 168]])],
      ['dark', poly([[119, 158], [131, 158], [131, 160], [119, 160]])],
      ['skin', ellipse(125, 98, 11, 14)],
      ['cloth', smooth([[102, 108], [104, 82], [114, 66], [125, 60], [136, 66], [146, 82], [148, 108], [152, 128, 1], [98, 128, 1], [104, 112], [112, 96], [114, 84], [125, 80], [136, 84], [138, 96], [146, 112]])],
      ['feature', circle(120.5, 98, 1.4)],
      ['feature', circle(129.5, 98, 1.4)],
    ],
  },

  // 10 · Der Ritter: a knight in a great helm and surcoat, sword up, the suit's sign on his shield.
  knight: {
    names: { de: 'Ritter', en: 'Knight' },
    parts: [
      ['metal', limb([[113, 236], [110, 284]], 15)],
      ['metal', limb([[137, 236], [140, 284]], 15)],
      ['steel', ellipse(107, 289, 12, 5)],
      ['steel', ellipse(143, 289, 12, 5)],
      ['metal', smooth([[106, 120], [125, 125], [144, 120], [160, 131, 1], [156, 176], [94, 176], [90, 131, 1]])],
      ['cloth', smooth([[108, 126], [125, 130], [142, 126], [150, 134, 1], [150, 182], [158, 246, 1], [92, 246, 1], [100, 182], [100, 134, 1]])],
      ['dark', poly([[99, 180], [151, 180], [151.5, 188], [98.5, 188]])],
      ['gold', circle(125, 184, 4.2)],
      ['metal', limb([[156, 136], [166, 156], [162, 176]], 13)],
      ['steel', poly([[159, 56], [165, 56], [165, 172], [159, 172]])],
      ['metal', poly([[160.5, 52], [163.5, 52], [165, 58], [159, 58]])],
      ['gold', smooth([[146, 172, 1], [178, 172, 1], [178, 178, 1], [146, 178, 1]])],
      ['dark', poly([[159, 178], [165, 178], [165, 196], [159, 196]])],
      ['gold', circle(162, 199, 4.4)],
      ['metal', circle(162, 186, 7)],
      ['metal', limb([[96, 134], [88, 156]], 13)],
      ['linen', smooth([[66, 146, 1], [118, 146, 1], [117, 192], [92, 232, 1], [67, 192]])],
      ['emblem', ''],
      ['cloth', smooth([[124, 66], [138, 54], [156, 50], [150, 60], [136, 70]])],
      ['metal', smooth([[109, 112, 1], [109, 80], [114, 70], [125, 66], [136, 70], [141, 80], [141, 112, 1]])],
      ['dark', poly([[112, 88], [138, 88], [138, 92], [112, 92]])],
    ],
  },

  // 11 · Die Fürstin: a duchess in a tall hennin with its veil, a falcon on her raised glove.
  duchess: {
    names: { de: 'Fürstin', en: 'Duchess' },
    parts: [
      ['wool', smooth([[160, 18], [174, 42], [178, 92], [170, 142], [160, 172], [154, 140], [158, 96], [154, 52]])],
      ['cloth', smooth([[110, 122], [125, 128], [140, 122], [152, 132, 1], [148, 170], [160, 232], [176, 290, 1], [62, 290, 1], [82, 262], [96, 226], [102, 170], [98, 132, 1]])],
      ['gold', poly([[101, 158], [149, 158], [149, 163], [101, 163]])],
      ['cloth', limb([[150, 132], [160, 168], [152, 196]], 12)],
      ['skin', circle(151, 199, 5.5)],
      ['cloth', limb([[98, 132], [84, 120], [77, 102]], 12)],
      ['dark', circle(76, 98, 6.5)],
      ['dark', limb([[76, 92], [72, 108]], 5)],
      ['dark', smooth([[70, 92], [66, 78], [70, 68], [78, 63], [86, 67], [88, 79], [84, 91], [78, 96]])],
      ['dark', circle(80, 61, 6)],
      ['dark', poly([[85, 59], [91, 62], [85, 65]])],
      ...head(125, 94, 13.5, 16.5),
      ['cloth2', poly([[107, 86], [139, 76], [162, 16]])],
      ['gold', limb([[107, 86], [139, 77]], 4)],
      ...face(125, 94),
    ],
  },

  // 12 · Die Königin: a queen with long hair and a crown, a rose in her hand, her mantle behind her.
  queen: {
    names: { de: 'Königin', en: 'Queen' },
    parts: [
      ['cloth2', smooth([[98, 124, 1], [152, 124, 1], [168, 200], [176, 290, 1], [74, 290, 1], [82, 200]])],
      ['cloth', gown(289, 86, 164)],
      ...feet(),
      ['cloth', smooth([[96, 134], [86, 160], [78, 232], [92, 234], [100, 176]])],
      ['cloth', limb([[100, 134], [96, 168], [102, 194]], 12)],
      ['skin', circle(103, 197, 5.5)],
      ['cloth', limb([[150, 134], [158, 160], [138, 170]], 12)],
      ['dark', limb([[134, 162], [133, 182]], 1.8)],
      ['glow', smooth([[127, 156], [129, 150], [134, 148], [140, 150], [141, 157], [134, 163]])],
      ['skin', circle(134, 171, 5.5)],
      ['hair', smooth([[108, 84], [112, 70], [125, 66], [138, 70], [142, 84], [146, 130], [136, 134], [138, 96], [125, 92], [112, 96], [114, 134], [104, 130]])],
      ...head(),
      ['gold', limb([[112, 126], [125, 134], [138, 126]], 2.6)],
      ['gold', poly([[110, 80], [110, 64], [116, 72], [120, 60], [125, 70], [130, 60], [134, 72], [140, 64], [140, 80]])],
      ['glow', circle(125, 76, 2.4)],
      ...face(),
    ],
  },

  // 13 · Der König: in a long robe and an ermine collar, crowned, with sceptre and orb.
  king: {
    names: { de: 'König', en: 'King' },
    parts: [
      ['cloth2', smooth([[96, 124, 1], [154, 124, 1], [172, 200], [178, 290, 1], [72, 290, 1], [78, 200]])],
      ['cloth', smooth([[108, 121], [125, 128], [142, 121], [156, 134, 1], [154, 180], [166, 289, 1], [84, 289, 1], [96, 180], [94, 134, 1]])],
      ['gold', poly([[121, 150], [129, 150], [131, 289], [119, 289]])],
      ...feet(),
      ['cloth', limb([[98, 134], [88, 162], [92, 190]], 16)],
      ['cloth', limb([[152, 134], [162, 162], [158, 190]], 16)],
      ['gold', circle(89, 202, 9.5)],
      ['gold', poly([[88, 186], [90, 186], [90, 194], [88, 194]])],
      ['gold', poly([[85, 189], [93, 189], [93, 191], [85, 191]])],
      ['skin', circle(92, 193, 6)],
      ['gold', poly([[160, 82], [164.5, 82], [163.5, 210], [160.5, 210]])],
      ['gold', smooth([[162, 62], [170, 72], [162, 84], [154, 72]])],
      ['skin', circle(158, 192, 6.2)],
      ['wool', smooth([[90, 128], [125, 146], [160, 128], [165, 142], [125, 162], [85, 142]])],
      ['dark', 'M101,140l2,5l2,-5zM117,148l2,5l2,-5zM131,148l2,5l2,-5zM147,140l2,5l2,-5zM109,150l2,5l2,-5zM139,150l2,5l2,-5z'],
      ['hair', smooth([[106, 82], [110, 70], [125, 66], [140, 70], [144, 82], [146, 118], [138, 124], [140, 96], [125, 90], [110, 96], [112, 124], [104, 118]])],
      ['skin', ellipse(125, 92, 14, 17)],
      ['hair', smooth([[111, 100], [114, 120], [125, 140, 1], [136, 120], [139, 100], [134, 108], [125, 110], [116, 108]])],
      ['gold', poly([[108, 82], [108, 60], [115, 70], [120, 56], [125, 68], [130, 56], [135, 70], [142, 60], [142, 82]])],
      ['glow', circle(125, 76, 2.6)],
      ['feature', circle(119.4, 93, 1.5)],
      ['feature', circle(130.6, 93, 1.5)],
    ],
  },

  // Z · Der Zauberer: in a tall bent hat and a robe sewn with stars, a long white beard, his staff
  // crowned with the element's light.
  wizard: {
    names: { de: 'Zauberer', en: 'Wizard' },
    parts: [
      ['cloth', smooth([[106, 122], [125, 128], [144, 122], [160, 136, 1], [160, 186], [172, 290, 1], [78, 290, 1], [90, 186], [90, 136, 1]])],
      ['dark', ellipse(112, 291, 10, 4.5)],
      ['dark', ellipse(138, 291, 10, 4.5)],
      ['cloth', smooth([[100, 134], [84, 170], [74, 210], [96, 210], [104, 172]])],
      ['wood', limb([[178, 292], [176, 76]], 5)],
      ['glow', circle(176, 64, 10)],
      ['gold', limb([[168, 74], [176, 78], [184, 74]], 2.4)],
      ['cloth', smooth([[150, 134], [170, 148], [182, 170], [166, 178], [152, 160]])],
      ['skin', circle(176, 158, 6)],
      ['gold', star(108, 228, 6)],
      ['gold', star(140, 254, 5)],
      ['gold', star(116, 266, 4)],
      ['gold', star(150, 214, 4)],
      ...head(),
      ['wool', smooth([[112, 98], [116, 124], [121, 160], [125, 178, 1], [129, 160], [134, 124], [138, 98], [132, 108], [125, 110], [118, 108]])],
      ['cloth2', smooth([[104, 80], [117, 56], [130, 32], [154, 14, 1], [142, 36], [139, 58], [146, 80]])],
      ['cloth2', ellipse(125, 80, 34, 6.5)],
      ['gold', star(130, 52, 5)],
      ['gold', 'M118,68a6,6 0 1 0 6,-8a4.6,4.6 0 1 1 -6,8z'],
      ['feature', circle(119.4, 93, 1.5)],
      ['feature', circle(130.6, 93, 1.5)],
    ],
  },

  // N · Der Narr: a jester dancing on one leg, in a three-pointed cap with bells, his bauble raised.
  jester: {
    names: { de: 'Narr', en: 'Jester' },
    parts: [
      ['cloth', limb([[115, 222], [106, 256], [100, 284]], 12)],
      ['dark', smooth([[86, 292, 1], [110, 292, 1], [106, 282], [94, 284], [82, 280]])],
      ['cloth2', limb([[136, 222], [158, 242], [152, 266]], 12)],
      ['dark', smooth([[146, 268], [162, 272], [176, 262, 1], [164, 278], [146, 278, 1]])],
      ['cloth', poly([[106, 124], [144, 124], [152, 186], [162, 230], [150, 222], [140, 234], [130, 222], [120, 234], [110, 222], [100, 234], [88, 230], [98, 186]])],
      ['cloth2', poly([[125, 124], [144, 124], [150, 168], [153, 186], [125, 186]])],
      ['cloth', limb([[100, 132], [86, 154], [100, 172]], 11)],
      ['skin', circle(102, 173, 5.5)],
      ['cloth2', limb([[150, 132], [164, 116], [170, 98]], 11)],
      ['wood', limb([[170, 100], [168, 62]], 3.5)],
      ['skin', circle(168, 54, 7)],
      ['cloth2', smooth([[160, 50], [168, 40], [176, 50], [168, 47]])],
      ['gold', circle(160, 50, 2.6)],
      ['gold', circle(176, 50, 2.6)],
      ['skin', circle(170, 97, 5.5)],
      ['cloth2', poly([[104, 118], [112, 128], [118, 118], [125, 128], [132, 118], [138, 128], [146, 118], [146, 112], [104, 112]])],
      ...head(125, 94, 14, 17),
      ['cloth2', smooth([[109, 84], [94, 66], [76, 62, 1], [90, 76], [104, 94]])],
      ['cloth', smooth([[117, 76], [123, 52], [133, 36, 1], [131, 56], [133, 78]])],
      ['cloth2', smooth([[141, 84], [156, 66], [174, 62, 1], [162, 76], [146, 94]])],
      ['cloth', limb([[108, 86], [142, 86]], 8)],
      ['gold', circle(76, 63, 4.6)],
      ['gold', circle(133, 36, 4.6)],
      ['gold', circle(174, 63, 4.6)],
      ...face(125, 94),
    ],
  },
};

/** Who stands on each number, 1 to 13. */
export const LADDER = [null, 'beggar', 'maid', 'farmhand', 'shepherdess', 'farmer', 'miller', 'smith', 'merchant', 'monk', 'knight', 'duchess', 'queen', 'king'];

const K = '#1c1a22';

/**
 * A figure as a paper cut: one black silhouette, with gold, the element's glow, white wool and
 * linen, and the suit's sign left bright. `emblem()` draws the suit's sign on the knight's shield.
 */
export function silhouette(id, { gold, glow, paper, emblem }) {
  const fig = FIGURES[id];
  let out = '';
  for (const [role, d] of fig.parts) {
    if (role === 'emblem') out += emblem();
    else if (role === 'feature' || role === 'line') continue;
    else if (role === 'gold') out += `<path d="${d}" fill="${gold}"/>`;
    else if (role === 'glow') out += `<path d="${d}" fill="${glow}"/>`;
    else if (role === 'wool' || role === 'linen') out += `<path d="${d}" fill="${paper}" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/>`;
    else out += `<path d="${d}" fill="${K}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  return out;
}
