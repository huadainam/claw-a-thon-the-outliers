"""The Outliers — 3 new icon concepts x 5 variants.
1 curve  : bell curve, two dots beyond the tail
2 orbit  : binary orbit, two companions on one path
3 boxplot: classic statistics symbol, two outliers past the whisker
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = "/sessions/ecstatic-pensive-mccarthy/mnt/.claude/skills/canvas-design/canvas-fonts"
OUT = "/sessions/ecstatic-pensive-mccarthy/mnt/outputs"

S = 2
W = H = 2048

INK = (29, 29, 31)
APPLE_BG = (245, 245, 247)
SILVER = (233, 233, 238)
SILVER_A = (244, 244, 247)
SILVER_B = (224, 224, 233)
GRAY2 = (161, 161, 166)
LABEL = (209, 209, 214)
WHITE = (255, 255, 255)
BLUE = (52, 120, 246)
VIOLET = (122, 92, 255)
GRAD_A = (86, 144, 255)
GRAD_B = (141, 77, 250)

ICON_C = (1024, 810)
ICON_A = 350
SQ_N = 5.0
WORD_Y = 1408
WORD_SIZE = 148
CAP_Y = 1560
CAP_SIZE = 56
CAP_TRACK = 3
DOT_R = 30
RING_W = 11


def squircle_points(cx, cy, a, n=SQ_N, steps=2400):
    pts, e = [], 2.0 / n
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        pts.append((cx + a * math.copysign(abs(c) ** e, c),
                    cy + a * math.copysign(abs(s) ** e, s)))
    return pts


def gradient_rect(w, h, c1, c2):
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    t = (x + y) / 2.0
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = (c1[i] + (c2[i] - c1[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def dot(d, x, y, r, fill):
    d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def ringdot(d, x, y, r, w, col):
    d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=w)


def draw_motif(d, concept, cx, cy, s, k, mcol, ring_c, fill_c, gap_c):
    """k = motif scale. gap_c = container colour (to punch gaps)."""
    P = lambda x, y: (cx + x * k * s, cy + y * k * s)
    lw = round(13 * k * s)

    if concept == "curve":
        pts = []
        for xi in range(-260, 242, 3):
            yv = 150 - 235 * math.exp(-(((xi + 45) / 95.0) ** 2))
            pts.append(P(xi, yv))
        d.line(pts, fill=mcol, width=lw, joint="curve")
        # round the line ends
        for (ex, ey) in (pts[0], pts[-1]):
            dot(d, ex, ey, lw / 2, mcol)
        rx, ry = P(150, -160)
        fx, fy = P(232, -88)
        ringdot(d, rx, ry, DOT_R * k * s, round(RING_W * k * s), ring_c)
        dot(d, fx, fy, DOT_R * k * s, fill_c)

    elif concept == "orbit":
        ox, oy = P(0, 15)
        R = 185 * k * s
        d.ellipse([ox - R, oy - R, ox + R, oy + R],
                  outline=mcol, width=lw)
        a1, a2 = math.radians(225), math.radians(45)
        for ang, kind, col in ((a1, "ring", ring_c), (a2, "fill", fill_c)):
            x = ox + R * math.cos(ang)
            y = oy + R * math.sin(ang)
            dot(d, x, y, 47 * k * s, gap_c)          # punch gap in orbit
            if kind == "ring":
                ringdot(d, x, y, 33 * k * s, round(RING_W * k * s), col)
            else:
                dot(d, x, y, 33 * k * s, col)

    elif concept == "boxplot":
        y0 = 10
        cap = 30
        # left cap + whisker
        d.line([P(-245, y0 - cap), P(-245, y0 + cap)], fill=mcol, width=lw)
        d.line([P(-245, y0), P(-160, y0)], fill=mcol, width=lw)
        # box
        x1, y1 = P(-160, y0 - 65)
        x2, y2 = P(-20, y0 + 65)
        d.rounded_rectangle([x1, y1, x2, y2], radius=30 * k * s, fill=mcol)
        # median (container colour)
        d.line([P(-90, y0 - 65 + 8), P(-90, y0 + 65 - 8)],
               fill=gap_c, width=lw)
        # right whisker + cap
        d.line([P(-20, y0), P(60, y0)], fill=mcol, width=lw)
        d.line([P(60, y0 - cap), P(60, y0 + cap)], fill=mcol, width=lw)
        # the two outliers
        rx, ry = P(150, y0)
        fx, fy = P(240, y0)
        ringdot(d, rx, ry, DOT_R * k * s, round(RING_W * k * s), ring_c)
        dot(d, fx, fy, DOT_R * k * s, fill_c)


def build(concept, var, label):
    s = S
    img = Image.new("RGB", (W * s, H * s), var["bg"])
    draw = ImageDraw.Draw(img)
    cx, cy, a = ICON_C[0] * s, ICON_C[1] * s, ICON_A * s

    style = var["icon"]
    gap_c = var["bg"]
    if style == "ink":
        draw.polygon(squircle_points(cx, cy, a), fill=INK)
        gap_c = INK
    elif style == "silver":
        draw.polygon(squircle_points(cx, cy, a), fill=SILVER)
        gap_c = SILVER
    elif style == "grad":
        mask = Image.new("L", (W * s, H * s), 0)
        ImageDraw.Draw(mask).polygon(squircle_points(cx, cy, a), fill=255)
        img.paste(gradient_rect(W * s, H * s, GRAD_A, GRAD_B), (0, 0), mask)
        gap_c = (108, 113, 252)  # mid gradient tone
        draw = ImageDraw.Draw(img)
    elif style == "silvergrad":
        mask = Image.new("L", (W * s, H * s), 0)
        ImageDraw.Draw(mask).polygon(squircle_points(cx, cy, a), fill=255)
        img.paste(gradient_rect(W * s, H * s, SILVER_A, SILVER_B), (0, 0), mask)
        gap_c = (234, 234, 240)
        draw = ImageDraw.Draw(img)
    # "none" -> naked mark, gap_c = bg

    k = var.get("scale", 1.0)
    draw_motif(draw, concept, cx, cy, s, k,
               var["motif"], var["ring"], var["fill"], gap_c)

    f_word = ImageFont.truetype(f"{FONTS}/{var['font']}", WORD_SIZE * s)
    t1, t2 = "The ", "Outliers"
    w1 = draw.textlength(t1, font=f_word)
    w2 = draw.textlength(t2, font=f_word)
    x0 = (W * s - (w1 + w2)) / 2
    draw.text((x0, WORD_Y * s), t1, font=f_word, fill=GRAY2, anchor="ls")
    draw.text((x0 + w1, WORD_Y * s), t2, font=f_word, fill=INK, anchor="ls")

    f_cap = ImageFont.truetype(f"{FONTS}/GeistMono-Regular.ttf", CAP_SIZE * s)
    capt = "n = 2"
    widths = [draw.textlength(ch, font=f_cap) for ch in capt]
    total = sum(widths) + CAP_TRACK * s * (len(capt) - 1)
    x = (W * s - total) / 2
    for ch, wd in zip(capt, widths):
        draw.text((x, CAP_Y * s), ch, font=f_cap, fill=GRAY2, anchor="ls")
        x += wd + CAP_TRACK * s

    f_lab = ImageFont.truetype(f"{FONTS}/GeistMono-Regular.ttf", 40 * s)
    draw.text((130 * s, 170 * s), label, font=f_lab, fill=LABEL, anchor="ls")

    return img.resize((W, H), Image.LANCZOS)


VARIANTS = {
    "A": dict(bg=APPLE_BG, icon="ink", motif=WHITE, ring=WHITE, fill=WHITE,
              font="Outfit-Regular.ttf"),
    "B": dict(bg=WHITE, icon="silver", motif=WHITE, ring=INK, fill=INK,
              font="Outfit-Regular.ttf"),
    "C": dict(bg=APPLE_BG, icon="grad", motif=WHITE, ring=WHITE, fill=WHITE,
              font="Outfit-Regular.ttf"),
    "D": dict(bg=WHITE, icon="silvergrad", motif=WHITE, ring=VIOLET, fill=BLUE,
              font="NationalPark-Regular.ttf"),
    "E": dict(bg=APPLE_BG, icon="none", motif=INK, ring=INK, fill=INK,
              font="PoiretOne-Regular.ttf", scale=1.18),
}

concept = sys.argv[1]
num = {"curve": "1", "orbit": "2", "boxplot": "3"}[concept]
for v, cfg in VARIANTS.items():
    build(concept, cfg, f"{num}{v}").save(f"{OUT}/TheOutliers-{concept}-{v}.png")
print(concept, "done")
