import {
  DaySchedule,
  Route,
  CommuteGoal,
  NearbyPlace,
  DayEndpoint,
  EndpointKind,
  Event,
  Collection,
  SavedPlace,
  UserPreferences,
  DailyHealthSummary,
  Location,
  WeekStats,
  LearnedWeights,
  CalendarSyncResult,
} from '../types';

// On a physical phone "localhost" is the phone itself. Set EXPO_PUBLIC_API_URL
// to the laptop's LAN address, e.g. http://192.168.1.20:8080/api (see .env.example).
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_BASE}. Is the backend running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);
  }
  return data as T;
}

export const API = {
  // Day schedule & commutes
  getDaySchedule: (date: string) => request<DaySchedule>(`/routes/day?date=${date}`),
  // Start or end one day somewhere other than home (coordinates 0,0: the server looks the address up).
  setDayEndpoint: (date: string, which: EndpointKind, endpoint: Pick<DayEndpoint, 'location' | 'category'>) =>
    request<DayEndpoint>(`/routes/day/${date}/${which}`, 'PUT', endpoint),
  resetDayEndpoint: (date: string, which: EndpointKind) => request<void>(`/routes/day/${date}/${which}`, 'DELETE'),
  // The user prefers this alternative: pins it and trains the ranking agent.
  selectRoute: (routeId: string) => request<void>('/routes/select', 'POST', { route_id: routeId }),
  // Green routes on or off for one commute only, whatever the setting says.
  setCommuteGreen: (originEventId: string, destinationEventId: string, green: boolean) =>
    request<void>('/routes/green', 'PUT', {
      origin_event_id: originEventId,
      destination_event_id: destinationEventId,
      green,
    }),
  // The route that commute would get with green routes on (or off). Changes nothing.
  previewCommuteGreen: (date: string, originEventId: string, destinationEventId: string, green: boolean) =>
    request<Route>('/routes/green/preview', 'POST', {
      date,
      origin_event_id: originEventId,
      destination_event_id: destinationEventId,
      green,
    }),
  // One commute: prefer the option with the most steps or the most CO2 saved ('' = the usual ranking).
  setCommuteGoal: (originEventId: string, destinationEventId: string, goal: CommuteGoal) =>
    request<void>('/routes/goal', 'PUT', { origin_event_id: originEventId, destination_event_id: destinationEventId, goal }),
  // Cafés, restaurants or parks around a point, nearest first; `refine` narrows it down.
  nearbyPlaces: (lat: number, lon: number, category: string, refine: string[]) =>
    request<{ places: NearbyPlace[] }>(`/places/nearby?lat=${lat}&lon=${lon}&category=${category}&refine=${refine.join(',')}`),
  // The places the user stopped at most often, most picked first.
  placePicks: () => request<{ places: NearbyPlace[] }>('/places/picks'),
  // "Finished early": add a stop at that place right after the event.
  addStop: (eventId: string, place: NearbyPlace) =>
    request<Event>(`/calendar/events/${encodeURIComponent(eventId)}/stop`, 'POST', place),
  // Places matching a partly typed address, best first, each with coordinates.
  suggestPlaces: (query: string) =>
    request<{ suggestions: Location[] }>(`/geocode/suggest?q=${encodeURIComponent(query)}`),
  geocode: (query: string) => request<Location>(`/geocode?q=${encodeURIComponent(query)}`),

  // Calendar
  addEvent: (event: Partial<Event>) => request<Event>('/calendar/events', 'POST', event),
  updateEvent: (id: string, event: Partial<Event>) =>
    request<Event>(`/calendar/events/${encodeURIComponent(id)}`, 'PUT', event),
  deleteEvent: (id: string) => request<void>(`/calendar/events/${encodeURIComponent(id)}`, 'DELETE'),
  importICS: (icsContent: string) =>
    request<CalendarSyncResult>('/calendar/import-ics', 'POST', { ics_content: icsContent, source: 'ics' }),
  // accessToken comes from Google sign-in.
  syncGoogleCalendar: (accessToken: string) =>
    request<CalendarSyncResult>('/calendar/sync-google', 'POST', { access_token: accessToken }),

  // Saved places
  getCollections: () => request<{ collections: Collection[] }>('/collections'),
  createCollection: (col: Partial<Collection>) => request<Collection>('/collections', 'POST', col),
  updateCollection: (id: string, col: Partial<Collection>) =>
    request<Collection>(`/collections/${id}`, 'PUT', col),
  deleteCollection: (id: string) => request<void>(`/collections/${id}`, 'DELETE'),
  addPlace: (collectionId: string, place: Partial<SavedPlace>) =>
    request<void>(`/collections/${collectionId}/places`, 'POST', place),
  removePlace: (collectionId: string, placeId: string) =>
    request<void>(`/collections/${collectionId}/places/${placeId}`, 'DELETE'),
  movePlace: (collectionId: string, placeId: string, toCollectionId: string) =>
    request<void>(`/collections/${collectionId}/places/${placeId}/move`, 'POST', {
      to_collection_id: toCollectionId,
    }),

  // Health & stats
  getHealthSummary: (date: string) => request<DailyHealthSummary>(`/health/summary?date=${date}`),
  reportSteps: (date: string, steps: number) => request<void>('/health/steps', 'POST', { date, steps }),
  getWeekStats: () => request<WeekStats>('/stats/week'),

  // Preferences & ranking
  getPreferences: () => request<UserPreferences>('/user/preferences'),
  updatePreferences: (prefs: UserPreferences) => request<UserPreferences>('/user/preferences', 'PUT', prefs),
  getLearnedWeights: () => request<LearnedWeights>('/ml/weights'),
  resetLearnedWeights: () => request<void>('/ml/weights', 'DELETE'),
};
