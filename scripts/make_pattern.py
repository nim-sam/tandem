#!/usr/bin/env python3
"""Writes the faint transit-map pattern drawn behind every screen but the map:
frontend/assets/pattern-light.png and pattern-dark.png.

It is one square tile that repeats without a seam: three lines of a route map
with their stations, in a single colour at a few percent opacity.

Run from the project root:
    python3 scripts/make_pattern.py
"""
import os

from PIL import Image, ImageDraw

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "assets")
TILE, SS = 360, 4  # tile size in points; drawn oversized for smooth edges
SCALE = 2  # saved at 2x so it stays crisp on phone screens

# Each line leaves the tile where it enters on the opposite edge, so tiles join up.
LINES = [
    [(0, 90), (110, 90), (160, 140), (250, 140), (300, 90), (360, 90)],
    [(70, 0), (70, 200), (120, 250), (120, 300), (70, 350), (70, 360)],
    [(215, 0), (215, 360)],
]
STATIONS = [(40, 90), (330, 90), (70, 40), (70, 160), (120, 275), (215, 55), (215, 230), (215, 320)]
INTERCHANGES = [(70, 90), (215, 140)]


def tile(rgb, alpha):
    s = TILE * SS
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    w = 3 * SS
    for line in LINES:
        pts = [(x * SS, y * SS) for x, y in line]
        d.line(pts, fill=255, width=w, joint="curve")
        for x, y in pts[1:-1]:
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=255)
    for points, outer, inner in ((STATIONS, 6.5, 3.5), (INTERCHANGES, 9.5, 5.5)):
        for x, y in points:
            x, y = x * SS, y * SS
            d.ellipse((x - outer * SS, y - outer * SS, x + outer * SS, y + outer * SS), fill=255)
            d.ellipse((x - inner * SS, y - inner * SS, x + inner * SS, y + inner * SS), fill=0)
    mask = mask.resize((TILE * SCALE, TILE * SCALE), Image.LANCZOS).point(lambda v: round(v * alpha))
    out = Image.new("RGBA", (TILE * SCALE, TILE * SCALE), rgb + (0,))
    out.putalpha(mask)
    return out


def main():
    os.makedirs(ASSETS, exist_ok=True)
    tile((35, 79, 145), 0.06).save(os.path.join(ASSETS, "pattern-light@2x.png"))
    tile((169, 189, 224), 0.05).save(os.path.join(ASSETS, "pattern-dark@2x.png"))
    # the 1x files the bundler looks for first
    for name in ("pattern-light", "pattern-dark"):
        big = Image.open(os.path.join(ASSETS, name + "@2x.png"))
        big.resize((TILE, TILE), Image.LANCZOS).save(os.path.join(ASSETS, name + ".png"))
    print("wrote pattern-light and pattern-dark (1x and 2x) to", ASSETS)


if __name__ == "__main__":
    main()
