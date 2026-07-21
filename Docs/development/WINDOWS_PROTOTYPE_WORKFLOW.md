# Windows prototype workflow

ATIRA uses an Expo/React Native shell so product work can move quickly on Windows while preserving a path to platform-native collectors.

## Current loop: native desktop product experience

Use the Electron development shell for normal Windows product work:

```powershell
npm run desktop:app:dev
```

This starts the Expo web renderer with live reload, opens it inside the native ATIRA window, and starts the local desktop collector. Source changes appear without rebuilding or reinstalling. At 900 pixels and wider ATIRA uses its desktop workspace; below that breakpoint it retains the mobile interface.

The installed app is a stable-checkpoint artifact, not the editing environment. Create a new installer only after a coherent slice has been tested:

```powershell
npm run desktop:app:make
```

Increment the application version before distributing an update so Squirrel.Windows replaces the previous installation.

## Browser and phone-shaped previews

```bash
npm install
npm run web
```

Use a phone-sized responsive viewport when specifically checking the shared mobile layout. Desktop work should be judged in the native development shell rather than through the installed release.

For touch testing on a real iPhone, install Expo Go, run `npm start`, and scan the QR code while both devices are on the same network. If local network discovery is unavailable, Expo can be started with `npx expo start --tunnel`.

## Local Android simulation

Install Android Studio, create a recent Pixel virtual device in Device Manager, start it, then run:

```bash
npm run android
```

This becomes the main local native test target once Android permissions and collectors begin.

## iOS builds from Windows

- Use a physical iPhone plus Expo Go for the current JavaScript-only prototype.
- Use Expo development builds and EAS cloud builds when custom native modules are introduced.
- Use a Mac—borrowed, rented, or hosted—for iOS Simulator debugging, Xcode signing work, entitlement validation, and final App Store checks.

There is no supported local iOS Simulator on Windows. Cloud compilation can produce an iOS build, but it does not replace the Simulator or Xcode for native debugging.

## When passive collectors begin

Expo Go will no longer be sufficient once ATIRA adds custom Screen Time, Usage Access, HealthKit, Health Connect, background location, or desktop-bridge code. At that point the shared UI remains in React Native, while collectors live in native Swift/Kotlin modules and are exercised through development builds.

The order should be:

1. Prove that the reconstructed day and correction loop are valuable with fixtures.
2. Build the Android location and usage collectors against the normalised event contract.
3. Build the desktop companion against the same contract.
4. Add iOS collectors and capability-specific fallbacks using EAS plus scheduled Mac access.
