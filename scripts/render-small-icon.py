"""Render the small-size icon (icon.png) for the plugin list.

Simplified content: one wave with a warm peak dot and a green valley dot. The
palette is sampled from assets/icon-source.png: royal blue body, purple glow in
the top-left and bottom-right corners, coral peak, green valley.

Optional development helper: needs Pillow and numpy.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

S = 1024
BASE_TOP = (36, 70, 216)      # #2446D8
BASE_BOTTOM = (17, 54, 170)   # #1136AA
PURPLE_TL = (92, 56, 210)     # #5C38D2
PURPLE_BR = (76, 52, 224)     # #4C34E0
CORAL = (255, 107, 107)       # #FF6B6B
GREEN = (53, 224, 138)        # #35E08A
WAVE_LEFT = (255, 150, 170)   # warm tint where the peak sits
WAVE_RIGHT = (150, 240, 190)  # green tint where the valley sits


def gradient_base():
    ys, xs = np.mgrid[0:S, 0:S]
    t = np.clip((ys / (S - 1)) * 0.85 + (xs / (S - 1)) * 0.15, 0, 1)[..., None]
    rgb = np.array(BASE_TOP) * (1 - t) + np.array(BASE_BOTTOM) * t
    layer = np.zeros((S, S, 4), dtype=np.uint8)
    layer[..., :3] = rgb.astype(np.uint8)
    layer[..., 3] = 255
    return Image.fromarray(layer, "RGBA")


def radial_glow(cx, cy, radius, color, opacity, falloff=2.0):
    ys, xs = np.mgrid[0:S, 0:S]
    distance = np.sqrt((xs - cx * S) ** 2 + (ys - cy * S) ** 2) / (radius * S)
    alpha = np.clip(1 - distance, 0, 1) ** falloff * opacity * 255
    layer = np.zeros((S, S, 4), dtype=np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = color
    layer[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


def catmull_rom(points, samples=420):
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


def lerp_color(c0, c1, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))


def stroke(layer, points, radius, colors):
    """Round-capped stroke; `colors` is one RGB per point."""
    d = ImageDraw.Draw(layer)
    for (x, y), color in zip(points, colors):
        d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (255,))


canvas = gradient_base()
canvas = Image.alpha_composite(canvas, radial_glow(0.02, 0.02, 0.58, PURPLE_TL, 0.70, 2.2))
canvas = Image.alpha_composite(canvas, radial_glow(0.98, 0.98, 0.62, PURPLE_BR, 0.70, 2.2))
# tight violet highlights right in the two corners
canvas = Image.alpha_composite(canvas, radial_glow(0.035, 0.035, 0.30, (128, 82, 255), 0.95, 1.6))
canvas = Image.alpha_composite(canvas, radial_glow(0.965, 0.965, 0.32, (116, 72, 255), 0.95, 1.6))

mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(0.22 * S), fill=255)
canvas.putalpha(mask)

pts = [(0.06 * S, 0.60 * S), (0.30 * S, 0.27 * S), (0.63 * S, 0.76 * S), (0.95 * S, 0.49 * S)]
curve = catmull_rom(pts)
colors = []
for index in range(len(curve)):
    t = index / (len(curve) - 1)
    if t < 0.33:
        colors.append(lerp_color(WAVE_LEFT, (245, 248, 255), t / 0.33))
    elif t < 0.66:
        colors.append(lerp_color((245, 248, 255), WAVE_RIGHT, (t - 0.33) / 0.33))
    else:
        colors.append(lerp_color(WAVE_RIGHT, (245, 248, 255), (t - 0.66) / 0.34))

# soft glow under the wave
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stroke(glow, curve, int(0.040 * S), [(120, 160, 255)] * len(curve))
glow = glow.filter(ImageFilter.GaussianBlur(radius=int(0.036 * S)))
canvas = Image.alpha_composite(canvas, glow)

wave = Image.new("RGBA", (S, S), (0, 0, 0, 0))
stroke(wave, curve, int(0.027 * S), colors)
canvas = Image.alpha_composite(canvas, wave)

for center, color in (((0.30 * S, 0.27 * S), CORAL), ((0.63 * S, 0.76 * S), GREEN)):
    halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    r = 0.12 * S
    hd.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), fill=color + (200,))
    canvas = Image.alpha_composite(canvas, halo.filter(ImageFilter.GaussianBlur(radius=int(0.055 * S))))
    dot = ImageDraw.Draw(canvas)
    r = 0.062 * S
    dot.ellipse((center[0] - r, center[1] - r, center[0] + r, center[1] + r), fill=color + (255,))

canvas.resize((384, 384), Image.LANCZOS).save("icon.png", optimize=True)
print("wrote icon.png")
