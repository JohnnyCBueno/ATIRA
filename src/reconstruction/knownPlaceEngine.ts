import { LocationSegmentRecord, ObservationOrigin } from '../data/contracts';
import { haversineMetres } from './locationEngine';

export interface KnownPlaceCluster {
  id: string;
  label: string;
  center: { latitude: number; longitude: number };
  radiusMetres: number;
  visitCount: number;
  dayCount: number;
  totalMinutes: number;
  firstSeenAt: string;
  lastSeenAt: string;
  confidence: number;
  origin: ObservationOrigin | 'unknown';
}

export interface PlaceVisitAssignment {
  segmentId: string;
  placeId: string;
}

export interface KnownPlaceClusteringResult {
  places: KnownPlaceCluster[];
  assignments: PlaceVisitAssignment[];
}

interface WorkingCluster {
  id: string;
  latitudeTotal: number;
  longitudeTotal: number;
  weightTotal: number;
  centers: Array<{ latitude: number; longitude: number }>;
  visits: LocationSegmentRecord[];
}

export function clusterKnownPlaces(
  segments: LocationSegmentRecord[],
  clusterRadiusMetres = 160,
): KnownPlaceClusteringResult {
  const stays = segments
    .filter((segment): segment is LocationSegmentRecord & { center: { latitude: number; longitude: number } } => segment.kind === 'stay' && segment.center != null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const working: WorkingCluster[] = [];
  const assignments: PlaceVisitAssignment[] = [];

  for (const stay of stays) {
    let nearest: WorkingCluster | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of working) {
      const center = centerFor(candidate);
      const distance = haversineMetres(center.latitude, center.longitude, stay.center.latitude, stay.center.longitude);
      if (distance <= clusterRadiusMetres && distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }

    const weight = Math.max(1, stay.durationMinutes);
    if (!nearest) {
      nearest = {
        id: stablePlaceId(stay.center.latitude, stay.center.longitude),
        latitudeTotal: 0,
        longitudeTotal: 0,
        weightTotal: 0,
        centers: [],
        visits: [],
      };
      working.push(nearest);
    }
    nearest.latitudeTotal += stay.center.latitude * weight;
    nearest.longitudeTotal += stay.center.longitude * weight;
    nearest.weightTotal += weight;
    nearest.centers.push(stay.center);
    nearest.visits.push(stay);
    assignments.push({ segmentId: stay.id, placeId: nearest.id });
  }

  const places = working.map((cluster, index): KnownPlaceCluster => {
    const center = centerFor(cluster);
    const radiusMetres = cluster.centers.reduce((largest, visitCenter) => Math.max(
      largest,
      haversineMetres(center.latitude, center.longitude, visitCenter.latitude, visitCenter.longitude),
    ), 0);
    const origins = new Set(cluster.visits.map((visit) => visit.origin).filter(Boolean));
    const days = new Set(cluster.visits.map((visit) => visit.dayId));
    return {
      id: cluster.id,
      label: placeLabel(index),
      center,
      radiusMetres: Math.round(radiusMetres),
      visitCount: cluster.visits.length,
      dayCount: days.size,
      totalMinutes: Math.round(cluster.visits.reduce((total, visit) => total + visit.durationMinutes, 0)),
      firstSeenAt: cluster.visits[0].startedAt,
      lastSeenAt: cluster.visits[cluster.visits.length - 1].endedAt,
      confidence: round(Math.min(0.96, 0.45 + cluster.visits.length * 0.1 + days.size * 0.06 - Math.min(0.2, radiusMetres / 800)), 2),
      origin: origins.size === 0 ? 'unknown' : origins.size === 1 ? [...origins][0] as ObservationOrigin : 'mixed',
    };
  });

  return { places, assignments };
}

function centerFor(cluster: WorkingCluster) {
  return {
    latitude: cluster.latitudeTotal / Math.max(1, cluster.weightTotal),
    longitude: cluster.longitudeTotal / Math.max(1, cluster.weightTotal),
  };
}

function stablePlaceId(latitude: number, longitude: number) {
  const coordinate = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < coordinate.length; index += 1) {
    hash ^= coordinate.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `place-${(hash >>> 0).toString(36)}`;
}

function placeLabel(index: number) {
  return index < 26 ? `Place ${String.fromCharCode(65 + index)}` : `Place ${index + 1}`;
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
