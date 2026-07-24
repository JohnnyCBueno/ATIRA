import { LocationSegmentRecord } from '../data/contracts';

export function locationSegmentTitle(segment: LocationSegmentRecord, placeLabel?: string) {
  if (segment.kind === 'stay') return placeLabel ?? 'Unclustered stay';
  if (segment.kind === 'coverage_gap') return 'Missing coverage';
  return `${travelModeLabel(segment.mode)} journey`;
}

export function locationSegmentDetail(segment: LocationSegmentRecord) {
  if (segment.kind === 'stay') {
    return `${formatMinutes(segment.durationMinutes)} in one area · ${segment.sampleCount} samples`;
  }
  if (segment.kind === 'coverage_gap') {
    return `${formatMinutes(segment.durationMinutes)} without measurements · straight line is not counted as travel`;
  }
  return `${formatDistance(segment.distanceMetres)} · ${formatMinutes(segment.durationMinutes)} · ${segment.sampleCount} samples`;
}

export function formatDistance(distanceMetres: number) {
  return distanceMetres >= 1000 ? `${(distanceMetres / 1000).toFixed(1)} km` : `${Math.round(distanceMetres)} m`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return `${hours}h${remaining > 0 ? ` ${remaining}m` : ''}`;
}

export function formatClock(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function travelModeLabel(mode: LocationSegmentRecord['mode']) {
  if (mode === 'fast_transit') return 'Fast transit';
  if (mode === 'road') return 'Road';
  if (mode === 'cycling') return 'Cycling';
  if (mode === 'walking') return 'Walking';
  return 'Unclassified';
}
