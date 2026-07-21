import { LocationSegmentRecord, ObservationOrigin, RawObservation, SegmentPoint, TravelMode } from '../data/contracts';

export interface LocationEngineConfig {
  stayRadiusMetres: number;
  minimumStayMinutes: number;
  coverageGapMinutes: number;
  minimumJourneyMetres: number;
  minimumJourneyMinutes: number;
  maximumAccuracyMetres: number;
}

export interface CleanLocationSample extends SegmentPoint {
  accuracyMetres: number;
  quality: number;
  origin: Exclude<ObservationOrigin, 'mixed'>;
}

export interface LocationReconstructionResult {
  dayId: string;
  segments: LocationSegmentRecord[];
  acceptedSamples: number;
  rejectedSamples: number;
  observedMinutes: number;
  gapMinutes: number;
  coveragePercent: number;
  distanceMetres: number;
  warnings: string[];
}

export const defaultLocationEngineConfig: LocationEngineConfig = {
  stayRadiusMetres: 120,
  minimumStayMinutes: 12,
  coverageGapMinutes: 20,
  minimumJourneyMetres: 100,
  minimumJourneyMinutes: 2,
  maximumAccuracyMetres: 250,
};

interface StayRange {
  start: number;
  end: number;
  center: { latitude: number; longitude: number };
}

interface Chunk {
  start: number;
  end: number;
}

export function reconstructLocationDay(
  dayId: string,
  observations: RawObservation[],
  config: LocationEngineConfig = defaultLocationEngineConfig,
): LocationReconstructionResult {
  const { samples, rejected } = cleanLocationObservations(observations, config);
  if (samples.length < 2) {
    return {
      dayId,
      segments: [],
      acceptedSamples: samples.length,
      rejectedSamples: rejected,
      observedMinutes: 0,
      gapMinutes: 0,
      coveragePercent: 0,
      distanceMetres: 0,
      warnings: ['At least two location samples are required to reconstruct movement.'],
    };
  }

  const chunks = splitAtCoverageGaps(samples, config.coverageGapMinutes);
  const segments: LocationSegmentRecord[] = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    segments.push(...reconstructChunk(dayId, samples, chunk, config));
    const nextChunk = chunks[chunkIndex + 1];
    if (nextChunk) {
      const before = samples[chunk.end];
      const after = samples[nextChunk.start];
      segments.push(makeGapSegment(dayId, before, after));
    }
  }

  const observedMinutes = round(segments.filter((segment) => segment.kind !== 'coverage_gap').reduce((total, segment) => total + segment.durationMinutes, 0), 1);
  const gapMinutes = round(segments.filter((segment) => segment.kind === 'coverage_gap').reduce((total, segment) => total + segment.durationMinutes, 0), 1);
  const totalMinutes = observedMinutes + gapMinutes;
  const distanceMetres = round(segments.filter((segment) => segment.kind === 'journey').reduce((total, segment) => total + segment.distanceMetres, 0), 0);
  const warnings: string[] = [];
  if (gapMinutes > 0) warnings.push('Dashed route sections represent missing coverage, not measured travel.');
  if (rejected > 0) warnings.push(`${rejected} low-quality or invalid sample${rejected === 1 ? ' was' : 's were'} excluded.`);

  return {
    dayId,
    segments,
    acceptedSamples: samples.length,
    rejectedSamples: rejected,
    observedMinutes,
    gapMinutes,
    coveragePercent: totalMinutes === 0 ? 0 : Math.round((observedMinutes / totalMinutes) * 100),
    distanceMetres,
    warnings,
  };
}

