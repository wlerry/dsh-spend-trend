"""Render assets/icon-180.png from the same geometry as icon.svg.

Optional development helper: needs Pillow (`pip install pillow`). The plugin
itself does not depend on it.
"""
from PIL import Image, ImageDraw
import numpy as np

SCALE = 4
SIZE = 180 * SCALE
BASE = (11, 15, 20, 255)
PEAK = (245, 165, 36)
VALLEY = (34, 197, 94)


def radial(cx, cy, radius, color, opacity):
    ys, xs = np.mgrid[0:SIZE, 0:SIZE]
    distance = np.sqrt((xs - cx * SIZE) ** 2 + (ys - cy * SIZE) ** 2) / (radius * SIZE)
    alpha = np.clip(1 - distance, 0, 1) ** 2 * opacity * 255
    layer = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    layer[..., 0], layer[..., 1], layer[..., 2] = color
    layer[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=int(40 * SCALE), fill=255)
canvas.paste(Image.new("RGBA", (SIZE, SIZE), BASE), (0, 0), mask)
for layer in (
    radial(0.86, 0.08, 0.80, PEAK, 0.60),
    radial(0.08, 0.96, 0.85, VALLEY, 0.50),
):
    canvas = Image.alpha_composite(canvas, Image.composite(layer, Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), mask))

draw = ImageDraw.Draw(canvas)
width = int(11 * SCALE)
radius = width // 2
strokes = [
    [(56, 44), (90, 82)], [(124, 44), (90, 82)], [(90, 82), (90, 134)],
    [(64, 97), (116, 97)], [(64, 113), (116, 113)],
]
for (x1, y1), (x2, y2) in strokes:
    p1, p2 = (x1 * SCALE, y1 * SCALE), (x2 * SCALE, y2 * SCALE)
    draw.line([p1, p2], fill=(255, 255, 255, 255), width=width)
    for x, y in (p1, p2):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 255, 255, 255))

canvas.resize((180, 180), Image.LANCZOS).save("assets/icon-180.png", optimize=True)
print("wrote assets/icon-180.png")
