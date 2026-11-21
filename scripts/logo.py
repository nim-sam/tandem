"""The Tandem mark: a cursive lowercase t drawn as two transit lines.

The stem is one line: it comes down from the top and sweeps out to the right
at its foot, as a handwritten t does. The crossbar is a second line crossing
it, passing behind. A ring-shaped station marker sits at each end of the stem:
at its top and at its tail. Used by make_icons.py and make_banner.py.
"""
from PIL import Image, ImageChops, ImageDraw

SS = 4  # drawn oversized, then scaled down, for smooth edges

# The crossbar's colour: clearly apart from the stem's, still visible on the ground.
BAR_ON_BLUE = (112, 146, 201)  # under a white stem, on the brand blue
BAR_ON_LIGHT = (140, 168, 215)  # under a blue stem, on white or the ice ground

# Each stroke is a cubic curve in unit coordinates: start, two control points, end.
STEM = ((0.50, 0.155), (0.475, 0.50), (0.39, 0.915), (0.745, 0.70))
BAR = ((0.235, 0.45), (0.40, 0.37), (0.55, 0.44), (0.725, 0.355))


def _point(curve, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = curve
    a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t**2, t**3
    return a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3


def mark(size, main, second, scale=1.0):
    """The mark on a transparent square. `main` is the stem's RGB colour and `second` the crossbar's.
    The station rings are cut through, so whatever is behind the mark shows in them."""
    s = size * SS
    centre = s / 2
    w = s * 0.112 * scale  # line thickness

    def at(x, y):  # unit coordinates (0..1, centred on 0.5) -> pixels
        return centre + (x - 0.5) * s * scale, centre + (y - 0.5) * s * scale

    def disc(mask, x, y, r, fill):
        px, py = at(x, y)
        ImageDraw.Draw(mask).ellipse((px - r, py - r, px + r, py + r), fill=fill)

    def stroke(mask, curve):  # overlapping discs along the curve make a smooth, round-ended line
        for i in range(601):
            disc(mask, *_point(curve, i / 600), w / 2, 255)

    stem_mask = Image.new("L", (s, s), 0)
    bar_mask = Image.new("L", (s, s), 0)
    holes = Image.new("L", (s, s), 255)
    stroke(stem_mask, STEM)
    stroke(bar_mask, BAR)
    for x, y in (STEM[0], STEM[3]):
        outer = w * 0.88
        disc(stem_mask, x, y, outer, 255)
        disc(holes, x, y, outer * 0.48, 0)

    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    # The crossbar passes under the stem, and never shows through the stem's rings.
    under = Image.new("RGBA", (s, s), tuple(second[:3]) + (255,))
    under.putalpha(ImageChops.multiply(bar_mask, ImageChops.invert(stem_mask)))
    out.alpha_composite(under)
    over = Image.new("RGBA", (s, s), tuple(main[:3]) + (255,))
    over.putalpha(ImageChops.multiply(stem_mask, holes))
    out.alpha_composite(over)
    # Centre the drawn shape in the square: the letter itself is not symmetrical.
    box = out.getbbox()
    if box:
        out = ImageChops.offset(out, round(centre - (box[0] + box[2]) / 2), round(centre - (box[1] + box[3]) / 2))
    return out.resize((size, size), Image.LANCZOS)
