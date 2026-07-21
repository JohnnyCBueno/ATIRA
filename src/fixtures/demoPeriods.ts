import { DayRecord, EventCategory, TimelineEvent } from '../domain/types';
import { demoEvents } from './demoDay';

type EventOverride = Partial<Omit<TimelineEvent, 'id' | 'evidence'>> & { sourceId: string };

const eventFrom = (dayId: string, override: EventOverride): TimelineEvent => {
  const source = demoEvents.find((event) => event.id === override.sourceId) ?? demoEvents[0];
  return {
    ...source,
    ...override,
    id: `${dayId}-${override.sourceId}`,
    evidence: source.evidence.map((item) => ({ ...item, id: `${dayId}-${item.id}` })),
  };
};

const places = {
  workday: [
    { id: 'home', title: 'Home', detail: 'Morning and evening', x: 48, y: 56, kind: 'home' as const },
    { id: 'office', title: 'Office', detail: 'Workday', x: 276, y: 101, kind: 'work' as const },
    { id: 'lunch', title: 'Lunch', detail: 'Midday stop', x: 229, y: 165, kind: 'food' as const },
    { id: 'gym', title: 'Gym', detail: 'Evening session', x: 315, y: 238, kind: 'exercise' as const },
    { id: 'home-return', title: 'Home', detail: 'Day ended', x: 66, y: 257, kind: 'home' as const },
  ],
  home: [
    { id: 'home', title: 'Home', detail: 'Most of the day', x: 54, y: 62, kind: 'home' as const },
    { id: 'park', title: 'Regent’s Park', detail: 'Afternoon walk', x: 263, y: 148, kind: 'other' as const },
    { id: 'cafe', title: 'Neighbourhood café', detail: 'Reading', x: 185, y: 230, kind: 'food' as const },
    { id: 'home-return', title: 'Home', detail: 'Evening', x: 70, y: 262, kind: 'home' as const },
  ],
};

