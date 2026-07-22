# ATIRA

ATIRA is a passive life-ontology and personal productivity product. It combines consented signals from location, device activity, health, calendars, and desktop companions to reconstruct a useful, inspectable account of a person's life with minimal manual input. Health is one contextual stream among many; ATIRA is not positioned as a medical or fitness product.

This repository now contains a real Windows digital-activity alpha plus explicitly labelled native/synthetic sensor scaffolds. Raw observations, reversible device-scoped rules, real 7/30/90-day audits, and evidence-maturity gates are implemented. The product refuses to turn short or incomplete history into a fictional personal insight.

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

The companion records process names and active/idle/locked intervals. Each foreground interval also retains an internal interaction mix: recent input, passive foreground attention, away, or locked. This supports longitudinal insight without adding granular state rows to the timeline. Window titles are off by default, and it does not capture screenshots, keystrokes, document contents, or URLs. The standalone command keeps a plainly documented development store. The packaged Windows app migrates observations to AES-256-GCM records and protects the key with Windows DPAPI through Electron `safeStorage`.

Each companion installation owns a persistent random device and collector ID stored alongside its local observations. ATIRA does not use a MAC address, hostname, or hardware serial as identity, and application usage is aggregated separately for each registered device.

Earlier Windows collector identities are reconciled into the current installation without discarding raw history. This is safe while the repository is device-local and has no cross-computer import or sync; the rule will become an explicit user-controlled merge once cross-device transfer exists.

## Add active browser context

The optional Manifest V3 extension under `desktop/browser-extension` turns generic browser time into active-domain intervals. One shared implementation supports Chromium browsers, with a generated Firefox package and browser-qualified observations. Multiple browsers can remain paired concurrently, and every website stays nested beneath the browser that supplied it. It records the hostname only (for example `docs.google.com`), never the path, query, page title, page content, search terms, keystrokes, background tabs, or incognito activity.

Run `npm run desktop:browser:build` to create Chromium and Firefox packages under `out/browser-extensions`. For Chromium development, load `desktop/browser-extension` unpacked. In the installed app, open **You → Browser activity**, create a one-time five-minute code, and enter it in each browser you want to connect. Pairing is local, authenticated, and the companion stores only encrypted token hashes.

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

The installed shell stores its repository outside browser `localStorage`, encrypts it with an AES-256-GCM key protected by Windows, and exposes pause plus 7-day, 30-day, and all-history deletion controls under **You**.

On Windows, the quickest cross-platform development loop is `npm run web` with responsive browser widths. Expo Go can preview compatible shared UI on a physical phone, while the packaged Windows app is the real collector-backed environment. Android Studio provides the local Android emulator; Apple’s iOS Simulator still requires macOS. See [Docs/development/WINDOWS_PROTOTYPE_WORKFLOW.md](Docs/development/WINDOWS_PROTOTYPE_WORKFLOW.md) for the staged workflow.

## Prototype scope

- unified Timeline combining a continuous route map and detailed daily chronology;
- factual day, week, and month views derived from stored evidence;
- inspectable evidence and confidence;
- one-tap confirmation and correction;
- real 7/30/90-day Digital and Work audits, with unavailable domains honestly waiting for sources;
- capability preview for EU iOS, global iOS, and Android.

## Data foundation

- Native: SQLCipher-backed Expo SQLite with its generated key held in SecureStore.
- Web preview: clearly labelled development-only local storage adapter.
- Packaged Windows: encrypted main-process repository and encrypted collector records with OS-protected keys.
- Normalized tables/contracts for observations, collector states, days, events, evidence, and corrections.
- Device and collector registries with device-scoped observation queries and digital aggregates.
- Explicit foreground location capture and development-build background task scaffolding.
- Deterministic location reconstruction for cleaning, stays, journeys, gaps, distance, coverage, and conservative travel modes.
- Windows foreground-app and idle-state collection through a loopback-only companion API.
- Conservative desktop reconstruction into real daily activity blocks, with ambiguous AI use labelled honestly and optional domain-only browser context.
- Device-scoped aliases, categories, purposes, exclusions, and resettable interpretation rules.
- Audit, emerging-signal, and established-insight maturity gates with inspectable evidence.

See [Docs/decisions/0003-local-first-data-layer.md](Docs/decisions/0003-local-first-data-layer.md) for the security and collector boundary.
See [Docs/decisions/0004-location-reconstruction-engine.md](Docs/decisions/0004-location-reconstruction-engine.md) for reconstruction semantics and current calibration thresholds.
See [Docs/decisions/0006-windows-desktop-companion.md](Docs/decisions/0006-windows-desktop-companion.md) for the desktop collector boundary and packaging path.
See [Docs/decisions/0007-desktop-activity-reconstruction.md](Docs/decisions/0007-desktop-activity-reconstruction.md) for classification, confidence, and real-day generation.
See [Docs/decisions/0008-windows-desktop-shell.md](Docs/decisions/0008-windows-desktop-shell.md) for development, installer, and tray behavior.
See [Docs/decisions/0009-evidence-aggregation-and-fusion.md](Docs/decisions/0009-evidence-aggregation-and-fusion.md) for cumulative digital audits, noise filtering, and cross-source interpretation rules.
See [Docs/decisions/0010-device-and-place-context.md](Docs/decisions/0010-device-and-place-context.md) for device identity, activity/place fusion, and the limits of IP and MAC-address evidence.
See [Docs/integrations/HUAWEI_HEALTH_SETUP.md](Docs/integrations/HUAWEI_HEALTH_SETUP.md) for the wearable connector setup boundary.

See [Docs/product/DEVELOPMENT_ROADMAP.md](Docs/product/DEVELOPMENT_ROADMAP.md), [Docs/product/PRODUCT_CHARTER.md](Docs/product/PRODUCT_CHARTER.md), and [Docs/product/CAPABILITY_MATRIX.md](Docs/product/CAPABILITY_MATRIX.md).
