import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Route } from '../types';
import { LivePosition } from '../hooks/useLiveLocation';
import { inkOn, lineColor, useAppTheme } from '../theme';

interface Props {
  route: Route | null; // null: just the map and the user's position
  position: LivePosition | null;
  focus: { leg: number | null; nonce: number }; // which stretch to frame (null: the whole trip); nonce re-frames
  locate: number; // bump to centre on the user's position
}

// What the page understands, sent with send().
type Message =
  | { type: 'position'; latitude: number; longitude: number; accuracy: number }
  | { type: 'frame'; leg: number | null }
  | { type: 'locate' };

// A map of one trip, in the manner of a maps app: each stretch drawn as its
// own section (walking as a row of dots, a vehicle as a solid band in its
// line's colour with the line's number on it), a marker at every change, a pin
// at the destination, and a blue dot where the user is.
//
// It is a Leaflet map inside a web view (an iframe on web), so it runs in
// Expo Go and in the browser without an API key. Tiles come from
// OpenStreetMap's public tile server, which is free for light use with
// attribution (shown on the map) but has no uptime guarantee and forbids heavy
// traffic: https://operations.osmfoundation.org/policies/tiles/
// For a released app, swap the tile URL for a paid/hosted provider.
export const TripMap: React.FC<Props> = ({ route, position, focus, locate }) => {
  const theme = useAppTheme();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const [ready, setReady] = useState(0); // counts page loads

  const html = useMemo(() => {
    const legs = (route?.nodes ?? [])
      .filter((n) => n.polyline)
      .map((n) => {
        const color = lineColor(n.mode, n.route_color, theme.dark);
        return {
          points: n.polyline,
          precision: n.polyline_precision ?? 5,
          color,
          ink: inkOn(color),
          walk: n.mode === 'walk',
          code: n.mode === 'walk' ? '' : n.line_code ?? '',
          from: n.station_or_stop_name ?? '',
          label: n.mode === 'walk' ? 'Walk' : n.transit_line ?? n.mode,
        };
      });
    const ends = route
      ? [
          [route.origin_location.latitude, route.origin_location.longitude, route.origin_location.name],
          [route.destination_location.latitude, route.destination_location.longitude, route.destination_location.name],
        ]
      : [];
    // The standard OpenStreetMap tiles have no dark style, so in dark mode
    // the tile layer is colour-inverted (the route and markers are not).
    const darkTiles = theme.dark
      ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9); }'
      : '';
    const walkColor = theme.dark ? '#8AB4F8' : '#1A73E8';

    return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${theme.colors.surfaceVariant}; }
  .leaflet-container { font: 12px system-ui, sans-serif; }
  .leaflet-control-attribution { font-size: 10px; background: rgba(255,255,255,0.75); }
  ${darkTiles}
  .me { width: 18px; height: 18px; border-radius: 50%; background: #1A73E8; border: 3px solid #fff;
        box-shadow: 0 1px 6px rgba(0,0,0,0.45); box-sizing: border-box; }
  .code { display: inline-block; transform: translate(-50%, -50%); padding: 2px 7px; border-radius: 6px;
          font: 700 12px system-ui, sans-serif; white-space: nowrap; border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35); }
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
    window.tandem = function () {};
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
  map.attributionControl.setPosition('bottomleft'); // the buttons sit bottom right
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var all = [], shapes = [];
  legs.forEach(function (leg, i) {
    var pts = decode(leg.points, leg.precision);
    shapes.push(pts);
    if (!pts.length) return;
    all = all.concat(pts);
    if (leg.walk) {
      // a row of round dots
      L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.9, dashArray: '0.1 13', lineCap: 'round' }).addTo(map);
      L.polyline(pts, { color: '${walkColor}', weight: 6, dashArray: '0.1 13', lineCap: 'round' }).addTo(map).bindPopup(esc(leg.label));
    } else {
      L.polyline(pts, { color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      L.polyline(pts, { color: leg.color, weight: 7, lineCap: 'round', lineJoin: 'round' }).addTo(map).bindPopup(esc(leg.label));
      if (leg.code) {
        L.marker(pts[Math.floor(pts.length / 2)], { interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0],
          html: '<span class="code" style="background:' + leg.color + ';color:' + leg.ink + '">' + esc(leg.code) + '</span>' }) }).addTo(map);
      }
    }
    if (i > 0) {
      // where you change: a white stop marker
      L.circleMarker(pts[0], { radius: 6, color: '#3C4043', weight: 2.5, fillColor: '#ffffff', fillOpacity: 1 })
        .addTo(map).bindPopup(esc(leg.from));
    }
  });
  if (ends.length) {
    all.push([ends[0][0], ends[0][1]], [ends[1][0], ends[1][1]]);
    L.circleMarker([ends[0][0], ends[0][1]], { radius: 7, color: '#3C4043', weight: 3, fillColor: '#ffffff', fillOpacity: 1 })
      .addTo(map).bindPopup(esc('Start: ' + ends[0][2]));
    L.marker([ends[1][0], ends[1][1]], { icon: L.divIcon({ className: '', iconSize: [30, 42], iconAnchor: [15, 41],
      html: '<svg width="30" height="42" viewBox="0 0 30 42"><path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.4 15 41 15 41s14-15.6 14-26.1C29 7.2 22.7 1 15 1z" fill="#EA4335" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>' }) })
      .addTo(map).bindPopup(esc('Destination: ' + ends[1][2]));
  }

  function frame(leg) {
    var pts = leg === null || leg === undefined ? all : shapes[leg];
    if (pts && pts.length) map.fitBounds(pts, { padding: [44, 44], maxZoom: 17 });
    else if (!all.length && !me) map.setView([45.5088, -73.5617], 11); // Montreal
  }

  var me = null, halo = null, followed = false;
  function place(lat, lon, accuracy) {
    var at = [lat, lon];
    if (!me) {
      halo = L.circle(at, { radius: accuracy, color: '#1A73E8', weight: 1, opacity: 0.35, fillColor: '#1A73E8', fillOpacity: 0.12, interactive: false }).addTo(map);
      me = L.marker(at, { zIndexOffset: 1000, icon: L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="me"></div>' }) })
        .addTo(map).bindPopup('You are here');
      if (!all.length && !followed) { followed = true; map.setView(at, 15); }
    } else {
      me.setLatLng(at); halo.setLatLng(at); halo.setRadius(accuracy);
    }
  }

  window.tandem = function (m) {
    if (!m || !m.type) return;
    if (m.type === 'position') place(m.latitude, m.longitude, m.accuracy || 0);
    if (m.type === 'frame') frame(m.leg);
    if (m.type === 'locate' && me) map.setView(me.getLatLng(), Math.max(map.getZoom(), 16));
  };
  window.addEventListener('message', function (e) { window.tandem(e.data); });
  if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(document.getElementById('map'));
  frame(null);
})();
</script></body></html>`;
  }, [route, theme]);

  const send = (message: Message) => {
    if (Platform.OS === 'web') frame.current?.contentWindow?.postMessage(message, '*');
    else web.current?.injectJavaScript(`window.tandem && window.tandem(${JSON.stringify(message)}); true;`);
  };

  // A page that has just loaded knows nothing yet: tell it where the user is.
  useEffect(() => {
    if (ready && position) send({ type: 'position', ...position });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, position]);
  useEffect(() => {
    if (ready && focus.nonce > 0) send({ type: 'frame', leg: focus.leg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useEffect(() => {
    if (ready && locate > 0) send({ type: 'locate' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate]);

  return (
    <View style={styles.fill}>
      {Platform.OS === 'web' ? (
        React.createElement('iframe', {
          ref: frame,
          srcDoc: html,
          title: 'Map of the trip',
          onLoad: () => setReady((n) => n + 1),
          style: { border: 0, width: '100%', height: '100%' },
        })
      ) : (
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://localhost' }}
          style={styles.web}
          onLoadEnd={() => setReady((n) => n + 1)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
});