export const demoDays: DayRecord[] = [
  {
    id: '2026-07-14', weekday: 'Tue', dayNumber: '14', month: 'July', relativeLabel: '6 days ago',
    coverage: 84, understood: '12h 08m', work: '6h 02m', movement: '48m', learning: '0m', distance: '12.8 km',
    routePath: 'M48 56 C92 72 141 84 193 91 S252 94 276 101 C267 123 249 144 229 165 C244 188 281 218 315 238 C240 253 149 266 66 257',
    places: places.workday,
    events: [
      eventFrom('tue', { sourceId: 'wake', start: '07:34', end: '08:02', duration: '28m' }),
      eventFrom('tue', { sourceId: 'commute-am', start: '08:02', end: '08:47', duration: '45m' }),
      eventFrom('tue', { sourceId: 'focus-work', title: 'Analysis and planning', start: '08:52', end: '11:18', duration: '2h 26m' }),
      eventFrom('tue', { sourceId: 'meetings', start: '11:24', end: '12:14', duration: '50m' }),
      eventFrom('tue', { sourceId: 'work-pm', title: 'Mixed project work', start: '13:02', end: '17:32', duration: '4h 30m' }),
      eventFrom('tue', { sourceId: 'gym', title: 'Walk home', category: 'travel', start: '18:01', end: '18:49', duration: '48m', place: undefined }),
    ],
  },
  {
    id: '2026-07-15', weekday: 'Wed', dayNumber: '15', month: 'July', relativeLabel: '5 days ago',
    coverage: 94, understood: '14h 03m', work: '7h 11m', movement: '1h 04m', learning: '18m', distance: '15.1 km',
    routePath: 'M48 56 C102 66 151 82 198 89 S257 94 276 101 C267 125 247 146 229 165 C250 192 284 215 315 238 C247 258 145 269 66 257',
    places: places.workday,
    events: [
      eventFrom('wed', { sourceId: 'wake', start: '06:58', end: '07:31', duration: '33m' }),
      eventFrom('wed', { sourceId: 'commute-am', start: '07:38', end: '08:29', duration: '51m' }),
      eventFrom('wed', { sourceId: 'focus-work', title: 'Deep work', start: '08:36', end: '11:42', duration: '3h 06m' }),
      eventFrom('wed', { sourceId: 'lunch', start: '12:18', end: '12:59', duration: '41m' }),
      eventFrom('wed', { sourceId: 'work-pm', start: '13:08', end: '17:18', duration: '4h 10m' }),
      eventFrom('wed', { sourceId: 'language', start: '20:22', end: '20:40', duration: '18m' }),
    ],
  },
  {
    id: '2026-07-16', weekday: 'Thu', dayNumber: '16', month: 'July', relativeLabel: '4 days ago',
    coverage: 89, understood: '13h 16m', work: '6h 48m', movement: '36m', learning: '0m', distance: '11.7 km',
    routePath: 'M48 56 C107 70 151 84 204 91 S257 96 276 101 C263 133 246 150 229 165 C252 194 284 219 315 238 C235 257 144 268 66 257',
    inferredRoutePath: 'M276 101 C263 133 246 150 229 165',
    places: places.workday,
    events: [
      eventFrom('thu', { sourceId: 'wake', start: '07:21', end: '07:53', duration: '32m' }),
      eventFrom('thu', { sourceId: 'commute-am', start: '07:53', end: '08:41', duration: '48m' }),
      eventFrom('thu', { sourceId: 'meetings', title: 'Meeting-heavy morning', start: '08:48', end: '12:06', duration: '3h 18m' }),
      eventFrom('thu', { sourceId: 'lunch', title: 'Midday break', start: '12:11', end: '12:47', duration: '36m', state: 'inferred_medium' }),
      eventFrom('thu', { sourceId: 'work-pm', start: '12:54', end: '17:26', duration: '4h 32m' }),
    ],
  },
  {
    id: '2026-07-17', weekday: 'Fri', dayNumber: '17', month: 'July', relativeLabel: '3 days ago',
    coverage: 92, understood: '13h 42m', work: '5h 26m', movement: '1h 22m', learning: '24m', distance: '17.4 km',
    routePath: 'M48 56 C103 67 149 82 202 90 S259 96 276 101 C265 128 248 148 229 165 C248 193 284 218 315 238 C238 260 141 267 66 257',
    places: places.workday,
    events: [
      eventFrom('fri', { sourceId: 'wake', start: '07:05', end: '07:39', duration: '34m' }),
      eventFrom('fri', { sourceId: 'commute-am', start: '07:44', end: '08:34', duration: '50m' }),
      eventFrom('fri', { sourceId: 'focus-work', start: '08:39', end: '10:48', duration: '2h 09m' }),
      eventFrom('fri', { sourceId: 'work-pm', title: 'Team delivery', start: '11:02', end: '16:27', duration: '5h 25m' }),
      eventFrom('fri', { sourceId: 'gym', start: '17:12', end: '18:34', duration: '1h 22m' }),
      eventFrom('fri', { sourceId: 'language', start: '20:06', end: '20:30', duration: '24m' }),
    ],
  },
  {
    id: '2026-07-18', weekday: 'Sat', dayNumber: '18', month: 'July', relativeLabel: '2 days ago',
    coverage: 81, understood: '10h 36m', work: '0m', movement: '1h 46m', learning: '46m', distance: '8.6 km',
    routePath: 'M54 62 C110 83 178 103 263 148 C248 180 218 208 185 230 C143 245 104 255 70 262',
    places: places.home,
    events: [
      eventFrom('sat', { sourceId: 'wake', title: 'Slow morning', start: '08:43', end: '09:38', duration: '55m' }),
      eventFrom('sat', { sourceId: 'gym', title: 'Long park walk', category: 'exercise', start: '11:21', end: '13:07', duration: '1h 46m', place: 'Regent’s Park' }),
      eventFrom('sat', { sourceId: 'lunch', title: 'Lunch with friends', start: '13:18', end: '14:42', duration: '1h 24m', place: 'Camden' }),
      eventFrom('sat', { sourceId: 'language', title: 'Reading', category: 'learning', start: '16:10', end: '16:56', duration: '46m', place: 'Neighbourhood café' }),
    ],
  },
  {
    id: '2026-07-19', weekday: 'Sun', dayNumber: '19', month: 'July', relativeLabel: 'Yesterday',
    coverage: 87, understood: '11h 14m', work: '34m', movement: '58m', learning: '31m', distance: '6.2 km',
    routePath: 'M54 62 C119 88 196 115 263 148 C248 178 220 205 185 230 C139 249 103 258 70 262',
    places: places.home,
    events: [
      eventFrom('sun', { sourceId: 'wake', title: 'Morning started', start: '08:16', end: '08:51', duration: '35m' }),
      eventFrom('sun', { sourceId: 'focus-work', title: 'Weekly planning', start: '10:06', end: '10:40', duration: '34m', place: 'Home' }),
      eventFrom('sun', { sourceId: 'gym', title: 'Afternoon walk', category: 'exercise', start: '14:28', end: '15:26', duration: '58m', place: 'Regent’s Park' }),
      eventFrom('sun', { sourceId: 'language', start: '19:44', end: '20:15', duration: '31m' }),
    ],
  },
  {
    id: '2026-07-20', weekday: 'Mon', dayNumber: '20', month: 'July', relativeLabel: 'Today',
    coverage: 91, understood: '13h 21m', work: '5h 42m', movement: '1h 15m', learning: '22m', distance: '16.3 km',
    routePath: 'M48 56 C96 67 142 81 197 89 S254 95 276 101 C269 124 249 147 229 165 C248 189 283 218 315 238 C240 258 145 268 66 257',
    inferredRoutePath: 'M229 165 C248 189 283 218 315 238',
    places: places.workday,
    events: demoEvents.map((event) => ({ ...event, id: `mon-${event.id}`, evidence: event.evidence.map((item) => ({ ...item, id: `mon-${item.id}` })) })),
  },
];

export const categoryTotals: { label: string; value: number; colour: string; category: EventCategory }[] = [
  { label: 'Creation', value: 42, colour: '#176B5B', category: 'creation' },
  { label: 'Communication', value: 31, colour: '#826447', category: 'communication' },
  { label: 'Movement', value: 18, colour: '#E86F51', category: 'exercise' },
  { label: 'Learning', value: 9, colour: '#596FA5', category: 'learning' },
];
