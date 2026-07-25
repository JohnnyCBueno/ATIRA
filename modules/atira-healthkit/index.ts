import { requireOptionalNativeModule } from 'expo-modules-core';

export type HealthKitMetric = 'steps' | 'heart_rate' | 'sleep_session' | 'workout';

export interface NativeHealthKitSample {
  id: string;
  metric: HealthKitMetric;
  startedAt: string;
  endedAt: string;
  value: number;
  unit: string;
  category?: string;
  sourceName: string;
  sourceBundleIdentifier: string;
  sourceVersion?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
}

export interface NativeHealthKitQueryResult {
  samples: NativeHealthKitSample[];
  rangeStart: string;
  rangeEnd: string;
  maximumSamplesPerType: number;
}

interface AtiraHealthKitNativeModule {
  isAvailable(): boolean;
  authorizationRequestStatus(): Promise<'should_request' | 'unnecessary' | 'unknown'>;
  requestReadAuthorization(): Promise<boolean>;
  queryRecent(options: {
    from: string;
    to: string;
    maximumSamplesPerType: number;
  }): Promise<NativeHealthKitQueryResult>;
}

const nativeModule = requireOptionalNativeModule<AtiraHealthKitNativeModule>('AtiraHealthKit');

export function isHealthKitModuleAvailable() {
  return nativeModule?.isAvailable() === true;
}

export async function getHealthKitAuthorizationRequestStatus() {
  if (!nativeModule || !nativeModule.isAvailable()) return 'unknown' as const;
  return nativeModule.authorizationRequestStatus();
}

export async function requestHealthKitReadAuthorization() {
  if (!nativeModule || !nativeModule.isAvailable()) {
    throw new Error('HealthKit requires an ATIRA iPhone development build containing the HealthKit module.');
  }
  return nativeModule.requestReadAuthorization();
}

export async function queryRecentHealthKitSamples(
  from: string,
  to: string,
  maximumSamplesPerType = 2_000,
) {
  if (!nativeModule || !nativeModule.isAvailable()) {
    throw new Error('HealthKit is unavailable on this device.');
  }
  return nativeModule.queryRecent({ from, to, maximumSamplesPerType });
}
