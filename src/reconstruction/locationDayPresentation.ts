import { DayRecord } from '../domain/types';
import { LocationReconstructionResult } from './locationEngine';
import { formatDistance, formatMinutes } from './locationSegmentPresentation';

export function locationDayResultToRecord(
  result: LocationReconstructionResult,
  existing?: DayRecord,
  now = new Date(),
): DayRecord {
  const date = parseLocalDay(result.dayId);
  const journeyMinutes = result.segments
    .filter((segment) => segment.kind === 'journey')
    .reduce((total, segment) => total + segment.durationMinutes, 0);
  const hasExistingEvidence = Boolean(
    existing && (
      existing.events.length > 0 ||
      existing.places.length > 0 ||
      (existing.desktopUsages?.length ?? 0) > 0
    ),
  );

  return {
    id: result.dayId,
    weekday: existing?.weekday ?? date.toLocaleDateString([], { weekday: 'short' }),
    dayNumber: existing?.dayNumber ?? String(date.getDate()),
    month: existing?.month ?? date.toLocaleDateString([], { month: 'long' }),
    relativeLabel: relativeDayLabel(date, now),
    coverage: Math.max(existing?.coverage ?? 0, result.coveragePercent),
    understood: hasExistingEvidence ? existing!.understood : formatMinutes(result.observedMinutes),
    work: existing?.work ?? '0m',
    movement: journeyMinutes > 0 ? formatMinutes(journeyMinutes) : '—',
    learning: existing?.learning ?? '0m',
    distance: result.distanceMetres > 0 ? formatDistance(result.distanceMetres) : '—',
    routePath: existing?.routePath ?? '',
    inferredRoutePath: existing?.inferredRoutePath,
    places: existing?.places ?? [],
    events: existing?.events ?? [],
    desktopUsages: existing?.desktopUsages ?? [],
  };
}

function parseLocalDay(dayId: string) {
  const [year, month, day] = dayId.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function relativeDayLabel(date: Date, now: Date) {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const difference = Math.round((current.getTime() - target.getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference > 1) return `${difference} days ago`;
  if (difference === -1) return 'Tomorrow';
  return `In ${Math.abs(difference)} days`;
}
