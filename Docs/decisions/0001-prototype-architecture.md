# ADR 0001: Prototype architecture

## Status

Accepted for prototype.

## Decision

Use Expo and React Native for the shared mobile product shell, with a TypeScript domain layer and fixture-backed collector interfaces. Future iOS and Android collectors will be native adapters written in Swift and Kotlin.

The prototype will not request sensitive permissions. It will simulate a complete cross-source day and expose regional capability differences in the UI.

## Why

- The product experience and evidence model can be validated from Windows.
- The same shared shell can later host platform-specific native collectors.
- EAS development builds provide a route to physical iPhone testing without local Xcode.
- Native collectors preserve access to platform-specific background and entitlement APIs.

## Consequences

- Expo Go is suitable only for the fixture-driven experience prototype.
- Native capability work requires custom development builds.
- iOS app-extension compatibility must pass a focused feasibility spike before the architecture is considered production-ready.
- A Mac and physical Apple devices remain necessary for Xcode diagnostics and real sensor testing.
