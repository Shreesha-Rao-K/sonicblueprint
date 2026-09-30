"""Generate the 1200x1200 square social preview image (run once; output committed).

Companion to make-og-image.py: same palette/fonts, stacked centered layout so a
center crop (1:1, 4:3, 1.91:1 thumbnails) keeps brand + tagline legible.
Critical content stays inside the middle ~800px band.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 1200
BG = (6, 7, 13)
GRID = (13, 19, 34)
WHITE = (255, 255, 255)
SUB = (174, 191, 255)
MUTED = (148, 163, 184)
C1 = (110, 139, 255)
C2 = (167, 139, 250)


def font(size, bold=True):
    for path in (
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def center_text(d, cx, y, s, fnt, fill):
    d.text((cx, y), s, font=fnt, fill=fill, anchor="ma")


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# faint grid
for x in range(0, W, 48):
    d.line([(x, 0), (x, H)], fill=GRID)
for y in range(0, H, 48):
    d.line([(0, y), (W, y)], fill=GRID)

# waveform motif (centered, upper third)
bw, gap = 34, 18
heights = [150, 250, 330, 210, 130]
total = len(heights) * bw + (len(heights) - 1) * gap
bx = (W - total) // 2
mid_y = 300
for i, h in enumerate(heights):
    x0 = bx + i * (bw + gap)
    d.rounded_rectangle([x0, mid_y - h // 2, x0 + bw, mid_y + h // 2], radius=10, fill=lerp(C1, C2, i / 4))

# brand + tagline (vertical middle band: the crop-safe zone)
center_text(d, W // 2, 520, "SONICBLUEPRINT", font(64), WHITE)
center_text(d, W // 2, 620, "Design Your Music.", font(52), SUB)
center_text(d, W // 2, 700, "Build Your Blueprint.", font(52), SUB)

# feature words (centered, below tagline)
center_text(d, W // 2, 830, "Chords  ·  Rhythm  ·  Bass  ·  Melody  ·  Arrangement", font(30, bold=False), MUTED)

# piano-roll motif (centered)
widths = [44, 26, 54, 24, 58, 32, 46]
gap2 = 10
total2 = sum(widths) + gap2 * (len(widths) - 1)
px = (W - total2) // 2
py0 = 900
for i, w in enumerate(widths):
    x0 = px + sum(widths[:i]) + i * gap2
    h = 30 if i % 2 == 0 else 48
    c = lerp(C1, C2, i / (len(widths) - 1))
    d.rounded_rectangle([x0, py0 + (48 - h), x0 + w, py0 + 48], radius=7, fill=c)

# waveform baseline (full width, lower third)
pts = []
for x in range(110, 1090, 8):
    y = 1040 + int(16 * math.sin(x / 46.0) * math.cos(x / 130.0))
    pts.append((x, y))
d.line(pts, fill=C1, width=3)

out = os.path.join(ROOT, "public", "og-image-square.png")
img.save(out)
print("wrote", out, img.size, os.path.getsize(out), "bytes")
