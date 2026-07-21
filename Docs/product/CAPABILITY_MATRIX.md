# Platform capability matrix

ATIRA is one adaptive product. It detects available sources at runtime and changes the precision of its claims rather than presenting separate regional products.

| Capability | EU iOS with enhanced access | Global iOS | Android | Desktop companion |
| --- | --- | --- | --- | --- |
| Background physical timeline | Core Location | Core Location | Android location APIs | Not applicable |
| Motion context | Core Motion | Core Motion | Activity Recognition | Idle/session state |
| Health context | HealthKit | HealthKit | Health Connect | Not applicable |
| Calendar context | EventKit | EventKit | Calendar provider, optional | Calendar integration, later |
| Phone app identity | Available with eligible enhanced entitlement | User-selected opaque tokens | Package identity with Usage Access | Not applicable |
| Phone usage detail | Per-app hourly/daily/weekly aggregates | Selected thresholds; rich report display only | Usage events and aggregates | Not applicable |
| Work application activity | Limited to phone apps | Limited to phone apps | Limited to phone apps | Foreground app intervals |
| Device identity | Local semantic device ID | Local semantic device ID | Local semantic device ID | Local semantic device ID |
| Known-place context | Phone location and labelled networks | Phone location and labelled networks | Phone location and labelled networks | OS location and labelled network fingerprint |
| Passive route without installed collector | No | No | No | Tracks the laptop only |

## Normalised capability states

Collectors report explicit states rather than a single permission boolean:

- `available_full`
- `available_limited`
- `report_only`
- `permission_required`
- `permission_denied`
- `unsupported_region`
- `unsupported_device`
- `temporarily_unavailable`
- `missing_coverage`

Every inference records which states and observations supported it.

Application totals are device-scoped by default. Public IP and MAC-address evidence may support coarse or known-network presence, but never substitutes for a phone location or usage collector.

## Minimum global experience

Outside enhanced Screen Time regions, ATIRA still combines location, motion, health, calendar, desktop evidence, selected phone-activity thresholds, and lightweight confirmations. It must never translate a missing phone-usage export into a claim of zero phone use.
