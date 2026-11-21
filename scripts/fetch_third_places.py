#!/usr/bin/env python3
"""Regenerate the bundled places dataset (libraries, cafes, community centres,
restaurants and fast-food places) for greater Montreal from OpenStreetMap.

Usage: python3 scripts/fetch_third_places.py
Output: backend/internal/adapter/places/data/third_places.json
        rows of [name, type, lat, lon, has_wifi, outdoor_seating, cuisine, vegetarian]
        cuisine is OpenStreetMap's tag ("pizza", "sushi;japanese", "" when unknown).

OpenStreetMap has no reliable price information, so there is none here.

Data (c) OpenStreetMap contributors, ODbL.
"""
import json
import pathlib
import urllib.parse
import urllib.request

BBOX = "45.40,-73.98,45.71,-73.40"
QUERY = f"""[out:json][timeout:120];
(nwr["amenity"="library"]["name"]({BBOX});
 nwr["amenity"="cafe"]["name"]({BBOX});
 nwr["amenity"="community_centre"]["name"]({BBOX});
 nwr["amenity"="restaurant"]["name"]({BBOX});
 nwr["amenity"="fast_food"]["name"]({BBOX}););
out tags center;"""
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OUT = pathlib.Path(__file__).resolve().parent.parent / "backend/internal/adapter/places/data/third_places.json"


def main() -> None:
    elements = None
    for server in MIRRORS:  # the public servers are often busy; try each in turn
        req = urllib.request.Request(
            server,
            data=urllib.parse.urlencode({"data": QUERY}).encode(),
            headers={"User-Agent": "transit-hackathon-prototype"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                elements = json.load(resp)["elements"]
            break
        except Exception as err:  # noqa: BLE001
            print(f"{server} failed: {err}")
    if elements is None:
        raise SystemExit("all Overpass servers failed; try again later")

    rows = []
    for el in elements:
        tags = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        wifi = tags.get("internet_access") in ("wlan", "yes", "wifi")
        outdoor = tags.get("outdoor_seating") == "yes"
        veg = tags.get("diet:vegetarian") in ("yes", "only") or tags.get("diet:vegan") in ("yes", "only")
        cuisine = tags.get("cuisine", "").lower()
        rows.append([tags["name"], tags["amenity"], round(lat, 5), round(lon, 5), int(wifi), int(outdoor), cuisine, int(veg)])
    rows.sort(key=lambda r: (r[1], r[0]))
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    kinds = {}
    for r in rows:
        kinds[r[1]] = kinds.get(r[1], 0) + 1
    print(f"wrote {len(rows)} third places {kinds} to {OUT}")


if __name__ == "__main__":
    main()
