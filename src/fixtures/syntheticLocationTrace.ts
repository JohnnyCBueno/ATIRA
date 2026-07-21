import { RawObservation } from '../data/contracts';

interface TracePoint {
  minute: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const atMinute = (dayId: string, minute: number) => {
  const hours = Math.floor(minute / 60).toString().padStart(2, '0');
  const minutes = (minute % 60).toString().padStart(2, '0');
  return `${dayId}T${hours}:${minutes}:00.000Z`;
};

const points: TracePoint[] = [
  { minute: 420, latitude: 51.50000, longitude: -0.10000 },
  { minute: 425, latitude: 51.50004, longitude: -0.10002 },
  { minute: 430, latitude: 51.49998, longitude: -0.09996 },
  { minute: 435, latitude: 51.50002, longitude: -0.10004 },
  { minute: 440, latitude: 51.50001, longitude: -0.10001 },
  { minute: 445, latitude: 51.50003, longitude: -0.10000 },
  { minute: 450, latitude: 51.50000, longitude: -0.09998 },
  { minute: 455, latitude: 51.50100, longitude: -0.09920 },
  { minute: 460, latitude: 51.50200, longitude: -0.09840 },
  { minute: 465, latitude: 51.50300, longitude: -0.09760 },
  { minute: 470, latitude: 51.50400, longitude: -0.09680 },
  { minute: 475, latitude: 51.50500, longitude: -0.09600 },
  { minute: 480, latitude: 51.50600, longitude: -0.09520 },
  { minute: 485, latitude: 51.50602, longitude: -0.09521 },
  { minute: 490, latitude: 51.50598, longitude: -0.09518 },
  { minute: 500, latitude: 51.50601, longitude: -0.09522 },
  { minute: 510, latitude: 51.50600, longitude: -0.09520 },
  { minute: 525, latitude: 51.50603, longitude: -0.09519 },
  { minute: 540, latitude: 51.50601, longitude: -0.09520 },
  { minute: 555, latitude: 51.50600, longitude: -0.09521 },
  { minute: 570, latitude: 51.50602, longitude: -0.09520 },
  { minute: 630, latitude: 51.50800, longitude: -0.09100 },
  { minute: 635, latitude: 51.50802, longitude: -0.09098 },
  { minute: 640, latitude: 51.50798, longitude: -0.09102 },
  { minute: 650, latitude: 51.50801, longitude: -0.09101 },
  { minute: 665, latitude: 51.50800, longitude: -0.09100 },
  { minute: 680, latitude: 51.50802, longitude: -0.09099 },
];

function makeTrace(dayId: string, coordinateNudge = 0, preserveLegacyIds = false): RawObservation[] {
  return points.map((point, index) => {
  const startedAt = atMinute(dayId, point.minute);
  return {
    id: preserveLegacyIds ? `synthetic-location-${index}` : `synthetic-location-${dayId}-${index}`,
    source: 'location',
    kind: 'location_sample',
    startedAt,
    capturedAt: startedAt,
    quality: 0.92,
    payload: {
      latitude: point.latitude + Math.sin(index * 1.7) * coordinateNudge,
      longitude: point.longitude + Math.cos(index * 1.3) * coordinateNudge,
      accuracyMetres: point.accuracy ?? 18,
      mocked: true,
    },
  };
  });
}

export const syntheticLocationTrace = makeTrace('2026-07-20', 0, true);

export const syntheticMultiDayLocationTrace: RawObservation[] = [
  ...makeTrace('2026-07-14', 0.00004),
  ...makeTrace('2026-07-15', 0.00007),
  ...makeTrace('2026-07-16', 0.00005),
  ...syntheticLocationTrace,
];
