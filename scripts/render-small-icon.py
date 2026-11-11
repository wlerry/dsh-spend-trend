"""Render the small-size icon (icon.png) in the same visual language as the
market artwork: dark blue tile, one white wave, a warm peak dot and a green
valley dot. Details are dropped on purpose so it still reads at 24-32 px.

Optional development helper: needs Pillow and numpy.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

S = 1024
STOPS = [  # (position along the diagonal, RGB)
    (0.00, (58, 46, 158)),   # #3A2E9E purple-blue
    (0.45, (30, 63, 184)),   # #1E3FB8 vivid blue
    (1.00, (8, 16, 44)),     # #08102C near-black blue
]
WAVE = (232, 240, 255)   # near-white with a cool tint
PEAK = (255, 107, 107)   # #FF6B6B
VALLEY = (53, 224, 138)  # #35E08A


def background():
    ys, xs = np.mgrid[0:S, 0:S]
    t = np.clip((xs + ys) / (2 * S), 0, 1)
    rgb = np.zeros((S, S, 3), dtype=np.float64)
    for (p0, c0), (p1, c1) in zip(STOPS, STOPS[1:]):
        span = (t >= p0) & (t <= p1)
        local = ((t - p0) / (p1 - p0))[..., None]
        rgb[span] = np.array(c0) * (1 - local[span]) + np.array(c1) * local[span]
    layer = np.zeros((S, S, 4), dtype=np.uint8)
    layer[..., :3] = rgb.astype(np.uint8)
    layer[..., 3] = 255
    return Image.fromarray(layer, "RGBA")


def catmull_rom(points, samples=400):
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for j in range(samples):
            t = j / samples
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
                       + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
                       + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    return out


canvas = background()
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(0.22 * S), fill=255)
canvas.putalpha(mask)

pts = [(0.06 * S, 0.60 * S), (0.30 * S, 0.27 * S), (0.63 * S, 0.76 * S), (0.95 * S, 0.49 * S)]
curve = catmull_rom(pts)

def stroke(layer, points, radius, color):
    """Round-capped stroke as the union of disks along the path."""
    d = ImageDraw.Draw(layer)
    for x, y in points:
        d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


# soft glow under the wave
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stroke(glow, curve, int(0.038 * S), (140, 180, 255, 210))
glow = glow.filter(ImageFilter.GaussianBlur(radius=int(0.035 * S)))
canvas = Image.alpha_composite(canvas, glow)

wave = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stroke(wave, curve, int(0.027 * S), WAVE + (255,))
canvas = Image.alpha_composite(canvas, wave)

for center, color in (((0.30 * S, 0.27 * S), PEAK), ((0.63 * S, 0.76 * S), VALLEY)):
    halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    r = 0.11 * S
    hd.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), fill=color + (190,))
    canvas = Image.alpha_composite(canvas, halo.filter(ImageFilter.GaussianBlur(radius=int(0.05 * S))))
    dot = ImageDraw.Draw(canvas)
    r = 0.062 * S
    dot.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), fill=color + (255,))

canvas.resize((384, 384), Image.LANCZOS).save("icon.png", optimize=True)
print("wrote icon.png")
