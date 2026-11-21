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

// Weeks run Monday to Sunday.
export const mondayOf = (key: string): string => addDays(key, -((fromDateKey(key).getDay() + 6) % 7));

export const startOfMonth = (key: string): string => `${key.slice(0, 8)}01`;

export const addMonths = (key: string, months: number): string => {
  const d = fromDateKey(startOfMonth(key));
  d.setMonth(d.getMonth() + months);
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

// Yesterday, today or tomorrow: formatDay() names these instead of giving the date.
export const isNearDay = (key: string): boolean => Math.abs(fromDateKey(key).getTime() - fromDateKey(todayKey()).getTime()) < 36 * 3600 * 1000;

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

const amount = (n: number): string => (n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n).toLocaleString());

// Ways to picture an amount of CO2. All are rough, rounded figures:
//  - a car emits about 171 g per km (the figure the server compares routes against)
//  - burning a litre of gasoline emits about 2.3 kg
//  - a mature tree absorbs about 22 kg a year, so about 60 g a day
const CO2_EQUIVALENTS: ((grams: number, short: boolean) => string)[] = [
  (g, short) => (short ? `${amount(g / 171)} km by car` : `the exhaust of ${amount(g / 171)} km driven by car`),
  (g, short) =>
    `${short ? '' : 'burning '}${g < 2300 ? `${Math.round(g / 2.3)} mL` : `${amount(g / 2300)} L`} of gasoline`,
  (g, short) => {
    const days = g / 60;
    if (days >= 365) return short ? `${amount(days / 365)} trees for a year` : `what ${amount(days / 365)} mature trees absorb in a year`;
    if (days < 1.5) return short ? 'a tree for a day' : 'what a mature tree absorbs in a day';
    return short ? `a tree for ${amount(days)} days` : `what a mature tree absorbs in ${amount(days)} days`;
  },
];

// One comparison is picked at random each time the app is opened.
const co2Pick = Math.floor(Math.random() * CO2_EQUIVALENTS.length);

// "the exhaust of 12 km driven by car": the same CO2, pictured. Empty for
// amounts too small to compare with anything.
// `short` is the caption form: "12 km by car".
export const co2Equivalent = (grams: number, short = false): string =>
  grams >= 50 ? CO2_EQUIVALENTS[co2Pick](grams, short) : '';

export const formatDuration = (minutes: number): string =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

// A commute's identity within a day: the events (or day ends) it joins. Unlike
// its id, it stays the same when the day is planned again.
export const commuteKey = (route: { origin_event_id?: string; destination_event_id?: string }): string =>
  `${route.origin_event_id ?? ''}>${route.destination_event_id ?? ''}`;

// The commute that matters now: the one under way, or else the next to leave.
// Null when every trip of the day has already arrived (or there are none).
export const currentCommute = <T extends { arrival_time: string }>(commutes: T[], now = Date.now()): T | null =>
  commutes.find((c) => new Date(c.arrival_time).getTime() >= now) ?? null;
