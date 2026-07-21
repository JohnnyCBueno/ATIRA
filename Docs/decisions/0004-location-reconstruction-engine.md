# Decision 0004: Deterministic location reconstruction before semantic inference

## Status

Accepted for the first reconstruction milestone.

## Decision

ATIRA first converts raw location observations into geometric facts using a deterministic engine. Semantic labels such as Home, Office, Gym, or Lunch are applied later by a separate inference layer.

The first engine performs:

1. validation and timestamp ordering;
2. accuracy filtering and duplicate removal;
3. great-circle distance calculation;
4. splitting at long sampling gaps;
5. stationary clustering into stays;
6. journey reconstruction between stays;
7. conservative speed-based travel-mode classification;
8. explicit confidence and coverage calculation.

## Segment semantics

- **Stay:** sufficient time spent within a configurable radius.
- **Journey:** at least the minimum displacement supported by multiple observations.
- **Coverage gap:** elapsed time between sampling chunks. Its straight line is not counted as observed distance and must be rendered as inferred or unknown.

One point cannot form a route. Short stationary GPS noise is not called a journey. Missing coverage is never treated as zero movement.

## Current thresholds

Thresholds are intentionally configurable and will require calibration against real devices:

- stay radius: 120 metres plus bounded accuracy tolerance;
- minimum stay: 12 minutes;
- coverage gap: 20 minutes;
- minimum journey displacement: 100 metres;
- maximum accepted accuracy radius: 250 metres.

These values are engineering defaults, not product truths.

## Testing

The engine is pure TypeScript and independent of React Native, Expo Location, SQLite, and map providers. Automated tests cover distance, travel-mode boundaries, invalid coordinates, duplicate timestamps, stay/journey/gap reconstruction, one-point insufficiency, and stationary noise.

The development interface can run an explicitly fictional trace through the engine. Mocked observations and reconstructed segments persist through the same repository used by future real collectors.