export function cleanLocationObservations(observations: RawObservation[], config = defaultLocationEngineConfig) {
  const candidates: CleanLocationSample[] = [];
  let rejected = 0;
  for (const observation of observations) {
    if (observation.source !== 'location' || observation.kind !== 'location_sample') continue;
    const latitude = observation.payload.latitude;
    const longitude = observation.payload.longitude;
    const accuracy = observation.payload.accuracyMetres;
    const timestamp = Date.parse(observation.startedAt);
    if (
      typeof latitude !== 'number' || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || longitude < -180 || longitude > 180 ||
      !Number.isFinite(timestamp) ||
      (typeof accuracy === 'number' && accuracy > config.maximumAccuracyMetres)
    ) {
      rejected += 1;
      continue;
    }
    candidates.push({
      latitude,
      longitude,
      timestamp: new Date(timestamp).toISOString(),
      accuracyMetres: typeof accuracy === 'number' ? Math.max(0, accuracy) : 100,
      quality: clamp(observation.quality, 0, 1),
      origin: observation.payload.mocked === true ? 'synthetic' : 'real',
    });
  }
  candidates.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const samples: CleanLocationSample[] = [];
  for (const candidate of candidates) {
    const previous = samples[samples.length - 1];
    if (previous?.timestamp === candidate.timestamp) {
      if (candidate.quality > previous.quality) samples[samples.length - 1] = candidate;
      else rejected += 1;
    } else {
      samples.push(candidate);
    }
  }
  return { samples, rejected };
}

function splitAtCoverageGaps(samples: CleanLocationSample[], coverageGapMinutes: number): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (minutesBetween(samples[index - 1].timestamp, samples[index].timestamp) > coverageGapMinutes) {
      chunks.push({ start, end: index - 1 });
      start = index;
    }
  }
  chunks.push({ start, end: samples.length - 1 });
  return chunks;
}

function reconstructChunk(dayId: string, samples: CleanLocationSample[], chunk: Chunk, config: LocationEngineConfig) {
  if (chunk.start === chunk.end) return [];
  const stays = detectStays(samples, chunk, config);
  if (stays.length === 0) {
    const journey = makeJourneySegment(dayId, samples.slice(chunk.start, chunk.end + 1), config);
    return journey ? [journey] : [];
  }
  const segments: LocationSegmentRecord[] = [];
  let cursor = chunk.start;
  for (const stay of stays) {
    if (stay.start > cursor) {
      const journey = makeJourneySegment(dayId, samples.slice(cursor, stay.start + 1), config);
      if (journey) segments.push(journey);
    }
    segments.push(makeStaySegment(dayId, samples.slice(stay.start, stay.end + 1), stay.center));
    cursor = stay.end;
  }
  if (cursor < chunk.end) {
    const journey = makeJourneySegment(dayId, samples.slice(cursor, chunk.end + 1), config);
    if (journey) segments.push(journey);
  }
  return segments;
}

function detectStays(samples: CleanLocationSample[], chunk: Chunk, config: LocationEngineConfig): StayRange[] {
  const stays: StayRange[] = [];
  let start = chunk.start;
  while (start < chunk.end) {
    let end = start;
    let center = centroid(samples.slice(start, end + 1));
    for (let cursor = start + 1; cursor <= chunk.end; cursor += 1) {
      const sample = samples[cursor];
      const tolerance = config.stayRadiusMetres + Math.min(80, sample.accuracyMetres);
      if (haversineMetres(center.latitude, center.longitude, sample.latitude, sample.longitude) > tolerance) break;
      end = cursor;
      center = centroid(samples.slice(start, end + 1));
    }
    if (end > start && minutesBetween(samples[start].timestamp, samples[end].timestamp) >= config.minimumStayMinutes) {
      stays.push({ start, end, center });
      start = end + 1;
    } else {
      start += 1;
    }
  }
  return mergeAdjacentStays(stays, samples, config.stayRadiusMetres);
}

function mergeAdjacentStays(stays: StayRange[], samples: CleanLocationSample[], radius: number) {
  const merged: StayRange[] = [];
  for (const stay of stays) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      haversineMetres(previous.center.latitude, previous.center.longitude, stay.center.latitude, stay.center.longitude) <= radius &&
      minutesBetween(samples[previous.end].timestamp, samples[stay.start].timestamp) <= 5
    ) {
      previous.end = stay.end;
      previous.center = centroid(samples.slice(previous.start, previous.end + 1));
    } else {
      merged.push({ ...stay });
    }
  }
  return merged;
}

