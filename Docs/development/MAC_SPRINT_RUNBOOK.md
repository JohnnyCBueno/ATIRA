# ATIRA Mac sprint runbook

## Mission

Use temporary access to a real Mac to unlock and validate the Apple-only parts of ATIRA with the least possible wasted time.

The sprint is successful when:

1. the repository can move safely between Windows and macOS through a private Git remote;
2. the current Expo SDK 57 project passes on the Mac and compiles in an iOS Simulator;
3. ATIRA is signed by the owner's Apple Account, installed on the owner's iPhone, and can run without Expo Go;
4. foreground and background Core Location, encrypted persistence, restart behaviour, and permission states are tested on the physical phone;
5. a self-contained Release configuration is installed for a field test lasting up to the seven-day Personal Team limit;
6. only after those gates pass, a read-only HealthKit connector spike begins;
7. every change, result, log, and unresolved Apple constraint is committed and pushed before leaving the Mac.

This is not an App Store, TestFlight, Screen Time, Apple Watch app, or polished-release sprint.

## Hard compatibility gate

ATIRA currently uses Expo SDK 57. The official SDK matrix requires:

- Node.js 22.13.x or newer;
- iOS 16.4 or newer as the deployment floor;
- Xcode 26.4 or newer.

Xcode 26.4 requires macOS Tahoe 26.2 or newer. If the sister's Mac cannot run macOS 26.2, stop before installing project dependencies. Do not downgrade ATIRA or improvise a second native baseline during the borrowed-Mac session.

Target at least 50 GB free space for Xcode, an iOS runtime, CocoaPods, `node_modules`, native intermediates, and build products. Thirty GB is the absolute stop/go floor.

## What a free Apple Personal Team allows

Without paying for the Apple Developer Program, Xcode can sign ATIRA for the owner's physical iPhone using a Personal Team.

The useful scope is:

- local on-device installation through Xcode/Expo CLI;
- background modes, including the Core Location background mode;
- HealthKit development on the physical device;
- iOS Simulator compilation;
- a self-contained local Release build for field testing.

The constraints are:

- provisioning expires seven days after issuance;
- the app must then be rebuilt and reinstalled from a Mac;
- a free account is limited to 10 App IDs, three devices, and three installed apps per device;
- no TestFlight, App Store, ad-hoc distribution, notarization, or public release;
- no Screen Time/Family Controls development entitlement with the Personal Team.

Screen Time is deliberately excluded from this sprint. Family Controls distribution also requires a separate Apple entitlement request after paid membership returns.

## Work that must happen before the Mac is borrowed

### 1. Confirm the Mac

Ask the sister for:

- Mac model and year;
- Apple silicon or Intel;
- current macOS version;
- available storage.

The simplest check is **Apple menu > About This Mac**, followed by **System Settings > General > Storage**.

If compatible, ask her to complete the expensive downloads before the sprint:

1. update to macOS 26.2 or newer;
2. install Xcode 26.4 or newer from the Mac App Store;
3. launch Xcode once;
4. accept its licence and install requested components;
5. in **Xcode > Settings > Locations**, select the current Command Line Tools;
6. in **Xcode > Settings > Components**, install one iOS Simulator runtime.

These downloads can consume many gigabytes and should not use the limited development window.

### 2. Use a separate macOS user

Prefer a temporary local user such as `ATIRA Dev`. The owner's Apple Account, GitHub session, signing certificate, shell history, and Codex credentials should not be placed in the sister's everyday macOS profile.

The sister should retain control of any administrator password. No password or two-factor code belongs in the repository, a Codex prompt, a screenshot, or a shell environment file.

### 3. Prepare the physical iPhone

Bring:

- the owner's iPhone running iOS 16.4 or newer;
- its passcode;
- a USB data cable, not a charge-only cable;
- the owner's Apple Account credentials and access to two-factor authentication;
- enough phone storage for the build;
- the phone that will actually collect the field-test route.

Back up important phone data normally. ATIRA should not require erasing or restoring the device.

### 4. Prepare account access

Have interactive access to:

- GitHub account `JohnnyCBueno`;
- the owner's Apple Account;
- the Expo account `johnnycomins` as a fallback, although local Personal Team compilation does not require Expo login;
- Codex on the Mac.

Do not export or copy signing private keys from the sister's Mac unless a later, explicit credential-transfer plan requires it.

## Source handoff

### Primary: private GitHub repository

The canonical source is the private repository:

```text
https://github.com/JohnnyCBueno/ATIRA
```

On the Mac, authenticate interactively and clone it:

```bash
gh auth login --web --git-protocol https
gh repo clone JohnnyCBueno/ATIRA
cd ATIRA
```

GitHub Desktop is an acceptable GUI alternative. Opening Codex alone does not transfer local files.

