import { DayRecord } from '../domain/types';
import { TimelineRepository } from './contracts';

export async function ensureCurrentDay(repository: TimelineRepository, date = new Date()) {
  const id = localDayId(date);
  const days = await repository.listDays();
  if (days.some((day) => day.id === id)) return false;
  await repository.upsertDay(emptyDayRecord(date));
  return true;
}

export function emptyDayRecord(date: Date): DayRecord {
  return {
    id: localDayId(date),
    weekday: date.toLocaleDateString([], { weekday: 'short' }),
    dayNumber: String(date.getDate()),
    month: date.toLocaleDateString([], { month: 'long' }),
    relativeLabel: 'Today',
    coverage: 0,
    understood: '0m',
    work: '0m',
    movement: '—',
    learning: '0m',
    distance: '—',
    routePath: '',
    places: [],
    events: [],
    desktopUsages: [],
  };
}

function localDayId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
