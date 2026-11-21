#!/usr/bin/env bash
# Builds a local routing engine (MOTIS, the software behind Transitous) for
# greater Montreal in ./routing.
#
# Why: the public Transitous server has no timetable for the STL (Laval), so
# trips to, from or across Laval come back as long detours on exo buses. This
# loads every agency of the region, STL included, into a server of our own.
#
# Run again every few weeks: agencies publish new timetables each season and
# an expired timetable returns no trips. Takes a few minutes and about 2 GB.
set -euo pipefail

MOTIS_VERSION="v2.11.4"
DIR="$(cd "$(dirname "$0")/.." && pwd)/routing"
PORT="${MOTIS_PORT:-8082}"
mkdir -p "$DIR/feeds"
cd "$DIR"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) TARGET=linux-amd64 ;;
  Linux-aarch64) TARGET=linux-arm64 ;;
  Darwin-arm64) TARGET=macos-arm64 ;;
  *) echo "No MOTIS build for $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

fetch() { # fetch <url> <file>: download, keeping the old file if the download fails
  if curl -fsSL --retry 2 -m 600 -o "$2.part" "$1"; then
    mv "$2.part" "$2"
    echo "  ok   $2"
  else
    rm -f "$2.part"
    echo "  FAIL $2 ($1)" >&2
    return 1
  fi
}

if [ ! -x motis ] || [ "$(cat .motis-version 2>/dev/null)" != "$MOTIS_VERSION" ]; then
  echo "Downloading MOTIS $MOTIS_VERSION..."
  fetch "https://github.com/motis-project/motis/releases/download/$MOTIS_VERSION/motis-$TARGET.tar.bz2" motis.tar.bz2
  tar xf motis.tar.bz2 && rm motis.tar.bz2
  echo "$MOTIS_VERSION" > .motis-version
fi

echo "Downloading the street map (OpenStreetMap, Montreal region)..."
fetch "https://download.bbbike.org/osm/bbbike/Montreal/Montreal.osm.pbf" montreal.osm.pbf

# tag|url. The tag prefixes stop IDs; it must not contain "_".
FEEDS="
stm|https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip
stl|https://stlaval.ca/datas/opendata/GTF_STL.zip
rtl|https://www.rtl-longueuil.qc.ca/transit/latestfeed/RTL.zip
rem|https://gtfs.gpmmom.ca/gtfs/gtfs.zip
"
for sector in trains citla mrclm mrclasso citsv citso citpi lrrs citcrc citvr omitsju cithsl; do
  FEEDS+="exo${sector}|https://exo.quebec/xdata/${sector}/google_transit.zip"$'\n'
done

echo "Downloading timetables..."
DATASETS=""
while IFS='|' read -r tag url; do
  [ -n "$tag" ] || continue
  fetch "$url" "feeds/$tag.zip" || true
  # A feed that could not be downloaded is left out rather than failing the lot.
  if [ -s "feeds/$tag.zip" ] && unzip -tq "feeds/$tag.zip" >/dev/null 2>&1; then
    DATASETS+="    $tag:"$'\n'"      path: feeds/$tag.zip"$'\n'
  else
    echo "  skipping $tag: no usable file" >&2
  fi
done <<< "$FEEDS"
grep -q "^    stl:" <<< "$DATASETS" || { echo "The STL timetable is missing; not building." >&2; exit 1; }

cat > config.yml <<YAML
# Written by scripts/setup_routing.sh; edits are overwritten.
server:
  host: 127.0.0.1
  port: $PORT
osm: montreal.osm.pbf
timetable:
  first_day: TODAY
  num_days: 120
  with_shapes: true
  extend_missing_footpaths: true
  datasets:
$DATASETS
street_routing: true
osr_footpath: true
geocoding: true
YAML

echo "Building routing data (a few minutes)..."
./motis import
date +%F > .built
echo "Done. 'make dev' now routes with the local engine (port $PORT)."
