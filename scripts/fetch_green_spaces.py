#!/usr/bin/env python3
"""Regenerate the bundled Montreal green-space dataset from OpenStreetMap.

Usage: python3 scripts/fetch_green_spaces.py
Output: backend/internal/adapter/places/data/green_spaces.json
        rows of [name, min_lat, min_lon, max_lat, max_lon] (bounding boxes)

Data (c) OpenStreetMap contributors, ODbL.
"""
import json
import math
import pathlib
import urllib.parse
import urllib.request

BBOX = "45.40,-73.98,45.71,-73.40"  # greater Montreal
MIN_AREA_M2 = 2000  # drop pocket parks too small to matter for a walk
QUERY = f"""[out:json][timeout:60];
(way["leisure"~"^(park|nature_reserve|garden)$"]["name"]({BBOX});
 relation["leisure"~"^(park|nature_reserve)$"]["name"]({BBOX}););
out tags bb;"""
OUT = pathlib.Path(__file__).resolve().parent.parent / "backend/internal/adapter/places/data/green_spaces.json"


def main() -> None:
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data": QUERY}).encode(),
        headers={"User-Agent": "transit-hackathon-prototype"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        elements = json.load(resp)["elements"]

    rows = []
    for el in elements:
        b = el.get("bounds")
        if not b:
            continue
        h = (b["maxlat"] - b["minlat"]) * 111_320
        w = (b["maxlon"] - b["minlon"]) * 111_320 * math.cos(math.radians(b["minlat"]))
        if h * w < MIN_AREA_M2:
            continue
        rows.append([el["tags"]["name"], round(b["minlat"], 5), round(b["minlon"], 5),
                     round(b["maxlat"], 5), round(b["maxlon"], 5)])
    rows.sort(key=lambda r: (r[1], r[2]))
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(rows)} green spaces to {OUT}")


if __name__ == "__main__":
    main()
