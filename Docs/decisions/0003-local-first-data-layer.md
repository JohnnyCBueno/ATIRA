# Decision 0003: Local-first repository and collector boundary

## Status

Accepted and implemented as the first production-oriented foundation.

## Decision

The interface does not read sensors or fixtures directly. It reads reconstructed records through a `TimelineRepository`. Collectors append immutable raw observations and update their own capability state. Reconstruction will consume those observations and write days, journeys, places, timeline events, evidence, and confidence.

```text
Collectors -> Raw observations -> Reconstruction -> Timeline repository -> UI
                                           ^                |
                                           |-- Corrections --|
```

The current repository stores:

- day summaries and route representations;
- normalized timeline events;
- evidence items and provenance;
- raw observations with JSON payloads;
- collector capability and coverage states;
- append-only event correction history.

## Native storage

Android and iOS use Expo SQLite with WAL and foreign-key enforcement. SQLCipher is enabled through the Expo config plugin. A random 256-bit database password is created on first launch and stored through the platform secure store. The key is applied immediately after opening the database and before schema access.

SQL values originating outside migrations are parameter-bound. Raw coordinates are not embedded in logs, identifiers, or UI diagnostics.

## Browser development storage

The browser prototype uses a namespaced `localStorage` adapter implementing the same repository contract. This is explicitly labelled **WEB DEV STORE** in the interface and must not be represented as encrypted production storage. Expo SQLite web support remains experimental and requires additional WASM and cross-origin isolation configuration, so it is not the primary storage target.

## Collector behaviour

Collectors expose explicit capability states. Permission prompts are initiated only by a clear user action. The first implemented path can:

1. inspect foreground location permission without prompting;
2. capture one real location sample after an explicit tap;
3. persist that sample locally as a raw observation;
4. register the global background-location task required by a development build;
5. start background collection only after foreground and background permissions are granted.

The location collector does not yet convert samples into places or journeys. That belongs to the reconstruction layer and will be implemented separately.

## Consequences

- Fixture data now seeds an empty repository rather than bypassing application architecture.
- Confirmations and relabels survive reloads and are retained as history.
- Browser testing remains fast without weakening claims about native security.
- Expo Go is not a target for encrypted SQLite or background collection; ATIRA needs development builds.
