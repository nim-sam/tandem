#!/usr/bin/env python3
"""Builds mockups/banner.png (and banner-readme.png, the same without the logo): the logo, name and a line about the app on the
left, and the screenshots tiled on a diagonal in the right-hand corner.

Run from the project root after the mockups are captured:
    python3 scripts/make_banner.py
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo import BAR_ON_LIGHT, mark  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 2560, 1040  # drawn at twice the size GitHub shows it
DEEP, PRIMARY, MEDIUM, SOFT, WHITE = (22, 56, 102), (35, 79, 145), (82, 121, 184), (169, 189, 224), (255, 255, 255)

NAME = "Tandem"
TAGLINE = ["Your calendar and", "public transit,", "planned together."]
DESCRIPTION = [
    "It plans the trip between every event in",
    "your day, tells you when to leave, and",
    "finds time for a greener walk.",
]

# Screens in each column, top to bottom; columns run left to right.
COLUMNS = [
    # the day's schedule leads: these two columns are the ones nearest the text
    ["dark/05-calendar-week", "light/10-green-routes", "dark/02-day-route"],
    ["light/03-route-details", "dark/01-day", "light/02-day-route", "dark/04-calendar-month"],
    ["light/07-activity", "dark/03-route-details", "light/04-calendar-month", "dark/09-settings-learned"],
    ["light/08-settings", "dark/07-activity", "light/05-calendar-week", "dark/08-settings"],
]
TILE_W, GAP, ANGLE = 400, 44, 18
STAGGER = [0, -330, -120, -450]  # vertical offset of each column


def font(weight, size):
    path = glob.glob(os.path.join(ROOT, f"frontend/node_modules/@expo-google-fonts/figtree/*/Figtree_{weight}.ttf"))[0]
    return ImageFont.truetype(path, size)


def tiles():
    """The screenshots in staggered columns with soft shadows, on a transparent sheet."""
    tile_h = round(TILE_W * 2208 / 1242)
    rows = max(len(c) for c in COLUMNS)
    pad = 500
    sheet_w = len(COLUMNS) * (TILE_W + GAP) + 2 * pad
    sheet_h = rows * (tile_h + GAP) + 2 * pad
    shadow = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    radius = round(120 * TILE_W / 1242)
    for c, column in enumerate(COLUMNS):
        for r, name in enumerate(column):
            shot = Image.open(os.path.join(ROOT, "mockups", name + ".png")).convert("RGBA").resize((TILE_W, tile_h), Image.LANCZOS)
            x = pad + c * (TILE_W + GAP)
            y = pad + STAGGER[c] + r * (tile_h + GAP)
            ImageDraw.Draw(shadow).rounded_rectangle((x, y + 18, x + TILE_W, y + tile_h + 18), radius=radius, fill=(6, 18, 40, 150))
            sheet.alpha_composite(shot, (x, y))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    shadow.alpha_composite(sheet)
    return shadow.rotate(ANGLE, resample=Image.BICUBIC, expand=True)


def build(lockup):
    """The banner. With `lockup`, the logo and name sit above the headline."""
    # Ground: deep blue, a little lighter towards the corner the screens sit in.
    banner = Image.new("RGBA", (W, H), DEEP + (255,))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((W * 0.45, -H * 0.5, W * 1.35, H * 1.3), fill=PRIMARY + (255,))
    banner.alpha_composite(glow.filter(ImageFilter.GaussianBlur(260)))

    grid = tiles()
    # Centre of the tiled sheet sits right of centre, so the screens run off the top, right and bottom edges.
    banner.alpha_composite(grid, (round(W * 0.81 - grid.width / 2), round(H * 0.5 - grid.height / 2)))

    d = ImageDraw.Draw(banner)
    left, tile, after_logo, line, small, gap = 150, 148, 96, 110, 58, 46
    height = len(TAGLINE) * line + gap + len(DESCRIPTION) * small + (tile + after_logo if lockup else 0)
    y = round((H - height) / 2)  # the text block is centred top to bottom

    if lockup:  # the mark on a white rounded tile, with the name beside it
        d.rounded_rectangle((left, y, left + tile, y + tile), radius=38, fill=WHITE)
        banner.alpha_composite(mark(tile, PRIMARY, BAR_ON_LIGHT, scale=1.08), (left, y))
        d.text((left + tile + 40, y + tile / 2), NAME, font=font("700Bold", 124), fill=WHITE, anchor="lm")
        y += tile + after_logo

    for text in TAGLINE:
        d.text((left, y), text, font=font("600SemiBold", 92), fill=WHITE)
        y += line
    y += gap
    for text in DESCRIPTION:
        d.text((left, y), text, font=font("400Regular", 40), fill=SOFT)
        y += small
    return banner.convert("RGB")


def main():
    # banner.png stands alone (slides, social cards). banner-readme.png leaves the
    # logo and name out, because the README shows them right above it.
    for name, lockup in (("banner.png", True), ("banner-readme.png", False)):
        out = os.path.join(ROOT, "mockups", name)
        build(lockup).save(out, optimize=True)
        print(out)


if __name__ == "__main__":
    main()
