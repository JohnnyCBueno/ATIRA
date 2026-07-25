export const IOS_LIFE_TIMELINE_SAMPLING_POLICY = {
  pointDistanceMetres: 25,
  backgroundBatchDistanceMetres: 25,
  backgroundBatchIntervalMs: 90_000,
  pausesAutomatically: true,
  showsBackgroundIndicator: false,
} as const;

export function matchesIosLifeTimelineSamplingPolicy(options: Record<string, unknown> | null) {
  if (!options) return false;
  return options.distanceInterval === IOS_LIFE_TIMELINE_SAMPLING_POLICY.pointDistanceMetres
    && options.deferredUpdatesDistance === IOS_LIFE_TIMELINE_SAMPLING_POLICY.backgroundBatchDistanceMetres
    && options.deferredUpdatesInterval === IOS_LIFE_TIMELINE_SAMPLING_POLICY.backgroundBatchIntervalMs
    && options.pausesUpdatesAutomatically === IOS_LIFE_TIMELINE_SAMPLING_POLICY.pausesAutomatically
    && options.showsBackgroundLocationIndicator === IOS_LIFE_TIMELINE_SAMPLING_POLICY.showsBackgroundIndicator;
}
