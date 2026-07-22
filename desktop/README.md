# ATIRA Windows desktop companion

This milestone is a real Windows signal collector, not fixture UI. It samples the foreground process and the time since the user's last input, groups those samples into app/idle/locked sessions, and exposes completed sessions to the ATIRA web prototype over a local read-only API.

## Run and test

From `C:\Users\Owner\Documents\ATIRA`:

```powershell
npm run desktop:collector
```

Then:

1. Leave the PowerShell window running.
2. Use two or three different apps for roughly 20 seconds each.
3. Return to the ATIRA browser preview and open **You**.
4. Wait up to 30 seconds for automatic import, or press **Sync desktop sessions** for an immediate refresh.
5. Confirm the raw-observation total increases and the companion status reads **SYNCED**.
6. Press `Ctrl+C` in PowerShell when finished.

An app session is completed when the foreground process or activity state changes, or when the collector stops. If the sync reports zero new sessions, switch to another app once and retry.

## Privacy boundary

Captured by default:

- foreground process name;
- active, idle, or locked state;
- session start and end time;
- sample count and maximum observed idle duration.
- internal interactive/passive/away/locked duration totals used by the insight engine;

Not captured by the process collector:

- window titles;
- screenshots;
- keystrokes;
- document contents;
- browser URLs.

The optional `desktop/browser-extension` collector adds only the active tab's hostname. It explicitly strips URL paths, query strings, page titles, content, searches, and background tabs, and does not run in incognito mode. Chromium browsers share one build; Firefox uses the generated Firefox manifest. Multiple browser installations pair independently to the loopback companion, which persists only encrypted token hashes.

Window-title collection exists only as an explicit developer flag and is not used by the app. Do not enable it with personal data during prototype testing.

The standalone development command stores completed sessions in `desktop/data/observations.ndjson`. That folder is excluded from git, but the file is plaintext and must not be treated as release storage.

The packaged Windows shell supplies a random 256-bit key whose persisted form is protected by Windows DPAPI through Electron `safeStorage`. In that runtime, collector sessions are written as AES-256-GCM records in `observations.atira`; an existing plaintext development file is imported, encrypted, and removed after the encrypted rewrite succeeds. The packaged renderer also uses an encrypted main-process repository instead of browser `localStorage`.

The same directory contains `identity.json`, which holds random installation-specific device and collector IDs plus the friendly label shown in ATIRA. It contains no MAC address, hostname, or hardware serial. Existing observations are associated with this identity when the companion loads them; new observation IDs are also namespaced by device.

## Current limitations

- The standalone development command is started manually from PowerShell; the packaged shell starts and owns the collector and keeps it alive from the system tray.
- Automatic import runs every 30 seconds while the ATIRA renderer is open. The owned collector continues gathering sessions while the window is hidden to the tray.
- Process-level sessions are reconstructed into timeline events. The optional extension supplies separately consented domain-only context, while general-purpose AI tools remain deliberately neutral without stronger evidence or a user rule.
- The API binds only to `127.0.0.1` and accepts the local Expo web origins. Phone-to-PC pairing is a later authenticated LAN/sync milestone.
- This implementation is Windows-only. A macOS collector will need native macOS development and testing, while Apple Watch health signals should normally enter through HealthKit rather than a separate desktop collector.
