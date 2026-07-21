# HUAWEI Health connector setup

## What this connector can provide

The current connector boundary supports HUAWEI ID OAuth, minimum read scopes for steps, heart rate, sleep, and activity, plus normalized workout-record import. Workout-route access is a separate opt-in location scope and is disabled by default.

A route is not continuous phone location. It can exist only when an outdoor workout was recorded with location data and HUAWEI Health makes the trajectory available to the authorized app.

## Developer-console prerequisite

1. Create or select the ATIRA project in HUAWEI Developers/AppGallery Connect.
2. Enable Account Kit and apply for Health Service Kit.
3. Select only the test read scopes ATIRA currently uses: steps, heart rate, sleep, and activity.
4. Register this exact development redirect URI:

   `http://127.0.0.1:43123/oauth/huawei/callback`

5. Ensure **Sync data to cloud** is enabled in the HUAWEI Health app.
6. Copy the OAuth client ID and client secret. Do not paste either into source control.

Test scopes currently support up to 100 users. Formal verification is a later release step.

## Local alpha configuration

Set credentials only in the PowerShell session used to start the desktop app:

```powershell
$env:ATIRA_HUAWEI_CLIENT_ID='your-client-id'
$env:ATIRA_HUAWEI_CLIENT_SECRET='your-client-secret'
npm run desktop:app:dev
```

To additionally request workout trajectories:

```powershell
$env:ATIRA_HUAWEI_INCLUDE_WORKOUT_ROUTES='true'
```

ATIRA will show the requested permissions on the HUAWEI authorization screen. Route permission must remain optional and separately explained.

## Security boundary and current limitations

- The client secret stays in the desktop companion process and is never returned to the renderer or placed in the authorization URL.
- OAuth uses a random state value and PKCE challenge.
- Access and refresh tokens are currently memory-only and disappear when the companion stops.
- Before daily personal use, token persistence must move to Electron `safeStorage`/Windows protected storage.
- Workout import is implemented first because Huawei documents its cloud endpoint and route samples. Sleep, continuous heart-rate, and step sample-query endpoints still need their provider-specific query implementation after real authorization is available.
- Revoking permission in HUAWEI Health must leave ATIRA usable with reduced coverage and must not delete previously imported local history without a separate user deletion action.