### Fallback: verified Git bundle

Immediately before travelling to the Mac, create a complete offline bundle on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-mac-handoff.ps1
```

Copy the three newest files from `out\handoff` to an encrypted USB drive or private cloud folder. On the Mac, verify and clone:

```bash
shasum -a 256 -c ATIRA-YYYYMMDD-HHMMSS.bundle.sha256
git clone ATIRA-YYYYMMDD-HHMMSS.bundle ATIRA
cd ATIRA
git remote add origin https://github.com/JohnnyCBueno/ATIRA.git
```

The fallback contains committed Git history only. It intentionally excludes `node_modules`, build products, runtime observations, credentials, local environment files, and the encrypted Windows data store.

## Install the Mac command-line dependencies

Use Homebrew or another reputable package manager to install:

- Node.js 22.13 or newer;
- CocoaPods;
- GitHub CLI;
- Watchman (recommended).

Example with Homebrew:

```bash
brew install node@22 cocoapods gh watchman
brew link --overwrite --force node@22
```

Do not upgrade Expo, React Native, or package versions during setup.

From the repository:

```bash
chmod +x scripts/macos-preflight.sh scripts/macos-bootstrap.sh
./scripts/macos-preflight.sh
./scripts/macos-bootstrap.sh
```

Do not continue to native generation with a preflight failure. Warnings about a missing phone are expected until the cable step.

## Sprint execution order

### Gate 1: repository and JavaScript baseline

Required result:

- clean checkout of `master`;
- `origin` points to the private GitHub repository;
- locked dependencies install with `npm ci`;
- Expo dependency check passes;
- TypeScript and every automated test pass;
- public Expo config resolves to SDK 57 and `com.johnnycomins.atira`.

Record:

```bash
git rev-parse HEAD
node --version
npm --version
xcodebuild -version
sw_vers
```

If this gate fails, fix portability before generating `ios/`.

### Gate 2: iOS Simulator

Run:

```bash
npx expo run:ios
```

This automatically generates the ignored `ios/` directory when it does not exist, runs CocoaPods, compiles the native application, installs it in the selected simulator, and starts Metro.

Check:

- ATIRA reaches Timeline without a native crash;
- You opens;
- the data-store badge reports the native encrypted store rather than browser development storage;
- location-unavailable behaviour is honest in the simulator;
- the app survives a simulator stop and relaunch.

Do not spend this gate polishing layout.

### Gate 3: Apple Account, iPhone trust, and Developer Mode

1. Open Xcode.
2. Go to **Xcode > Settings > Accounts**.
3. Add the owner's Apple Account interactively.
4. Confirm Xcode shows the owner as a **Personal Team**.
5. Connect and unlock the owner's iPhone.
6. Tap **Trust** on the phone and enter the passcode.
7. Open **Window > Devices and Simulators** in Xcode.
8. On the phone, enable **Settings > Privacy & Security > Developer Mode**.
9. Restart the phone when requested and confirm Developer Mode after unlock.

The sister's Apple Account must not be selected as the signing team.

### Gate 4: physical Debug build

Run:

```bash
npx expo run:ios --device
```

Choose the connected owner iPhone.

Expo CLI should automatically development-sign, install, launch, and start Metro. If automatic signing fails:

```bash
xed ios
```

Then select the ATIRA target in Xcode:

- **Signing & Capabilities**;
- enable **Automatically manage signing**;
- select the owner's Personal Team;
- retain `com.johnnycomins.atira`;
- run on the connected iPhone.

Do not change the permanent bundle identifier merely to silence an error. Capture the full signing error first.

Check:

- the app launches from its own Home Screen icon;
- the dev-client launcher can connect to Metro;
- the native encrypted repository initializes;
- one foreground location sample increments the real observation count;
- force-close/reopen preserves stored observations.

### Gate 5: permission sequence

The first foreground prompt must be answered **Allow While Using App**, not **Allow Once**. Expo documents that "Allow Once" is indistinguishable at runtime and can cause a same-session background request to fail silently.

Then:

1. capture a foreground sample;
2. tap **Enable background** in ATIRA;
3. grant **Always** if iOS offers it;
4. if iOS defers the second prompt, inspect **Settings > Privacy & Security > Location Services > ATIRA**;
5. verify the app has the `location` background mode in Xcode;
6. record the exact permission status displayed by ATIRA.

ATIRA must continue operating truthfully if only When In Use is granted.

### Gate 6: self-contained field build

A Debug build normally depends on Metro for fresh launches. Install a Release configuration with an embedded JavaScript bundle:

```bash
npx expo run:ios --configuration Release --device
```

Confirm that ATIRA launches after:

- Metro is stopped;
- Wi-Fi is disabled temporarily;
- the cable is disconnected;
- the application is killed and reopened.

If CLI Release signing does not install under the Personal Team, open `ios/ATIRA.xcworkspace`, set the Run scheme's Build Configuration to Release, retain automatic development signing, and run directly on the phone. Do not attempt App Store Archive/Distribution.

### Gate 7: background-location field protocol

Do not force-quit ATIRA before the positive test.

1. Record the initial observation count and time.
2. Leave ATIRA normally and lock the phone.
3. Stay still for at least 12 minutes.
4. Walk for 15-20 minutes.
5. Remain at a second location for at least 12 minutes.
6. Walk back or continue to a third location.
7. Reopen ATIRA and record collector state, observation count, gaps, reconstructed stays, route shape, and battery change.
8. Restart the phone, relaunch ATIRA, and confirm persistence.

Run a separate negative control only after the positive test:

1. force-quit ATIRA from the app switcher;
2. move for 10-15 minutes;
3. relaunch ATIRA;
4. verify that missing coverage is represented honestly.

iOS/Expo background location stops after the user terminates the app. That is expected platform behaviour, not a reconstruction-engine failure.

### Gate 8: read-only HealthKit spike

Start this only when Gates 1-7 pass and their results are pushed.

Use a local Expo native module under `modules/` rather than placing permanent edits directly inside the generated `ios/` directory. The first spike must:

- add the HealthKit capability and accurate read-purpose strings through reproducible app configuration;
- request read access only;
- query a bounded recent range for steps, heart rate, sleep, and workouts;
- return timestamp, value/unit, source device/provider, and stable sample identity where Apple exposes it;
- write normalized ATIRA observations through the existing repository;
- record explicit coverage and permission-denied states;
- avoid writing any HealthKit data;
- avoid medical, readiness, or diagnostic interpretation;
- include deterministic normalization tests on Windows plus a physical-device smoke test on the Mac.

The module should be created through the Expo Modules workflow:

```bash
npx create-expo-module@latest --local
```

Use `npx pod-install` and rebuild after adding native files. Commit the local module; do not commit generated `ios/`.

Apple Watch data already synchronized into the iPhone's Health store can enter through HealthKit. A watchOS companion target is not required for this first ingestion path.

### Optional Gate 9: macOS collector proof

Attempt only if the phone pipeline and HealthKit spike are complete.

The objective is a tiny native proof that:

- detects the foreground macOS application;
- distinguishes recent input from idle/locked state;
- requests the narrowest Accessibility permission necessary;
- emits the same device-qualified observation contract as Windows.

Do not attempt packaging, signing, notarization, autostart, or public distribution in this sprint.

## What not to do

- Do not pay for Apple membership merely to rescue a setup error.
- Do not attempt Screen Time/Family Controls with the Personal Team.
- Do not delete or regenerate Apple signing assets manually unless automatic signing has been diagnosed first.
- Do not commit `ios/`, provisioning profiles, certificates, Apple IDs, tokens, `.env.local`, Health data, or location traces.
- Do not sign with the sister's Apple Account.
- Do not upgrade Expo or React Native.
- Do not build a watchOS app before proving HealthKit ingestion from the phone.
- Do not spend borrowed-Mac time on shared TypeScript/UI work that can be done on Windows.

## End-of-session extraction

Before leaving the Mac:

1. stop Metro and any collector processes;
2. run `npm run check`;
3. inspect `git status`;
4. commit only intentional source and documentation;
5. push every branch to the private GitHub remote;
6. save non-sensitive build/test logs under `Docs/development/evidence/` only if they are useful and scrubbed;
7. record iPhone model/iOS, Mac/macOS/Xcode, signing team type, bundle ID, build mode, test times, permission results, observation counts, battery delta, crashes, and coverage gaps;
8. verify the Windows machine can fetch the pushed commit;
9. sign out of GitHub, Expo, Codex, and the Apple Account on the temporary Mac user;
10. remove the temporary macOS user only after confirming all work is pushed.

Do not delete the app from the iPhone if the field test is continuing. Rebuilding over the same bundle identifier may preserve its sandbox; deleting the app removes its local data.

## Decision after the sprint

The result should answer four separate questions:

1. Can ATIRA compile and persist data natively on iOS?
2. Can it collect useful background location within acceptable battery cost?
3. Can a free Personal Team sustain the short validation window, accepting seven-day expiry?
4. Does read-only HealthKit ingestion work well enough to justify later paid membership and full Apple entitlement work?

Only then decide whether to renew the Apple Developer Program.

## Official references

- [Expo SDK 57 reference and platform requirements](https://docs.expo.dev/versions/v57.0.0/)
- [Expo local development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Location for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo local native modules](https://docs.expo.dev/modules/get-started/)
- [Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Apple iOS capability availability](https://developer.apple.com/help/account/reference/supported-capabilities-ios/)
- [Apple Family Controls entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
