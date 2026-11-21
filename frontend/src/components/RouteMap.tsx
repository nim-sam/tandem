import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Route } from '../types';
import { lineColor, useAppTheme } from '../theme';

interface Props {
  route: Route;
  height?: number;
}

// An interactive map of one route: every leg drawn in its line colour, with
// markers for the start, each transfer and the destination.
//
// It is a Leaflet map inside a web view (an iframe on web), so it works in
// Expo Go on Android and iOS and in the browser without an API key.
// Tiles come from OpenStreetMap's public tile server, which is free for light
// use with attribution (shown on the map) but has no uptime guarantee and
// forbids heavy traffic: https://operations.osmfoundation.org/policies/tiles/
// For a released app, swap the tile URL for a paid/hosted provider.
export const RouteMap: React.FC<Props> = ({ route, height = 260 }) => {
  const theme = useAppTheme();

  const html = useMemo(() => {
    const legs = route.nodes
      .filter((n) => n.polyline)
      .map((n) => ({
        points: n.polyline,
        precision: n.polyline_precision ?? 5,
        color: lineColor(n.mode, n.route_color, theme.dark),
        dashed: n.mode === 'walk',
        from: n.station_or_stop_name ?? '',
        label: n.mode === 'walk' ? 'Walk' : n.transit_line ?? n.mode,
      }));
    // Routes without geometry (offline demo data) still show both ends.
    const ends = [
      [route.origin_location.latitude, route.origin_location.longitude, route.origin_location.name],
      [route.destination_location.latitude, route.destination_location.longitude, route.destination_location.name],
    ];
    // The standard OpenStreetMap tiles have no dark style, so in dark mode
    // the tile layer is colour-inverted (the route lines are not).
    const darkTiles = theme.dark
      ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9); }'
      : '';

    return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${theme.colors.surfaceVariant}; }
  .leaflet-container { font: 12px system-ui, sans-serif; }
  ${darkTiles}
  #fail { display: none; height: 100%; align-items: center; justify-content: center;
          color: ${theme.colors.onSurfaceVariant}; font: 14px system-ui, sans-serif; text-align: center; padding: 16px; }
</style></head><body>
<div id="map"></div><div id="fail">The map could not load. Check the internet connection.</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  if (typeof L === 'undefined') {
    document.getElementById('map').style.display = 'none';
    document.getElementById('fail').style.display = 'flex';
    return;
  }
  var legs = ${JSON.stringify(legs)};
  var ends = ${JSON.stringify(ends)};

  function decode(str, precision) {
    var index = 0, lat = 0, lng = 0, out = [], factor = Math.pow(10, precision);
    while (index < str.length) {
      var coords = [0, 0];
      for (var k = 0; k < 2; k++) {
        var result = 0, shift = 0, b;
        do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        coords[k] = (result & 1) ? ~(result >> 1) : (result >> 1);
      }
      lat += coords[0]; lng += coords[1];
      out.push([lat / factor, lng / factor]);
    }
    return out;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var all = [];
  legs.forEach(function (leg, i) {
    var pts = decode(leg.points, leg.precision);
    if (!pts.length) return;
    all = all.concat(pts);
    L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(map);
    L.polyline(pts, { color: leg.color, weight: 5, dashArray: leg.dashed ? '2 9' : null, lineCap: 'round' })
      .addTo(map).bindPopup(esc(leg.label));
    if (i > 0) {
      L.circleMarker(pts[0], { radius: 5, color: leg.color, weight: 3, fillColor: '#ffffff', fillOpacity: 1 })
        .addTo(map).bindPopup(esc(leg.from));
    }
  });
  ends.forEach(function (e, i) {
    all.push([e[0], e[1]]);
    L.circleMarker([e[0], e[1]], { radius: 8, color: '#ffffff', weight: 3, fillColor: i === 0 ? '#163866' : '#234F91', fillOpacity: 1 })
      .addTo(map).bindPopup(esc((i === 0 ? 'Start: ' : 'Destination: ') + e[2]));
  });
  map.fitBounds(all, { padding: [28, 28] });
})();
</script></body></html>`;
  }, [route, theme]);

  return (
    <View style={[styles.frame, { height, borderColor: theme.colors.outlineVariant }]}>
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          srcDoc: html,
          title: 'Route map',
          style: { border: 0, width: '100%', height: '100%' },
        })
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://localhost' }}
          style={styles.web}
          scrollEnabled={false}
          nestedScrollEnabled
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
