import { LocationSegmentRecord } from '../data/contracts';

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface NativeMapCamera {
  coordinates: MapCoordinate;
  zoom: number;
}

export function cameraForLocationSegments(
  segments: LocationSegmentRecord[],
  focusedSegmentId?: string | null,
): NativeMapCamera | null {
  const focused = focusedSegmentId
    ? segments.find((segment) => segment.id === focusedSegmentId)
    : undefined;
  const coordinates = locationCoordinates(focused ? [focused] : segments);
  if (coordinates.length === 0) return null;

  const latitude = coordinates.reduce((total, point) => total + point.latitude, 0) / coordinates.length;
  const longitude = coordinates.reduce((total, point) => total + point.longitude, 0) / coordinates.length;
  const latitudeSpan = Math.max(...coordinates.map((point) => point.latitude)) - Math.min(...coordinates.map((point) => point.latitude));
  const longitudeSpan = Math.max(...coordinates.map((point) => point.longitude)) - Math.min(...coordinates.map((point) => point.longitude));
  const adjustedLongitudeSpan = longitudeSpan * Math.max(0.2, Math.cos(latitude * Math.PI / 180));
  const span = Math.max(latitudeSpan, adjustedLongitudeSpan, 0.0005);
  const zoom = clamp(Math.log2(360 / span) - 0.6, 11, focused ? 18 : 17);

  return {
    coordinates: { latitude, longitude },
    zoom: Math.round(zoom * 10) / 10,
  };
}

export function locationCoordinates(segments: LocationSegmentRecord[]): MapCoordinate[] {
  return segments.flatMap((segment) => {
    if (segment.points.length > 0) {
      return segment.points.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      }));
    }
    return segment.center ? [segment.center] : [];
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
