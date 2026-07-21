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

Not captured by default:

- window titles;
- screenshots;
- keystrokes;
- document contents;
- browser URLs.

Window-title collection exists only as an explicit developer flag and is not used by the app. Do not enable it with personal data during prototype testing.

The development companion stores completed sessions in `desktop/data/observations.ndjson`. That folder is excluded from git, but the file is plaintext. A distributable release must replace it with an encrypted store whose key is protected by Windows, and must add pause, retention, export, and deletion controls.

## Current limitations

- It is started manually from PowerShell and is not yet a packaged tray app or startup service.
- Automatic import runs only while ATIRA is open; a packaged background sync process is still required for the distributable desktop app.
- Process-level sessions are reconstructed into timeline events, but browsers and general-purpose AI tools remain deliberately ambiguous without a separately consented domain or window-context signal.
- The API binds only to `127.0.0.1` and accepts the local Expo web origins. Phone-to-PC pairing is a later authenticated LAN/sync milestone.
- This implementation is Windows-only. A macOS collector will need native macOS development and testing, while Apple Watch health signals should normally enter through HealthKit rather than a separate desktop collector.
