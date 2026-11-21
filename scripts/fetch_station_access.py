#!/usr/bin/env python3
"""Regenerate the list of step-free STM metro stations from the official STM GTFS feed.

Usage: python3 scripts/fetch_station_access.py
Output: backend/internal/adapter/transit/data/accessible_stations.json

A station is listed when stops.txt has location_type=1 and wheelchair_boarding=1.
This is static data: it says a station HAS elevators, not that they work today.
"""
import csv
import io
import json
import pathlib
import urllib.request
import zipfile

URL = "https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip"
OUT = pathlib.Path(__file__).resolve().parent.parent / "backend/internal/adapter/transit/data/accessible_stations.json"


def main() -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "transit-hackathon-prototype"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        archive = zipfile.ZipFile(io.BytesIO(resp.read()))
    with archive.open("stops.txt") as f:
        rows = list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))
    with archive.open("feed_info.txt") as f:
        info = next(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")), {})

    stations = [r for r in rows if r.get("location_type") == "1"]
    accessible = sorted(r["stop_name"] for r in stations if r.get("wheelchair_boarding") == "1")
    OUT.write_text(json.dumps({
        "source": "STM GTFS stops.txt (wheelchair_boarding=1)",
        "feed_version": info.get("feed_version", ""),
        "station_count": len(stations),
        "accessible": accessible,
    }, ensure_ascii=False, indent=1))
    print(f"{len(accessible)} of {len(stations)} metro stations are step-free -> {OUT}")


if __name__ == "__main__":
    main()
