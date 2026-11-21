// Local-date helpers. Dates are exchanged with the backend as YYYY-MM-DD in
// the device's time zone; never use toISOString() for that (it is UTC).

export const toDateKey = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, days: number): string => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export const todayKey = (): string => toDateKey(new Date());

export const toHHMM = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 24-hour times, as on Montréal transit schedules; keeps the time column narrow.
export const formatTime = (iso: string): string => toHHMM(iso);

export const formatDay = (key: string): string => {
  if (key === todayKey()) return 'Today';
  if (key === addDays(todayKey(), 1)) return 'Tomorrow';
  if (key === addDays(todayKey(), -1)) return 'Yesterday';
  return fromDateKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

// "HH:MM" on a given local date -> ISO string, or null if the text is not a time.
export const timeOnDate = (dateKey: string, hhmm: string): string | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  const d = fromDateKey(dateKey);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};


export const formatCO2 = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;

export const formatDuration = (minutes: number): string =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
