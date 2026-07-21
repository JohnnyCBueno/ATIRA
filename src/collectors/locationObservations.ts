import * as Location from 'expo-location';
import { RawObservation } from '../data/contracts';
import { LocationCaptureMethod } from './locationCapture';

export function locationToObservation(location: Location.LocationObject, captureMethod: LocationCaptureMethod = 'fresh'): RawObservation {
  const observedAt = new Date(location.timestamp).toISOString();
  return {
    id: `location-${location.timestamp}-${Math.random().toString(36).slice(2, 9)}`,
    source: 'location',
    kind: 'location_sample',
    startedAt: observedAt,
    capturedAt: new Date().toISOString(),
    quality: location.coords.accuracy == null ? 0.5 : Math.max(0.1, Math.min(1, 1 - location.coords.accuracy / 500)),
    payload: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracyMetres: location.coords.accuracy,
      altitudeAccuracyMetres: location.coords.altitudeAccuracy,
      headingDegrees: location.coords.heading,
      speedMetresPerSecond: location.coords.speed,
      mocked: location.mocked ?? false,
      captureMethod,
    },
  };
}
