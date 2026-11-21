import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { CommuteGoal, DaySchedule, Collection, Route, UserPreferences, DailyHealthSummary, WeekStats } from '../types';
import { API } from '../api/client';
import { todayKey } from '../utils/format';

interface AppContextValue {
  date: string; // the day being viewed, YYYY-MM-DD
  setDate: (date: string) => void;
  schedule: DaySchedule | null;
  loading: boolean;
  error: string | null; // last load failure, shown as a banner
  preferences: UserPreferences | null;
  collections: Collection[];
  health: DailyHealthSummary | null;
  week: WeekStats | null;
  refresh: () => Promise<void>; // schedule + health + week
  refreshCollections: () => Promise<void>;
  selectRoute: (routeId: string) => Promise<void>;
  updatePreferences: (prefs: UserPreferences) => Promise<void>;
  // The commute that is open on the Day tab and drawn on the Map tab (see commuteKey), or null.
  openCommute: string | null;
  setOpenCommute: (key: string | null) => void;
  setCommuteGreen: (route: Route, green: boolean) => Promise<void>; // green routes for that commute only
  setCommuteGoal: (route: Route, goal: CommuteGoal) => Promise<void>; // most steps / most CO2 saved, for that commute only
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [date, setDate] = useState(todayKey());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [health, setHealth] = useState<DailyHealthSummary | null>(null);
  const [week, setWeek] = useState<WeekStats | null>(null);
  const [openCommute, setOpenCommute] = useState<string | null>(null);
  const latest = useRef(0); // ignore responses for a day the user has already left

  const refresh = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const sched = await API.getDaySchedule(date);
      if (ticket !== latest.current) return;
      setSchedule(sched);
      setError(null);
      // These depend on the schedule having been planned (it records the day's totals).
      const [h, w] = await Promise.all([
        API.getHealthSummary(todayKey()).catch(() => null),
        API.getWeekStats().catch(() => null),
      ]);
      if (ticket !== latest.current) return;
      setHealth(h);
      setWeek(w);
    } catch (e) {
      if (ticket === latest.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [date]);

  const refreshCollections = useCallback(async () => {
    const res = await API.getCollections();
    setCollections(res.collections);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    API.getPreferences().then(setPreferences).catch(() => undefined);
    refreshCollections().catch(() => undefined);
  }, [refreshCollections]);

  const selectRoute = async (routeId: string) => {
    await API.selectRoute(routeId);
    await refresh();
  };

  const setCommuteGreen = async (route: Route, green: boolean) => {
    await API.setCommuteGreen(route.origin_event_id ?? '', route.destination_event_id ?? '', green);
    await refresh();
  };

  const setCommuteGoal = async (route: Route, goal: CommuteGoal) => {
    await API.setCommuteGoal(route.origin_event_id ?? '', route.destination_event_id ?? '', goal);
    await refresh();
  };

  const updatePreferences = async (prefs: UserPreferences) => {
    setPreferences(await API.updatePreferences(prefs));
    await refresh();
  };

  return (
    <AppContext.Provider
      value={{
        date,
        setDate,
        schedule,
        loading,
        error,
        preferences,
        collections,
        health,
        week,
        refresh,
        refreshCollections,
        selectRoute,
        updatePreferences,
        openCommute,
        setOpenCommute,
        setCommuteGreen,
        setCommuteGoal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
