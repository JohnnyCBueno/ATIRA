# 0011: Collector resilience and tracking assurance

## Status

Accepted.

## Context

ATIRA is a passive life-reconstruction system, not a foreground diary. Its useful operation cannot depend on the interface remaining visible or on one phone process staying alive indefinitely. Different sources have different owners and failure modes:

- phone location is live evidence that may be permanently lost during a collection gap;
- Screen Time and Android UsageStats are recorded by the operating system and can be queried or reported later;
- HealthKit, Health Connect, wearables, and provider clouds retain samples independently;
- desktop collectors continue without the phone;
- cloud connectors can continue without either client being open.

Backgrounding, operating-system termination, removal from Recents, user force-quit, Android Force Stop, permission revocation, offline operation, and device shutdown are distinct states. ATIRA must not collapse them into a single `disconnected` boolean.

## Decision

### Use distributed collectors

The visible ATIRA application coordinates collectors but is not their sole owner. Each source should use the most durable responsible layer available:

- native location services for phone location;
- Device Activity extensions for Apple device activity;
- UsageStats for Android device activity;
- HealthKit or Health Connect for health history;
- provider APIs for Huawei, Fitbit, Oura, Whoop, and similar services;
- independent local collectors for Windows and macOS;
- authenticated backend jobs for eligible cloud sources.

Every connector supports retrospective ingestion when its source retains history. It maintains a cursor or stable sample identity, backfills after interruption, and avoids duplicating immutable raw observations.

The shared collector-status contract persists the operational state, last observed time, last local sync, expected heartbeat cadence, and backfill capability separately from the source's evidence. A source-neutral health assessment can therefore report healthy, delayed, paused, offline, setup-required, or coverage-gap states without confusing a live heartbeat with proof of historical coverage.

### Treat location as the exceptional live source

There is no general historical phone-GPS store ATIRA can query after a missed interval. The production location collector therefore combines:

- adaptive continuous updates while moving;
- significant-change or visit monitoring while stationary;
- known-place geofences;
- native local persistence before reconstruction or upload;
- explicit coverage windows and gap detection;
- automatic restart or restoration where the platform permits it.

The product promises passive background coverage, not the ability to override an explicit user Force Stop. iOS force-quit and Android Force Stop remain hard platform boundaries.

### Add a tracking-assurance subsystem

Collector health is first-class data. Each collector reports:

- last observation time;
- last successful local persistence and sync;
- expected cadence;
- permission and capability state;
- active, delayed, paused, missing, unavailable, or unknown coverage;
- whether missed data can be backfilled.

Phone tracking assurance uses complementary mechanisms:

1. Android runs location as a correctly declared foreground service with the required persistent system notification.
2. A best-effort rolling local watchdog schedules future reminders and cancels or advances them while the collector remains healthy.
3. A future backend heartbeat detects stale devices and can surface warnings on other connected ATIRA clients or approved external channels.
4. Recovery links open a diagnostic flow that restores the collector, checks permissions and battery restrictions, and records the resulting coverage gap.

Reminder timing is validated on real devices. It must allow for normal operating-system scheduling, stationary periods, offline operation, and network jitter. ATIRA does not promise a notification at an exact interval after termination.

### Describe symptoms, not an unknowable cause

While the application is dead, ATIRA often cannot distinguish force-quit from battery exhaustion, permission changes, lost connectivity, an OS restriction, or a crash. A reminder therefore says:

> Location tracking appears paused. Open ATIRA to resume and check coverage.

It does not assert that the user force-quit the app unless the platform later provides reliable evidence.

### Preserve honest reconstruction

Missing live evidence is not converted into observed evidence. The reconstruction engine may use desktop, device activity, health, place history, and other context to form a clearly labelled inferred interval, but it retains the original coverage gap and source lineage.

An uninterrupted active foreground interval lasting six or more hours across a local midnight is treated as *unverified continuous foreground* when only desktop evidence exists. It remains immutable raw evidence, but is excluded from descriptive usage totals, timeline reconstruction, and pattern inputs until corroborated by an independent source. This prevents an unreliable idle signal or synthetic input from becoming a false account of overnight work.

## Consequences

- ATIRA must be launched initially to obtain authorization and activate collectors.
- The interface does not need to remain visible during normal use.
- Force-quitting the phone app primarily harms live phone-originated sources such as location and direct Bluetooth; it does not erase history retained by operating systems, providers, wearables, desktops, or cloud services.
- Android Recents removal and Android Force Stop require separate tests and user guidance.
- Collector-health contracts and recovery UX are platform infrastructure, not optional settings polish.
- The Mac location trial must include an ordinary background/lock test and a separate force-quit negative control.

## References

- [Apple: Handling location updates in the background](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)
- [Apple: Device Activity](https://developer.apple.com/documentation/deviceactivity)
- [Apple: Executing HealthKit observer queries](https://developer.apple.com/documentation/healthkit/executing-observer-queries)
- [Android: Foreground services](https://developer.android.com/develop/background-work/services)
- [Android: Package stopped-state behavior](https://developer.android.com/about/versions/15/behavior-changes-all)
