"""Generate the 1200x630 social preview image (run once; output committed)."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
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


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# faint grid
for x in range(0, W, 48):
    d.line([(x, 0), (x, H)], fill=GRID)
for y in range(0, H, 48):
    d.line([(0, y), (W, y)], fill=GRID)

# waveform motif (left)
bx, bw, gap = 110, 26, 14
heights = [120, 200, 260, 170, 105]
for i, h in enumerate(heights):
    x0 = bx + i * (bw + gap)
    y0 = 315 - h // 2 - 40
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + h], radius=8, fill=lerp(C1, C2, i / 4))

# brand + tagline (right of motif)
tx = 360
d.text((tx, 130), "SONICBLUEPRINT", font=font(58), fill=WHITE)
d.text((tx, 215), "Design Your Music.", font=font(46), fill=SUB)
d.text((tx, 275), "Build Your Blueprint.", font=font(46), fill=SUB)

# bottom strip: feature words
d.text((110, 470), "Chords  ·  Rhythm  ·  Bass  ·  Melody  ·  Arrangement", font=font(28, bold=False), fill=MUTED)

# piano-roll motif bottom-right (kept clear of the feature words)
px, py0 = 900, 445
widths = [36, 22, 44, 20, 48, 26, 38]
for i, w in enumerate(widths):
    x0 = px + sum(widths[:i]) + i * 8
    h = 26 if i % 2 == 0 else 40
    c = lerp(C1, C2, i / (len(widths) - 1))
    d.rounded_rectangle([x0, py0 + (40 - h), x0 + w, py0 + 40], radius=6, fill=c)

# waveform baseline
pts = []
import math
for x in range(110, 1090, 8):
    y = 560 + int(14 * math.sin(x / 46.0) * math.cos(x / 130.0))
    pts.append((x, y))
d.line(pts, fill=C1, width=3)

out = os.path.join(ROOT, "public", "og-image.png")
img.save(out)
print("wrote", out, img.size, os.path.getsize(out), "bytes")
