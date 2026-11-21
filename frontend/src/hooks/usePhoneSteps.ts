import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { API } from '../api/client';
import { todayKey } from '../utils/format';

export type PedometerStatus = 'checking' | 'counting' | 'unavailable' | 'denied';

// Reads today's steps from the phone's own motion sensor and reports them to
// the backend, so no smartwatch account is needed.
//
//  - iOS: the phone keeps the day's history, so the total since midnight is exact.
//  - Android: the sensor only reports steps taken while the app is open, so the
//    count is added on top of what was already recorded today. It undercounts
//    when the app is closed (Health Connect would be the fix).
//  - Web: no step sensor.
export function usePhoneSteps(enabled: boolean, alreadyRecorded: number) {
  const [status, setStatus] = useState<PedometerStatus>('checking');
  const [steps, setSteps] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return;
    }
    let active = true;
    let subscription: { remove: () => void } | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastSent = -1;

    const publish = (total: number) => {
      if (!active) return;
      setSteps(total);
      // Report at most every 50 steps to keep traffic low.
      if (Math.abs(total - lastSent) >= 50 || lastSent < 0) {
        lastSent = total;
        API.reportSteps(todayKey(), total).catch(() => undefined);
      }
    };

    (async () => {
      if (!(await Pedometer.isAvailableAsync())) {
        if (active) setStatus('unavailable');
        return;
      }
      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        if (active) setStatus('denied');
        return;
      }
      if (!active) return;
      setStatus('counting');

      if (Platform.OS === 'ios') {
        const read = async () => {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const result = await Pedometer.getStepCountAsync(midnight, new Date());
          publish(result.steps);
        };
        await read();
        timer = setInterval(() => read().catch(() => undefined), 60000);
      } else {
        const base = alreadyRecorded;
        publish(base);
        subscription = Pedometer.watchStepCount((result) => publish(base + result.steps));
      }
    })().catch(() => active && setStatus('unavailable'));

    return () => {
      active = false;
      subscription?.remove();
      if (timer) clearInterval(timer);
    };
    // alreadyRecorded is only the starting point; do not restart counting when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, steps };
}
