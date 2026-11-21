import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DaySchedule } from '../types';
import { formatTime } from '../utils/format';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Schedules a local "time to leave" notification for every commute in the
// schedule that has not departed yet: a heads-up 10 minutes before, and one
// at the moment to leave. Rescheduled whenever the schedule changes (a new
// event, a different route), so stale reminders never fire.
//
// Local notifications need no server. They are not available in a browser.
export function useLeaveNotifications(schedule: DaySchedule | null, enabled: boolean) {
  useEffect(() => {
    if (Platform.OS === 'web' || !schedule || !enabled) return;
    let cancelled = false;

    (async () => {
      const current = await Notifications.getPermissionsAsync();
      const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('leave', {
          name: 'Time to leave',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      await Notifications.cancelAllScheduledNotificationsAsync();

      const titles = new Map(schedule.events.map((e) => [e.id, e.title]));
      for (const commute of schedule.commutes) {
        const leave = new Date(commute.departure_time);
        const destination = titles.get(commute.destination_event_id ?? '') ?? commute.destination_location.name;
        const first = commute.nodes[0]?.instruction ?? '';
        const reminders = [
          { at: new Date(leave.getTime() - 10 * 60000), title: `Leave in 10 min for ${destination}` },
          { at: leave, title: `Time to leave for ${destination}` },
        ];
        for (const r of reminders) {
          if (cancelled || r.at.getTime() <= Date.now()) continue;
          await Notifications.scheduleNotificationAsync({
            content: { title: r.title, body: `Leave at ${formatTime(commute.departure_time)}. ${first}` },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'leave' },
          });
        }
      }
    })().catch((e) => console.warn('Could not schedule leave notifications:', e));

    return () => {
      cancelled = true;
    };
  }, [schedule, enabled]);
}
