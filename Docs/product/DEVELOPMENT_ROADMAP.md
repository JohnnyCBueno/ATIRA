# ATIRA development roadmap

This roadmap sequences the prototype around the product's actual force multiplier: combining individually limited signals into a conservative, inspectable account of a person's life.

## Current checkpoint

ATIRA currently has:

- an adaptive web/mobile product shell and packaged Windows alpha;
- a real Windows foreground-application and idle-state collector;
- normalized local observations and deterministic reconstruction code;
- cumulative desktop-usage presentation with short-session and system-process noise filtering;
- fixture location, health, and phone evidence used to develop the experience before every native collector exists;
- correction, confidence, provenance, and capability-state foundations.

It does not yet have continuous real phone location, real phone usage, real wearable ingestion, semantic device identity, or place-aware desktop inference. Fixture data remains a development instrument and is never presented as real collected history.

## Architectural rules

### Every digital observation is device-qualified

An application name alone is not an activity. `ChatGPT` on a phone and `ChatGPT` on a development laptop are separate streams with different likely contexts.

Every digital observation and aggregate must carry:

- a locally generated `deviceId`, never a hardware serial number or MAC address;
- `deviceClass`, such as phone, tablet, laptop, desktop, watch, or band;
- `platform`, such as Windows, macOS, iOS, Android, or HarmonyOS;
- a user-facing `deviceLabel`;
- `collectorId` and source/provider provenance;
- the application identity within that device and platform.

Digital totals default to `(deviceId, applicationId)`. A cross-device total is an explicit analytical view, not an accidental merge. The product can later interpret the same application differently using device, place, time, window/domain metadata where consented, and other evidence.

### Device activity inherits place context through time overlap

Known-place intervals and device-activity intervals stay separate evidence objects. The fusion layer joins them by overlapping timestamps and records the match quality. This supports distinctions such as:

- office work versus work from home;
- additional work at home after leaving the office;
- computer use at a cafe, hotel, or while travelling;
- phone use during a desktop-idle interval;
- the same application used in different life contexts.

Laptop use alone does not prove work. Work-mode interpretations also consider application category, calendar context, learned corrections, time, and missing evidence.

### Network context is a place signal, not remote phone tracking

ATIRA may use a consented, locally stored network fingerprint to recognize a known place. Useful inputs include the current Wi-Fi network, access-point identifier, gateway, and a coarse public-IP fallback. Raw identifiers should be minimized and hashed before persistence where possible.

Network context can support:

- recognizing that the Windows laptop is on the user's labelled Home or Office network;
- resolving a laptop's place when precise location is unavailable;
- optionally confirming that a known device is present on a user-controlled local network through a router-specific connector.

It cannot supply a continuous phone route, phone application usage, or reliable global phone identity. Client MAC addresses are local-network identifiers and are commonly randomized. A shared public IP generally identifies a network exit, not one device. These signals therefore never masquerade as phone GPS.

## Phased build

### Phase 0 - Product and desktop evidence foundation (current)

- Product charter, capability matrix, local-first repository, and reconstruction primitives.
- Windows companion, packaged shell, real foreground-app capture, and cumulative digital audit.
- Raw evidence separated from aggregate audits and meaningful moments.

Exit condition: real Windows sessions can be captured, reconstructed, aggregated, and inspected without producing a card for every process switch. **Met for the alpha.**

### Phase 1 - Device identity and source registry (next)

- Add device and collector registries to the normalized data contract.
- Give the current Windows installation a persistent local device identity and friendly label.
- Backfill existing desktop observations without losing their provenance.
- Key digital aggregates by device and application.
- Add device filters/labels to digital-audit and evidence views.
- Keep schemas ready for iPhone, Android, Mac, watch, band, and imported-provider sources.

Exit condition: ATIRA cannot accidentally merge activity from two devices, and every visible digital total can explain which device produced it.

### Phase 2 - Windows place context

- Collect Windows location through the operating-system permission path where available.
- Add a privacy-minimized network fingerprint as a resilient known-place signal.
- Ask the user to label recurring contexts such as Home and Office with a one-tap confirmation.
- Represent precise coordinates, coarse IP location, and network recognition with distinct accuracy and provenance.
- Show real laptop place coverage and gaps without inventing movement.

Exit condition: the desktop can usually identify Home versus Office on this development laptop, while clearly distinguishing precise, coarse, inferred, and unknown location.

### Phase 3 - Device/place fusion and useful patterns

- Join activity and place intervals deterministically.
- Introduce conservative Office day, Work from home, and After-hours work at home candidates.
- Require enough sustained evidence and expose the observations behind each claim.
- Learn from user corrections without turning one answer into an irreversible rule.
- Build Patterns cuts by device, place, activity category, day, week, and month.

Exit condition: a real week can answer where computer activity occurred and make reviewable work-pattern suggestions without treating all laptop time as productive work.

### Phase 4 - Health and wearable sources

- Complete Huawei Health import/connectivity evaluation using the existing connector boundary.
- Normalize sleep, heart rate, exercise, and recovery with source and device provenance.
- Add Health Connect for Android when an Android test path is available.
- Add HealthKit and Apple Watch ingestion when macOS/Xcode and Apple signing access are available.

Exit condition: health context can corroborate sleep and exercise periods without being treated as medical advice or an exact account of activity.

### Phase 5 - Phone collectors

- Build Android location, activity-recognition, and Usage Access collectors first where practical.
- Build iOS Core Location, motion, HealthKit, and the region/capability-appropriate Screen Time experience.
- Preserve explicit capability states: unavailable data is not zero activity.
- Add encrypted, authenticated synchronization between a person's devices only when the local single-device paths are trustworthy.

Exit condition: a real phone can provide continuous place/movement evidence and the legally/platform-available digital evidence, with permission, battery, and missing-coverage behavior tested on hardware.

### Phase 6 - Personal LifeOS hardening

- Cross-device identity, reconciliation, encryption, retention, export, and deletion controls.
- macOS desktop collector and release-grade installers/signing.
- Calendar, audio, photos, banking, and other sources only behind separately justified narrow permissions.
- Longitudinal Patterns and Wrapped-style summaries based on sufficiently complete data.
- Validation with real users before expanding the most sensitive collectors.

Exit condition: ATIRA is useful, understandable, and controllable across devices—not merely capable of collecting more data.

## Immediate build slice

The next implementation slice is deliberately bounded:

1. Define and migrate the device/collector registry.
2. Assign the Windows alpha a stable local ID and friendly label.
3. Make the desktop usage audit explicitly device-scoped.
4. Prototype a local Windows network-context collector and known-place labels.
5. Fuse desktop sessions with known-place intervals in a deterministic, tested layer.
6. Surface only the first three place-aware work candidates: Office day, Work from home, and After-hours work at home.

This slice creates real infrastructure for every later phone and wearable source while producing a useful laptop-only capability now.
