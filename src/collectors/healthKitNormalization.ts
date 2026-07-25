import type { NativeHealthKitSample } from '../../modules/atira-healthkit';
import {
  CollectorRecord,
  DeviceRecord,
  RawObservation,
} from '../data/contracts';

export function normalizeHealthKitSamples(
  samples: NativeHealthKitSample[],
  capturedAt: string,
): {
  observations: RawObservation[];
  devices: DeviceRecord[];
  collectors: CollectorRecord[];
} {
  const devices = new Map<string, DeviceRecord>();
  const collectors = new Map<string, CollectorRecord>();
  const observations = samples.flatMap((sample): RawObservation[] => {
    if (!isValidHealthKitSample(sample)) return [];
    const sourceKey = sample.sourceBundleIdentifier || 'unknown-source';
    const deviceKey = `${sourceKey}:${sample.deviceManufacturer ?? ''}:${sample.deviceModel ?? ''}`;
    const deviceId = `healthkit-device:${safeId(deviceKey)}`;
    const collectorId = `healthkit-collector:${safeId(deviceKey)}`;
    const deviceClass = inferHealthDeviceClass(sample);
    devices.set(deviceId, {
      id: deviceId,
      deviceClass,
      platform: 'ios',
      label: deviceClass === 'watch' ? 'Apple Health watch' : 'Apple Health device',
      createdAt: capturedAt,
      updatedAt: capturedAt,
    });
    collectors.set(collectorId, {
      id: collectorId,
      deviceId,
      source: 'health',
      provider: 'apple_healthkit',
      label: 'Apple HealthKit',
      createdAt: capturedAt,
      updatedAt: capturedAt,
    });
    return [{
      id: `healthkit:${sample.id.toLocaleLowerCase()}`,
      deviceId,
      collectorId,
      source: 'health',
      kind: 'health_sample',
      startedAt: sample.startedAt,
      endedAt: sample.endedAt,
      capturedAt,
      quality: 0.95,
      payload: {
        metric: sample.metric,
        value: sample.value,
        unit: sample.unit,
        category: sample.category ?? null,
        provider: 'apple_healthkit',
        sourceBundleIdentifier: sourceKey,
      },
    }];
  });
  return {
    observations: observations.sort((left, right) => left.startedAt.localeCompare(right.startedAt)),
    devices: [...devices.values()],
    collectors: [...collectors.values()],
  };
}

function isValidHealthKitSample(sample: NativeHealthKitSample) {
  return Boolean(sample.id)
    && ['steps', 'heart_rate', 'sleep_session', 'workout'].includes(sample.metric)
    && Number.isFinite(Date.parse(sample.startedAt))
    && Number.isFinite(Date.parse(sample.endedAt))
    && Date.parse(sample.endedAt) >= Date.parse(sample.startedAt)
    && Number.isFinite(sample.value)
    && Boolean(sample.unit);
}

function inferHealthDeviceClass(sample: NativeHealthKitSample): DeviceRecord['deviceClass'] {
  const descriptor = `${sample.deviceManufacturer ?? ''} ${sample.deviceModel ?? ''}`.toLocaleLowerCase();
  if (descriptor.includes('watch')) return 'watch';
  if (descriptor.includes('band')) return 'band';
  return 'phone';
}

function safeId(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9:.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase();
}
