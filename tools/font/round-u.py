# Stichle Display: Metamorphous (Sorkin Type, SIL OFL 1.1) with a round u.
#
# Metamorphous's u comes to a point at the bottom and reads as a v ("Fever", "Lvft"); here every u
# (u, ü, ú, ù, û) is the n turned half a turn, the classic way a u is built, so it keeps the font's
# pointed arch and gets its right stem back. The capital U had the same point and no right stem
# ("BRAVER" on the cards' names): it becomes the round u drawn up to capital height, a little wider.
# Accents stay and are centred again over the new letter.
# The OFL reserves the name "Metamorphous", so the result carries a name of its own; the copyright
# and the licence stay in the font, and OFL.txt sits beside it in src/fonts.
#
#   python3 -m venv /tmp/font-venv && /tmp/font-venv/bin/pip install fonttools brotli
#   /tmp/font-venv/bin/python tools/font/round-u.py
#
# Reads tools/font/Metamorphous-Regular.ttf (google/fonts, ofl/metamorphous), writes
# src/fonts/stichle-display.woff2.
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
SRC = HERE / 'Metamorphous-Regular.ttf'
OUT = HERE.parent.parent / 'src' / 'fonts' / 'stichle-display.woff2'
FAMILY = 'Stichle Display'
U_GLYPHS = ['u', 'udieresis', 'uacute', 'ugrave', 'ucircumflex']
CAP_GLYPHS = ['U', 'Udieresis', 'Uacute', 'Ugrave', 'Ucircumflex']
X_HEIGHT_ABOVE = 1250  # font units: a contour starting above the x-height (1208) is an accent
CAP_ABOVE = 1560  # and above the cap height (1530), on a capital
CAP_HEIGHT = 1530
CAP_WIDEN = 1.1  # wider than the u, but not so much that the stems get heavier than the H's

font = TTFont(SRC)
glyphs = font.getGlyphSet()
glyf, hmtx = font['glyf'], font['hmtx']


def bounds(ops):
    pen = BoundsPen(glyphs)
    replay(ops, pen)
    return pen.bounds


def replay(ops, pen):
    for op, args in ops:
        getattr(pen, op)(*args)


def contours(name):
    rec = RecordingPen()
    glyphs[name].draw(rec)
    out, cur = [], []
    for op in rec.value:
        cur.append(op)
        if op[0] in ('closePath', 'endPath'):
            out.append(cur)
            cur = []
    return out


n = [op for c in contours('n') for op in c]
nx0, ny0, nx1, ny1 = bounds(n)
turn = (-1, 0, 0, -1, nx0 + nx1, ny0 + ny1)  # half a turn about the n's own centre
ux0, _, ux1, _ = bounds([op for c in contours('u') for op in c])
shift = (nx0 + nx1) / 2 - (ux0 + ux1) / 2

for name in U_GLYPHS:
    accents = [c for c in contours(name) if bounds(c) and bounds(c)[1] > X_HEIGHT_ABOVE]
    pen = TTGlyphPen(glyphs)
    replay(n, TransformPen(pen, turn))
    for c in accents:
        replay(c, TransformPen(pen, (1, 0, 0, 1, shift, 0)))
    glyph = pen.glyph()
    glyph.recalcBounds(glyf)
    glyf[name] = glyph
    hmtx[name] = (hmtx['n'][0], glyph.xMin)

# The capitals: the turned n, scaled from the baseline to the cap height, centred where the old U sat.
up = CAP_HEIGHT / ny1
Ux0, _, Ux1, _ = bounds([op for c in contours('U') for op in c])
cx = (Ux0 + Ux1) / 2
for name in CAP_GLYPHS:
    accents = [c for c in contours(name) if bounds(c) and bounds(c)[1] > CAP_ABOVE]
    pen = TTGlyphPen(glyphs)
    # turn about the n's centre, then scale about its (new) centre line and the baseline
    mid = (nx0 + nx1) / 2
    replay(n, TransformPen(TransformPen(pen, (CAP_WIDEN, 0, 0, up, cx - mid * CAP_WIDEN, 0)), turn))
    for c in accents:
        replay(c, pen)
    glyph = pen.glyph()
    glyph.recalcBounds(glyf)
    glyf[name] = glyph
    hmtx[name] = (hmtx['U'][0], glyph.xMin)

ps = FAMILY.replace(' ', '') + '-Regular'
for rec in font['name'].names:
    if rec.nameID in (1, 16, 21):
        rec.string = FAMILY
    elif rec.nameID == 4:
        rec.string = FAMILY
    elif rec.nameID in (2, 17, 22):
        rec.string = 'Regular'
    elif rec.nameID == 6:
        rec.string = ps
    elif rec.nameID == 3:
        rec.string = f'1.000;{ps}'
    elif rec.nameID == 5:
        rec.string = rec.toUnicode() + '; Stichle: the u turned from the n'

font.flavor = 'woff2'
font.save(OUT)
print(f'wrote {OUT.relative_to(HERE.parent.parent)} ({OUT.stat().st_size} bytes)')
