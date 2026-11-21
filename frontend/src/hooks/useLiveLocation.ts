import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface LivePosition {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
}

export type LiveLocationStatus = 'asking' | 'on' | 'denied' | 'unavailable';

// Follows the device's position while `enabled`. Works on a phone and in a
// browser (which asks for permission the first time). Nothing is sent anywhere:
// the position is only drawn on the map.
export function useLiveLocation(enabled: boolean) {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState<LiveLocationStatus>('asking');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let subscription: { remove: () => void } | undefined;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
        (fix) => {
          if (!active) return;
          setStatus('on');
          setPosition({ latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? 0 });
        }
      );
      if (!active) subscription.remove();
    })().catch(() => active && setStatus('unavailable'));

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);

  return { position, status };
}
