export type TransitMode = 'walk' | 'bus' | 'metro' | 'rem' | 'bike' | 'train';
export type NodeType = 'departure' | 'transfer' | 'arrival';

export interface Location {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  location: Location;
  start_time: string;
  end_time: string;
  is_external: boolean;
  external_source?: string;
  external_id?: string;
}

export interface IntermodalNode {
  id: string;
  sequence_index: number;
  node_type: NodeType;
  mode: TransitMode;
  location: Location;
  station_or_stop_name?: string;
  to_stop_name?: string;
  to_location?: Location;
  headsign?: string;
  route_color?: string; // hex without '#', from the agency
  stop_count?: number;
  stop_code?: string; // number on the boarding stop's sign
  to_stop_code?: string;
  intermediate_stops?: { name: string; code?: string; time: string }[]; // stops passed on the way
  vehicle_accessible?: boolean;
  polyline?: string; // encoded leg geometry, for a map
  polyline_precision?: number;
  green_spaces?: string[];
  real_time?: boolean;
  delay_minutes?: number;
  line_code?: string; // what is printed on the vehicle: "144", "2", "A1"
  line_name?: string; // the rest: "Des Pins", "Orange", "Brossard"
  transit_line?: string;
  instruction: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  distance_meters: number;
  step_count: number;
  elevator_available: boolean;
  accessibility_notes?: string;
  nature_score: number;
}

export interface ThirdPlace {
  id: string;
  name: string;
  type: string;
  location: Location;
  green_score: number;
  detour_minutes: number;
  description: string;
  has_wifi: boolean;
  has_seating: boolean;
}

export interface Route {
  id: string;
  origin_event_id?: string;
  destination_event_id?: string;
  origin_location: Location;
  destination_location: Location;
  departure_time: string;
  arrival_time: string;
  total_duration_minutes: number;
  total_distance_meters: number;
  total_steps: number;
  transfer_count: number;
  co2_emissions_grams: number;
  co2_saved_grams: number;
  is_nature_focused: boolean;
  is_accessible: boolean;
  nodes: IntermodalNode[];
  suggested_third_places?: ThirdPlace[];
  source: 'transitous' | 'mock' | string; // 'mock' = offline demo data, not real directions
  walk_minutes: number;
  nature_score: number;
  slack_minutes: number; // free time before having to leave
  is_tight: boolean;
  is_park_walk: boolean; // walk deliberately routed through a park
  weather?: Weather; // forecast at departure time
  score: number;
  reason?: string; // why this option ranked where it did
  ranked_by?: 'ml-agent' | 'preferences';
  alternatives?: Route[]; // other options, best first
}

export interface DaySummary {
  total_events: number;
  total_commute_minutes: number;
  total_steps: number;
  total_co2_saved_grams: number;
  nature_detour_eligible: boolean;
}

// Where a day starts or ends: home unless the user chose another place for that date.
export interface DayEndpoint {
  location: Location;
  category?: string; // from the saved place, when it is one
  is_home: boolean;
}

export type EndpointKind = 'origin' | 'destination';

// origin_event_id / destination_event_id of the commutes from and to the day's endpoints.
export const DAY_START = 'day-start';
export const DAY_END = 'day-end';

export interface DaySchedule {
  date: string;
  events: Event[];
  commutes: Route[];
  summary: DaySummary;
  origin: DayEndpoint | null; // null: no home set and nothing chosen
  destination: DayEndpoint | null;
}

export interface SavedPlace {
  id: string;
  collection_id: string;
  name: string;
  address: string;
  category: string;
  location: Location;
  notes?: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  places: SavedPlace[];
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  prioritized_modes: TransitMode[];
  avoided_modes: TransitMode[];
  require_elevator: boolean;
  prefer_nature_routes: boolean;
  max_walking_minutes: number;
  departure_buffer_minutes: number;
  allow_third_place_detours: boolean;
  step_goal_daily: number;
  home_location?: Location | null; // where every day starts and ends, unless changed for a day
  appearance: Appearance;
}

export type Appearance = 'dark' | 'light' | 'system';

export interface Weather {
  temperature_c: number;
  precipitation_probability: number;
  precipitation_mm: number;
  summary: string;
  good_for_outdoors: boolean;
}

// Planned figures from the routes shown, except reported_steps (measured).
export interface DayStats {
  date: string;
  commute_minutes: number;
  planned_steps: number;
  co2_saved_grams: number;
  touched_grass: boolean;
  reported_steps: number;
}

export interface WeekStats {
  days: DayStats[]; // oldest first, 7 entries
  total_co2_saved_grams: number;
  total_planned_steps: number;
  total_reported_steps: number;
  touch_grass_streak: number;
}

export interface LearnedWeights {
  prior_weights: Record<string, number>;
  learned_delta: Record<string, number>;
  feedback_count: number;
  ml_agent_online: boolean;
}

export interface CalendarSyncResult {
  source: string;
  events_added: number;
  events_synced: number;
}

export interface DailyHealthSummary {
  date: string;
  connected: boolean;
  total_steps_today: number;
  commute_walking_steps: number;
  step_goal: number;
  goal_achieved_ratio: number;
}