function makeStaySegment(dayId: string, samples: CleanLocationSample[], center: { latitude: number; longitude: number }): LocationSegmentRecord {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationMinutes = minutesBetween(first.timestamp, last.timestamp);
  return {
    id: segmentId(dayId, 'stay', first.timestamp, last.timestamp),
    dayId,
    kind: 'stay',
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    durationMinutes: round(durationMinutes, 1),
    distanceMetres: 0,
    confidence: confidence(samples, Math.min(1, durationMinutes / 30)),
    sampleCount: samples.length,
    origin: originFor(samples),
    center,
    points: samples.map(toPoint),
  };
}

function makeJourneySegment(dayId: string, samples: CleanLocationSample[], config: LocationEngineConfig): LocationSegmentRecord | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationMinutes = minutesBetween(first.timestamp, last.timestamp);
  const distanceMetres = pathDistance(samples);
  if (distanceMetres < config.minimumJourneyMetres) return null;
  const speed = durationMinutes <= 0 ? 0 : distanceMetres / (durationMinutes * 60);
  return {
    id: segmentId(dayId, 'journey', first.timestamp, last.timestamp),
    dayId,
    kind: 'journey',
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    durationMinutes: round(durationMinutes, 1),
    distanceMetres: round(distanceMetres, 0),
    confidence: confidence(samples, Math.min(1, samples.length / 6)),
    sampleCount: samples.length,
    mode: inferTravelMode(speed),
    origin: originFor(samples),
    points: samples.map(toPoint),
  };
}

function makeGapSegment(dayId: string, before: CleanLocationSample, after: CleanLocationSample): LocationSegmentRecord {
  return {
    id: segmentId(dayId, 'coverage_gap', before.timestamp, after.timestamp),
    dayId,
    kind: 'coverage_gap',
    startedAt: before.timestamp,
    endedAt: after.timestamp,
    durationMinutes: round(minutesBetween(before.timestamp, after.timestamp), 1),
    distanceMetres: round(haversineMetres(before.latitude, before.longitude, after.latitude, after.longitude), 0),
    confidence: 0.2,
    sampleCount: 0,
    mode: 'unknown',
    origin: before.origin === after.origin ? before.origin : 'mixed',
    points: [toPoint(before), toPoint(after)],
  };
}

export function haversineMetres(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadius = 6_371_000;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function inferTravelMode(metresPerSecond: number): TravelMode {
  if (!Number.isFinite(metresPerSecond) || metresPerSecond < 0.35) return 'unknown';
  if (metresPerSecond < 2.2) return 'walking';
  if (metresPerSecond < 7) return 'cycling';
  if (metresPerSecond < 40) return 'road';
  return 'fast_transit';
}

function centroid(samples: CleanLocationSample[]) {
  const totalWeight = samples.reduce((total, sample) => total + Math.max(0.01, sample.quality), 0);
  return {
    latitude: samples.reduce((total, sample) => total + sample.latitude * Math.max(0.01, sample.quality), 0) / totalWeight,
    longitude: samples.reduce((total, sample) => total + sample.longitude * Math.max(0.01, sample.quality), 0) / totalWeight,
  };
}

function pathDistance(samples: CleanLocationSample[]) {
  let distance = 0;
  for (let index = 1; index < samples.length; index += 1) {
    distance += haversineMetres(samples[index - 1].latitude, samples[index - 1].longitude, samples[index].latitude, samples[index].longitude);
  }
  return distance;
}

function confidence(samples: CleanLocationSample[], structuralConfidence: number) {
  const averageQuality = samples.reduce((total, sample) => total + sample.quality, 0) / samples.length;
  return round(clamp(averageQuality * 0.7 + structuralConfidence * 0.3, 0.2, 0.98), 2);
}

function originFor(samples: CleanLocationSample[]): ObservationOrigin {
  return samples.every((sample) => sample.origin === samples[0].origin) ? samples[0].origin : 'mixed';
}

function toPoint(sample: CleanLocationSample): SegmentPoint {
  return { latitude: sample.latitude, longitude: sample.longitude, timestamp: sample.timestamp };
}

function segmentId(dayId: string, kind: LocationSegmentRecord['kind'], start: string, end: string) {
  return `${dayId}-${kind}-${Date.parse(start)}-${Date.parse(end)}`;
}

function minutesBetween(start: string, end: string) {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 60_000);
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
