"""Generate SonicBlueprint brand icons (run once; outputs committed to repo)."""
from PIL import Image, ImageDraw

BG = (10, 14, 26, 255)
C1 = (110, 139, 255)
C2 = (167, 139, 250)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw_mark(draw, s):
    pad = int(s * 0.22)
    n = 5
    gap = int(s * 0.045)
    avail = s - pad * 2 - gap * (n - 1)
    bw = avail // n
    heights = [0.45, 0.75, 1.0, 0.65, 0.4]
    for i, h in enumerate(heights):
        x0 = pad + i * (bw + gap)
        bh = int((s - pad * 2) * h)
        y0 = (s - bh) // 2
        r = max(2, int(bw * 0.28))
        draw.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=r, fill=lerp(C1, C2, i / (n - 1)))


def rounded_bg(s, radius_ratio=0.22):
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=BG)
    return img, d


import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(ROOT, "public", "icons")
os.makedirs(out, exist_ok=True)

# 512 master (rounded tile)
img, d = rounded_bg(512)
draw_mark(d, 512)
img.save(os.path.join(out, "icon-512.png"))

# 192
img.resize((192, 192), Image.LANCZOS).save(os.path.join(out, "icon-192.png"))

# apple touch (180, flat tile)
img.resize((180, 180), Image.LANCZOS).save(os.path.join(ROOT, "public", "apple-touch-icon.png"))

# maskable: full-bleed bg with smaller centered mark
m = Image.new("RGBA", (512, 512), BG)
md = ImageDraw.Draw(m)
inset = Image.new("RGBA", (410, 410), (0, 0, 0, 0))
draw_mark(ImageDraw.Draw(inset), 410)
m.alpha_composite(inset, (51, 51))
m.save(os.path.join(out, "maskable-512.png"))

# favicon.ico (multi-size; PIL scales the master down automatically)
ico, d = rounded_bg(64, radius_ratio=0.24)
draw_mark(d, 64)
ico.save(os.path.join(ROOT, "src", "app", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("icons written to", out)
