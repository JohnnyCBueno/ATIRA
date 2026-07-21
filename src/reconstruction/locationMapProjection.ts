import { LocationSegmentRecord } from '../data/contracts';

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface ProjectedLocationSegment {
  segment: LocationSegmentRecord;
  points: ProjectedPoint[];
  center?: ProjectedPoint;
}

export function projectLocationSegments(
  segments: LocationSegmentRecord[],
  width = 360,
  height = 300,
  padding = 24,
): ProjectedLocationSegment[] {
  const coordinates = segments.flatMap((segment) => [
    ...segment.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    ...(segment.center ? [segment.center] : []),
  ]);
  if (coordinates.length === 0) return [];

  const referenceLatitude = coordinates.reduce((total, point) => total + point.latitude, 0) / coordinates.length;
  const metresPerLongitudeDegree = 111_320 * Math.cos(referenceLatitude * Math.PI / 180);
  const metresPerLatitudeDegree = 110_540;
  const projected = coordinates.map((point) => ({
    source: point,
    east: point.longitude * metresPerLongitudeDegree,
    north: point.latitude * metresPerLatitudeDegree,
  }));
  const minEast = Math.min(...projected.map((point) => point.east));
  const maxEast = Math.max(...projected.map((point) => point.east));
  const minNorth = Math.min(...projected.map((point) => point.north));
  const maxNorth = Math.max(...projected.map((point) => point.north));
  const eastSpan = Math.max(1, maxEast - minEast);
  const northSpan = Math.max(1, maxNorth - minNorth);
  const scale = Math.min((width - padding * 2) / eastSpan, (height - padding * 2) / northSpan);
  const eastMidpoint = (minEast + maxEast) / 2;
  const northMidpoint = (minNorth + maxNorth) / 2;

  const toCanvas = (point: { latitude: number; longitude: number }): ProjectedPoint => ({
    x: round(width / 2 + (point.longitude * metresPerLongitudeDegree - eastMidpoint) * scale),
    y: round(height / 2 - (point.latitude * metresPerLatitudeDegree - northMidpoint) * scale),
  });

  return segments.map((segment) => ({
    segment,
    points: segment.points.map(toCanvas),
    center: segment.center ? toCanvas(segment.center) : undefined,
  }));
}

export function projectedPath(points: ProjectedPoint[]) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
