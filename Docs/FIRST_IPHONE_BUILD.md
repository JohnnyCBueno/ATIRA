# First iPhone development build

This build is an early sensor-validation milestone, not a release candidate. It exists to test the parts the web preview cannot: Apple permissions, Core Location, background delivery, encrypted native SQLite, cold launches, and battery behaviour.

## Before the first build

- Choose a permanent, globally unique iOS bundle identifier, for example `com.yourcompany.atira`.
- Use an Expo account you control. Sign in locally with `npx eas-cli login`; never put account passwords or two-factor codes in this repository.
- Join the Apple Developer Program using the Apple ID that will own the application.
- Enable Developer Mode on the test iPhone.

## Account linking and device registration

Run these interactively from the project directory:

```text
npx eas-cli login
npx eas-cli build:configure
npx eas-cli device:create
```

The account owner should complete the Expo, Apple, and two-factor prompts directly. EAS can manage the signing certificate and ad-hoc provisioning profile.

## Build and run

Create an installable development client:

```text
npx eas-cli build --platform ios --profile development
```

Open the resulting installation link on the registered iPhone. For iterative development, start Metro on the Windows laptop:

```text
npm run start:dev-client
```

The phone and laptop can use the same network. If LAN discovery is unreliable, start Expo with a tunnel instead.

## First field test

1. Launch ATIRA and confirm the native store badge says `ENCRYPTED SQLITE`.
2. Capture one foreground sample and confirm the raw-observation count increases by one.
3. Enable background collection and grant `Always` access when iOS offers it.
4. Lock the phone, walk for 15–20 minutes, stop somewhere for at least 12 minutes, then walk again.
5. Reopen ATIRA and record the observation count and collector status.
6. Force-close and reopen the app to verify that observations remain available.

Background location may stop after the user force-quits the app. The test should distinguish an ordinary lock/background transition from deliberately terminating the app.

## Not validated until this test passes

- Reliable foreground or background GPS delivery on iOS
- Real-world reconstruction thresholds
- Battery cost
- Native SQLCipher persistence across launches
- Known-place clustering from real traces
