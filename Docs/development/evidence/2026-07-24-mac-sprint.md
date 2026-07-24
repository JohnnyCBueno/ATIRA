# ATIRA borrowed-Mac sprint evidence — 2026-07-24

This record is deliberately scrubbed. It contains no device identifiers, signing identifiers, account details, coordinates, routes, database keys, or raw location samples.

## Status

- Gates 1-6 passed.
- Gate 7 positive background-location field protocol did not pass on the first attempt.
- A corrected Release build is installed and its background task is registered.
- Gate 7 must be repeated before Gate 8 HealthKit work begins.

## Environment

- Mac: Apple silicon, macOS 26.5.2.
- Xcode: 26.6, first-launch components and licence ready.
- Node.js: 22.23.1.
- npm: 10.9.8.
- CocoaPods: 1.16.2.
- Git: 2.50.1.
- Watchman: installed.
- iOS Simulator runtime: available.
- Physical device: iPhone SE (3rd generation), iOS 26.1.
- Signing: owner's free Apple Personal Team with automatic development signing.
- Bundle identifier: `com.johnnycomins.atira`.

Final preflight result: 0 failures and 2 warnings. The warnings were 43 GB free storage and the intentional uncommitted sprint changes.

## Repository and simulator

- Branch: `master`, tracking the canonical GitHub origin.
- Starting repository commit: `7b33c97`.
- TypeScript and automated tests passed before native work.
- Debug Simulator build passed.
- The Simulator opened the encrypted SQLite repository, navigated Timeline and You, and reopened the database after restart.
- A SQLCipher integration fault was diagnosed: Expo exclusive transactions use another SQLite connection, so the encryption key must be applied to each transaction connection before access.

## Physical Debug and foreground persistence

- Xcode detected the connected owner iPhone.
- The generated iOS project used the owner's Personal Team and automatic signing.
- Expo CLI compiled the first Debug build but its parallel CocoaPods signing path left three embedded Expo frameworks unsigned, so installation failed verification.
- The runbook's Xcode fallback signed sequentially and installed the Debug build.
- The development client connected to Metro and initialized encrypted SQLite.
- A user-initiated foreground location capture increased the real observation count.
- Force-close and reopen preserved the observation.
- A later stale Debug screen was traced to the Mac's changed local Metro address. Reconnecting to the current address produced three consecutive clean launches; the database was not corrupted.

## Release independence

- Release build succeeded with 0 errors.
- Release installation succeeded on the Personal Team.
- With Metro stopped, Wi-Fi disabled, and the cable disconnected, ATIRA force-closed and reopened from its Home Screen icon.
- The encrypted observation count remained present.
- Installing a new Release binary stopped the previously active collector, so background collection had to be enabled again.

## First Gate 7 attempt

- Start: 21:28 CEST.
- Initial observation count: 10.
- Initial battery reading: 95%, but the device had just been charging, so the battery measurement is not a valid drain baseline.
- ATIRA reported background collection running and iOS displayed its background-location indicator during the walk.
- Final observation count: 10.
- Final battery reading: 94%, after a reported temporary rise while charging; battery result is inconclusive.
- On reopen, ATIRA displayed the foreground-only status.
- Result: failed. No background observation was persisted, so route reconstruction and map output were correctly absent.

## Diagnosis and correction

Apple's connected-device console confirmed that iOS retained and restored `atira-background-location-v1` with the expected distance and deferred-delivery settings. The task registration and background permission were therefore present.

Two defects were addressed:

1. `inspectLocationCollector` checked only foreground permission and overwrote the truthful running status. It now checks foreground permission, background permission, and `hasStartedLocationUpdatesAsync`.
2. The validation collector allowed iOS to pause updates automatically without an activity hint. Automatic pausing is disabled for the corrected validation build.

The background task now catches callback/persistence failures and emits only a privacy-safe marker. It never logs a payload, coordinate, encryption key, or raw database error.

The corrected Release build:

- passed TypeScript;
- passed all 61 application tests;
- passed all 17 desktop/collector tests;
- built with 0 errors and 2 non-blocking Xcode warnings;
- installed successfully;
- restored the registered task with automatic pausing disabled.

## Pending Gate 7 protocol

Do not force-quit ATIRA before the positive retest.

1. Record observation count, battery, time, and the exact collector-status sentence.
2. Leave ATIRA normally and lock the phone.
3. Stay still for at least 12 minutes.
4. Walk for 15-20 minutes.
5. Remain at a second location for at least 12 minutes.
6. Walk back or continue to a third location.
7. Reopen ATIRA and record only scrubbed counts, status, gaps, reconstruction outcome, and battery change.
8. Restart the phone, reopen ATIRA, and confirm persistence.
9. Run the separate force-quit negative control only after the positive protocol passes.

## Non-blocking build warnings

- Xcode reports the Expo Dev Launcher Release script has ambiguous dependencies and therefore runs every build.
- The linker reports a duplicate `-lc++` library entry.
- The app delegate advertises a remote-notification callback while `remote-notification` is absent from `UIBackgroundModes`. This sprint did not add notification-driven collection; the location background mode is present and verified.
