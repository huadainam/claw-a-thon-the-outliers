"""The Outliers — team logo. Quiet Deviation philosophy.
Two versions: monochrome + soft gradient. Apple-inspired squircle lockup."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = "/sessions/ecstatic-pensive-mccarthy/mnt/.claude/skills/canvas-design/canvas-fonts"
OUT = "/sessions/ecstatic-pensive-mccarthy/mnt/outputs"

S = 3                      # supersample factor
W = H = 2048               # final canvas

# ---------- palette ----------
INK = (29, 29, 31)         # Apple near-black #1D1D1F
GRAY = (110, 110, 115)     # secondary #6E6E73
LIGHTGRAY = (134, 134, 139)  # #86868B
WHITE = (255, 255, 255)
GRAD_A = (86, 144, 255)    # clear blue
GRAD_B = (141, 77, 250)    # soft violet

# ---------- geometry (final-scale units) ----------
ICON_C = (1024, 810)       # icon center
ICON_A = 350               # icon half-size  (icon = 700 px)
SQ_N = 5.0                 # superellipse exponent (Apple-like continuous corner)

GRID_OFF = (-70, 70)       # grid center offset inside icon (down-left)
GRID_STEPS = (-150, -50, 50, 150)
GRID_R = 15
VACANT = {(150, -150), (50, -150)}          # two cells that left the pattern

OUT_RING = (150, -185)     # outlier 1 (ring)
OUT_FILL = (228, -112)     # outlier 2 (filled)
OUT_R = 30
RING_STROKE = 11

WORD_Y = 1408              # wordmark baseline
WORD_SIZE = 148
CAP_Y = 1556               # caption baseline
CAP_SIZE = 42
CAP_TRACK = 3              # extra px between caption chars


def squircle_points(cx, cy, a, n=SQ_N, steps=2400):
    pts = []
    e = 2.0 / n
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        x = cx + a * math.copysign(abs(c) ** e, c)
        y = cy + a * math.copysign(abs(s) ** e, s)
        pts.append((x, y))
    return pts


def dot(draw, cx, cy, r, fill):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def ring(draw, cx, cy, r, stroke, color):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 outline=color, width=stroke)


def gradient_rect(w, h, c1, c2):
    """Diagonal (TL->BR) linear gradient."""
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    t = (x + y) / 2.0
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = (c1[i] + (c2[i] - c1[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def build(mode):
    s = S
    img = Image.new("RGB", (W * s, H * s), WHITE)
    draw = ImageDraw.Draw(img)

    cx, cy = ICON_C[0] * s, ICON_C[1] * s
    a = ICON_A * s

    # --- icon vessel ---
    sq = squircle_points(cx, cy, a)
    if mode == "mono":
        draw.polygon(sq, fill=INK)
        grid_col = (255, 255, 255, 84)   # ~33% white
    else:
        mask = Image.new("L", (W * s, H * s), 0)
        ImageDraw.Draw(mask).polygon(sq, fill=255)
        grad = gradient_rect(W * s, H * s, GRAD_A, GRAD_B)
        img.paste(grad, (0, 0), mask)
        grid_col = (255, 255, 255, 104)  # ~41% white

    # --- lattice of anonymous marks (drawn on overlay for alpha) ---
    ov = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    gx, gy = cx + GRID_OFF[0] * s, cy + GRID_OFF[1] * s
    for dx in GRID_STEPS:
        for dy in GRID_STEPS:
            if (dx, dy) in VACANT:
                continue
            dot(od, gx + dx * s, gy + dy * s, GRID_R * s, grid_col)
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(img)

    # --- the two who left: one ring, one filled (a duo) ---
    ring(draw, cx + OUT_RING[0] * s, cy + OUT_RING[1] * s,
         OUT_R * s, RING_STROKE * s, WHITE)
    dot(draw, cx + OUT_FILL[0] * s, cy + OUT_FILL[1] * s, OUT_R * s, WHITE)

    # --- wordmark ---
    f_word = ImageFont.truetype(f"{FONTS}/InstrumentSans-Regular.ttf",
                                WORD_SIZE * s)
    t1, t2 = "The ", "Outliers"
    w1 = draw.textlength(t1, font=f_word)
    w2 = draw.textlength(t2, font=f_word)
    x0 = (W * s - (w1 + w2)) / 2
    by = WORD_Y * s
    draw.text((x0, by), t1, font=f_word, fill=GRAY, anchor="ls")
    draw.text((x0 + w1, by), t2, font=f_word, fill=INK, anchor="ls")

    # --- whispered footnote: n = 2 ---
    f_cap = ImageFont.truetype(f"{FONTS}/GeistMono-Regular.ttf", CAP_SIZE * s)
    cap = "n = 2"
    widths = [draw.textlength(ch, font=f_cap) for ch in cap]
    total = sum(widths) + CAP_TRACK * s * (len(cap) - 1)
    x = (W * s - total) / 2
    for ch, w in zip(cap, widths):
        draw.text((x, CAP_Y * s), ch, font=f_cap, fill=LIGHTGRAY, anchor="ls")
        x += w + CAP_TRACK * s

    return img.resize((W, H), Image.LANCZOS)


build("mono").save(f"{OUT}/TheOutliers-Logo-Mono.png")
build("gradient").save(f"{OUT}/TheOutliers-Logo-Gradient.png")
print("done")
