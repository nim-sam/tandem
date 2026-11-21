#!/usr/bin/env python3
"""Helpers for scripts/setup_routing.sh.

  gtfs_feed.py active <feed.zip>      exit 0 if the timetable runs within the next 7 days
  gtfs_feed.py range <feed.zip>       print "YYYYMMDD..YYYYMMDD", the dates the timetable covers
  gtfs_feed.py rtl-current <out.zip>  download the RTL timetable that is valid today

Why rtl-current: the RTL's "latest feed" link serves the NEXT season's
timetable for weeks before it starts. Loaded alone it has no trips today, so
the South Shore (Longueuil, Saint-Hubert, Brossard...) gets no bus routes. The
timetable in force is one of the dated files on the RTL's open-data page.
"""
import csv
import datetime
import io
import re
import sys
import urllib.parse
import urllib.request
import zipfile

RTL_PAGE = "https://www.rtl-longueuil.qc.ca/fr-CA/donnees-ouvertes/fichiers-gtfs/"
UA = {"User-Agent": "tandem-setup/0.1"}


def service_range(path):
    """First and last service date of a GTFS zip, and whether it runs in the next 7 days."""
    today = datetime.date.today()
    soon = (today + datetime.timedelta(days=7)).strftime("%Y%m%d")
    today = today.strftime("%Y%m%d")
    first, last, active = "99999999", "00000000", False
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        if "calendar.txt" in names:
            for row in csv.DictReader(io.TextIOWrapper(z.open("calendar.txt"), "utf-8-sig")):
                first, last = min(first, row["start_date"]), max(last, row["end_date"])
                if row["start_date"] <= soon and row["end_date"] >= today:
                    active = True
        if "calendar_dates.txt" in names:
            for row in csv.DictReader(io.TextIOWrapper(z.open("calendar_dates.txt"), "utf-8-sig")):
                if row.get("exception_type") == "1":
                    first, last = min(first, row["date"]), max(last, row["date"])
                    if today <= row["date"] <= soon:
                        active = True
    return first, last, active


def rtl_current(out):
    html = urllib.request.urlopen(urllib.request.Request(RTL_PAGE, headers=UA), timeout=60).read().decode("utf-8", "replace")
    today = datetime.date.today().strftime("%Y%m%d")
    # Files are named after the day they take effect: 20261105.zip, Data-20260622.zip...
    dated = {}
    for link in re.findall(r'href="([^"]+\.zip[^"]*)"', html):
        found = re.search(r"(20\d{6})[^/]*\.zip", link)
        if found and found.group(1) <= today:
            dated[urllib.parse.urljoin(RTL_PAGE, link.replace("&amp;", "&"))] = found.group(1)
    # Newest first; stop at the first one in force.
    for url in sorted(dated, key=dated.get, reverse=True)[:4]:
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
            with open(out, "wb") as f:
                f.write(data)
            first, last, active = service_range(out)
        except Exception as e:  # a dead link or a broken file: try the next one
            print(f"  skip {url}: {e}", file=sys.stderr)
            continue
        if active:
            print(f"  ok   {out} (RTL timetable {first}..{last})")
            return 0
    print("  FAIL no RTL timetable valid today was found on " + RTL_PAGE, file=sys.stderr)
    return 1


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    command, path = sys.argv[1], sys.argv[2]
    if command == "rtl-current":
        return rtl_current(path)
    first, last, active = service_range(path)
    if command == "range":
        print(f"{first}..{last}")
        return 0
    if command == "active":
        return 0 if active else 1
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
