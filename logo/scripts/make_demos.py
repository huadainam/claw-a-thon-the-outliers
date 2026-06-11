"""The Outliers — 6 demo variants. Softer fonts, Apple light grays, bigger n=2."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = "/sessions/ecstatic-pensive-mccarthy/mnt/.claude/skills/canvas-design/canvas-fonts"
OUT = "/sessions/ecstatic-pensive-mccarthy/mnt/outputs"

S = 2
W = H = 2048

INK = (29, 29, 31)
APPLE_BG = (245, 245, 247)     # #F5F5F7
SILVER = (233, 233, 238)       # #E9E9EE
SILVER_A = (244, 244, 247)
SILVER_B = (224, 224, 233)
GRAY2 = (161, 161, 166)        # #A1A1A6
GRAY3 = (199, 199, 204)        # #C7C7CC
LABEL = (209, 209, 214)
BLUE = (52, 120, 246)          # Apple blue
VIOLET = (122, 92, 255)
GRAD_A = (86, 144, 255)
GRAD_B = (141, 77, 250)

ICON_C = (1024, 810)
ICON_A = 350
SQ_N = 5.0
GRID_OFF = (-70, 70)
GRID_STEPS = (-150, -50, 50, 150)
GRID_R = 15
VACANT = {(150, -150), (50, -150)}
OUT_RING = (150, -185)
OUT_FILL = (228, -112)
OUT_R = 30
RING_STROKE = 11

WORD_Y = 1408
WORD_SIZE = 148
CAP_Y = 1560
CAP_SIZE = 56
CAP_TRACK = 3


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


def build(cfg, label):
    s = S
    img = Image.new("RGB", (W * s, H * s), cfg["bg"])
    draw = ImageDraw.Draw(img)
    cx, cy, a = ICON_C[0] * s, ICON_C[1] * s, ICON_A * s
    sq = squircle_points(cx, cy, a)

    style = cfg["icon"]
    if style == "ink":
        draw.polygon(sq, fill=INK)
    elif style == "silver":
        draw.polygon(sq, fill=SILVER)
    elif style == "grad":
        mask = Image.new("L", (W * s, H * s), 0)
        ImageDraw.Draw(mask).polygon(sq, fill=255)
        img.paste(gradient_rect(W * s, H * s, GRAD_A, GRAD_B), (0, 0), mask)
    elif style == "silvergrad":
        mask = Image.new("L", (W * s, H * s), 0)
        ImageDraw.Draw(mask).polygon(sq, fill=255)
        img.paste(gradient_rect(W * s, H * s, SILVER_A, SILVER_B), (0, 0), mask)
    elif style == "outline":
        draw.line(sq + [sq[0]], fill=INK, width=9 * s, joint="curve")

    # lattice
    ov = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    gx, gy = cx + GRID_OFF[0] * s, cy + GRID_OFF[1] * s
    for dx in GRID_STEPS:
        for dy in GRID_STEPS:
            if (dx, dy) in VACANT:
                continue
            x, y, r = gx + dx * s, gy + dy * s, GRID_R * s
            od.ellipse([x - r, y - r, x + r, y + r], fill=cfg["cluster"])
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(img)

    # the duo
    rx, ry = cx + OUT_RING[0] * s, cy + OUT_RING[1] * s
    fx, fy = cx + OUT_FILL[0] * s, cy + OUT_FILL[1] * s
    r = OUT_R * s
    draw.ellipse([rx - r, ry - r, rx + r, ry + r],
                 outline=cfg["ring"], width=RING_STROKE * s)
    draw.ellipse([fx - r, fy - r, fx + r, fy + r], fill=cfg["fill"])

    # wordmark
    f_word = ImageFont.truetype(f"{FONTS}/{cfg['font']}", WORD_SIZE * s)
    t1, t2 = "The ", "Outliers"
    w1 = draw.textlength(t1, font=f_word)
    w2 = draw.textlength(t2, font=f_word)
    x0 = (W * s - (w1 + w2)) / 2
    draw.text((x0, WORD_Y * s), t1, font=f_word, fill=GRAY2, anchor="ls")
    draw.text((x0 + w1, WORD_Y * s), t2, font=f_word, fill=INK, anchor="ls")

    # n = 2
    f_cap = ImageFont.truetype(f"{FONTS}/GeistMono-Regular.ttf", CAP_SIZE * s)
    cap = "n = 2"
    widths = [draw.textlength(ch, font=f_cap) for ch in cap]
    total = sum(widths) + CAP_TRACK * s * (len(cap) - 1)
    x = (W * s - total) / 2
    for ch, wd in zip(cap, widths):
        draw.text((x, CAP_Y * s), ch, font=f_cap, fill=GRAY2, anchor="ls")
        x += wd + CAP_TRACK * s

    # tiny option label
    f_lab = ImageFont.truetype(f"{FONTS}/GeistMono-Regular.ttf", 40 * s)
    draw.text((130 * s, 170 * s), label, font=f_lab, fill=LABEL, anchor="ls")

    return img.resize((W, H), Image.LANCZOS)


white_soft = (255, 255, 255, 90)
white_grad = (255, 255, 255, 110)

VARIANTS = {
    "A": dict(bg=APPLE_BG, icon="ink", cluster=white_soft,
              ring=(255, 255, 255), fill=(255, 255, 255),
              font="Outfit-Regular.ttf"),
    "B": dict(bg=(255, 255, 255), icon="silver", cluster=(255, 255, 255, 255),
              ring=INK, fill=INK, font="Outfit-Regular.ttf"),
    "C": dict(bg=APPLE_BG, icon="grad", cluster=white_grad,
              ring=(255, 255, 255), fill=(255, 255, 255),
              font="Outfit-Regular.ttf"),
    "D": dict(bg=(255, 255, 255), icon="ink", cluster=white_soft,
              ring=(255, 255, 255), fill=(255, 255, 255),
              font="NationalPark-Regular.ttf"),
    "E": dict(bg=(255, 255, 255), icon="silvergrad", cluster=(255, 255, 255, 255),
              ring=VIOLET, fill=BLUE, font="NationalPark-Regular.ttf"),
    "F": dict(bg=APPLE_BG, icon="outline", cluster=(199, 199, 204, 255),
              ring=INK, fill=INK, font="PoiretOne-Regular.ttf"),
}

for k, cfg in VARIANTS.items():
    build(cfg, k).save(f"{OUT}/TheOutliers-Demo-{k}.png")
    print(k, "done")
