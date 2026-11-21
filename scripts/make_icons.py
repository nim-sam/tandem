#!/usr/bin/env python3
"""Writes the app's icon, splash and favicon images to frontend/assets.

Run from the project root:
    python3 scripts/make_icons.py
"""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo import BAR_ON_BLUE, BAR_ON_LIGHT, mark  # noqa: E402

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "assets")
PRIMARY, MEDIUM, SOFT, PALE, WHITE = (35, 79, 145), (82, 121, 184), (169, 189, 224), (223, 232, 247), (255, 255, 255)


def main():
    os.makedirs(ASSETS, exist_ok=True)

    # App icon: full-bleed blue; the stores round the corners themselves.
    icon = Image.new("RGBA", (1024, 1024), PRIMARY + (255,))
    icon.alpha_composite(mark(1024, WHITE, BAR_ON_BLUE))
    icon.convert("RGB").save(os.path.join(ASSETS, "icon.png"))

    # Android adaptive icon: the mark alone, inside the safe zone; the blue comes from app.json.
    mark(1024, WHITE, BAR_ON_BLUE, scale=0.7).save(os.path.join(ASSETS, "adaptive-icon.png"))

    # Splash: the mark on the app's ground colour (set in app.json), light and dark.
    mark(1024, PRIMARY, BAR_ON_LIGHT).save(os.path.join(ASSETS, "splash-icon.png"))
    mark(1024, PALE, MEDIUM).save(os.path.join(ASSETS, "splash-icon-dark.png"))

    # Favicon: a rounded blue tile.
    ss = 4
    tile = Image.new("RGBA", (196 * ss, 196 * ss), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 196 * ss - 1, 196 * ss - 1), radius=44 * ss, fill=PRIMARY + (255,))
    tile = tile.resize((196, 196), Image.LANCZOS)
    tile.alpha_composite(mark(196, WHITE, BAR_ON_BLUE, scale=1.08))
    tile.save(os.path.join(ASSETS, "favicon.png"))
    print("wrote icon, adaptive-icon, splash-icon, splash-icon-dark, favicon to", ASSETS)


if __name__ == "__main__":
    main()
