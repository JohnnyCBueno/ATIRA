# ATIRA

ATIRA is an automatic personal life timeline and analytics product. It combines consented signals from location, device activity, health, calendars, and eventually desktop companions to reconstruct a useful, inspectable account of a person's day with minimal manual input.

This repository now contains a fixture-seeded product prototype running on a production-oriented local data boundary. Corrections persist, native builds use an encrypted SQLite design, and the first explicit location-capture path can store a real raw observation locally. Automatic reconstruction and continuous collectors are still under development.

## Run the prototype

```bash
npm install
npm start
```

Then:

- press `w` for the browser preview;
- scan the QR code with Expo Go for a physical-phone preview;
- use `npm run typecheck` to validate the TypeScript project.

## Run the Windows desktop companion

The current desktop milestone includes a real foreground-app and idle-state collector. Open a second PowerShell window in this repository and run:

```powershell
npm run desktop:collector
```

Leave that terminal running and use the computer normally. While ATIRA is open it checks for completed sessions every 30 seconds, reconstructs them into a real dated desktop timeline, and retains previously imported history when the companion is offline. **Sync desktop sessions** in **You** remains available as an immediate manual refresh. Stop the collector with `Ctrl+C`.

The companion records process names and active/idle/locked intervals. Window titles are off by default, and it does not capture screenshots, keystrokes, document contents, or URLs. Its current NDJSON persistence is local, git-ignored, and plaintext for development; it is not the release storage design. See [desktop/README.md](desktop/README.md) for the exact test flow and limitations.

## Run the native Windows app

The Electron shell launches ATIRA as a normal Windows window and embeds the collector, tray controls, and local data service:

```powershell
npm run desktop:app:dev
```

Closing the window hides it to the system tray so collection can continue. Use the tray menu to reopen ATIRA, pause collection, or quit. Create the installable Windows alpha with:

```powershell
npm run desktop:app:make
```

The generated installer is written under `out/make`. This alpha is unsigned and intentionally unoptimized; Windows may display a trust warning, and code signing is required before public distribution.

On Windows, the quickest phone-shaped development loop is `npm run web` with a responsive browser viewport. A physical iPhone can run this fixture prototype through Expo Go on the same network. Android Studio provides the local Android emulator; Apple’s iOS Simulator still requires macOS. See [Docs/development/WINDOWS_PROTOTYPE_WORKFLOW.md](Docs/development/WINDOWS_PROTOTYPE_WORKFLOW.md) for the staged workflow.

## Prototype scope

- unified Timeline combining a continuous route map and detailed daily chronology;
- selectable multi-day fixtures with day, week, and month views;
- inspectable evidence and confidence;
- one-tap confirmation and correction;
- domain-based Patterns exploration for body, sleep, work, digital life, travel, and learning;
- capability preview for EU iOS, global iOS, and Android.

## Data foundation

- Native: SQLCipher-backed Expo SQLite with its generated key held in SecureStore.
- Web preview: clearly labelled development-only local storage adapter.
- Normalized tables/contracts for observations, collector states, days, events, evidence, and corrections.
- Explicit foreground location capture and development-build background task scaffolding.
- Deterministic location reconstruction for cleaning, stays, journeys, gaps, distance, coverage, and conservative travel modes.
- Windows foreground-app and idle-state collection through a loopback-only companion API.
- Conservative desktop reconstruction into real daily activity blocks, with ambiguous browser and AI use labelled honestly.

See [Docs/decisions/0003-local-first-data-layer.md](Docs/decisions/0003-local-first-data-layer.md) for the security and collector boundary.
See [Docs/decisions/0004-location-reconstruction-engine.md](Docs/decisions/0004-location-reconstruction-engine.md) for reconstruction semantics and current calibration thresholds.
See [Docs/decisions/0006-windows-desktop-companion.md](Docs/decisions/0006-windows-desktop-companion.md) for the desktop collector boundary and packaging path.
See [Docs/decisions/0007-desktop-activity-reconstruction.md](Docs/decisions/0007-desktop-activity-reconstruction.md) for classification, confidence, and real-day generation.
See [Docs/decisions/0008-windows-desktop-shell.md](Docs/decisions/0008-windows-desktop-shell.md) for development, installer, and tray behavior.
See [Docs/decisions/0009-evidence-aggregation-and-fusion.md](Docs/decisions/0009-evidence-aggregation-and-fusion.md) for cumulative digital audits, noise filtering, and cross-source interpretation rules.
See [Docs/decisions/0010-device-and-place-context.md](Docs/decisions/0010-device-and-place-context.md) for device identity, activity/place fusion, and the limits of IP and MAC-address evidence.
See [Docs/integrations/HUAWEI_HEALTH_SETUP.md](Docs/integrations/HUAWEI_HEALTH_SETUP.md) for the wearable connector setup boundary.

See [Docs/product/DEVELOPMENT_ROADMAP.md](Docs/product/DEVELOPMENT_ROADMAP.md), [Docs/product/PRODUCT_CHARTER.md](Docs/product/PRODUCT_CHARTER.md), and [Docs/product/CAPABILITY_MATRIX.md](Docs/product/CAPABILITY_MATRIX.md).
