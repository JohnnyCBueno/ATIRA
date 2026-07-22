# ATIRA development roadmap

This roadmap sequences the prototype around the product's actual force multiplier: combining individually limited signals into a conservative, inspectable account of a person's life.

## Current checkpoint

ATIRA currently has:

- an adaptive web/mobile product shell and packaged Windows alpha;
- a real Windows foreground-application and idle-state collector;
- an optional, locally paired Chrome domain-context collector that excludes URLs, content, titles, searches, background tabs, and incognito activity;
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

### Location requires a dedicated, permissioned collector

ATIRA will not build an IP-address, MAC-address, or router-presence workaround for tracking phones. These signals cannot provide the continuous, device-specific route or movement quality that the product promise requires.

Real location work resumes when ATIRA can run a dedicated collector on the device being located. Until then, location fixtures remain visibly fictional development inputs and missing location remains an honest capability state.

## Phased build

### Phase 0 - Product and desktop evidence foundation (current)

- Product charter, capability matrix, local-first repository, and reconstruction primitives.
- Windows companion, packaged shell, real foreground-app capture, and cumulative digital audit.
- Raw evidence separated from aggregate audits and meaningful moments.

Exit condition: real Windows sessions can be captured, reconstructed, aggregated, and inspected without producing a card for every process switch. **Met for the alpha.**

### Phase 1 - Device identity and source registry (implemented in the Windows alpha)

- Add device and collector registries to the normalized data contract.
- Give the current Windows installation a persistent local device identity and friendly label.
- Backfill existing desktop observations without losing their provenance.
- Key digital aggregates by device and application.
- Add device filters/labels to digital-audit and evidence views.
- Keep schemas ready for iPhone, Android, Mac, watch, band, and imported-provider sources.

Exit condition: ATIRA cannot accidentally merge activity from two devices, and every visible digital total can explain which device produced it.

### Phase 2 - Device-aware desktop intelligence (implemented)

- Add device management under You, including user-editable friendly labels.
- Add local application aliases, categories, exclusions, and corrections scoped to a device.
- Build real Patterns cuts by device, application, category, day, week, and month.
- Keep ambiguous applications such as browsers and AI assistants neutral until other evidence supports an interpretation.
- Replace overlapping browser-process time with more specific, consented active-domain intervals without double counting.

Exit condition: the Windows-only product can answer useful digital-audit questions without confusing applications, devices, raw telemetry, or inferred productivity.

The implementation now includes reversible device-scoped application/domain rules, editable device labels, factual 7/30/90-day audits, real week/month views, active-domain browser context, and explicit audit/emerging/established maturity gates. Packaged Windows storage is encrypted and pause/deletion controls are live.

### Phase 3 - Dedicated phone collectors and real location (deferred until a hardware path is available)

- Build Android location, activity-recognition, and Usage Access collectors first where practical.
- Build iOS Core Location, motion, HealthKit, and the region/capability-appropriate Screen Time experience when macOS/Xcode and signing access are available.
- Test permission, background execution, battery, and missing-coverage behavior on real hardware.
- Preserve explicit capability states: unavailable data is not zero activity.

Exit condition: a real phone can provide continuous place/movement evidence and the platform-available digital evidence with honest coverage.

### Phase 4 - Device/place fusion and useful patterns

- Join activity and place intervals deterministically.
- Introduce conservative Office day, Work from home, and After-hours work at home candidates.
- Require enough sustained evidence and expose the observations behind each claim.
- Learn from user corrections without turning one answer into an irreversible rule.
- Build Patterns cuts by device, place, activity category, day, week, and month.

Exit condition: a real week can answer where computer activity occurred and make reviewable work-pattern suggestions without treating all laptop time as productive work.

### Phase 5 - Health and wearable sources

- Complete Huawei Health import/connectivity evaluation using the existing connector boundary.
- Normalize sleep, heart rate, exercise, and recovery with source and device provenance.
- Add Health Connect for Android when an Android test path is available.
- Add HealthKit and Apple Watch ingestion when macOS/Xcode and Apple signing access are available.

Exit condition: health context can corroborate sleep and exercise periods without being treated as medical advice or an exact account of activity.

### Phase 6 - Personal LifeOS hardening

- Cross-device identity, reconciliation, encryption, retention, export, and deletion controls.
- macOS desktop collector and release-grade installers/signing.
- Calendar, audio, photos, banking, and other sources only behind separately justified narrow permissions.
- Longitudinal Patterns and Wrapped-style summaries based on sufficiently complete data.
- Validation with real users before expanding the most sensitive collectors.

Exit condition: ATIRA is useful, understandable, and controllable across devices—not merely capable of collecting more data.

## Immediate build slice

The next implementation slice is deliberately bounded:

1. Define and migrate the device/collector registry. **Implemented.**
2. Assign the Windows alpha a stable local ID and friendly label. **Implemented.**
3. Make the desktop usage audit explicitly device-scoped. **Implemented.**
4. Add editable device labels and device-scoped application rules. **Implemented.**
5. Turn the existing cumulative audit into real day, week, and month Patterns views. **Implemented.**
6. Reconcile the pre-identity Windows history into the stable local device without merging real computers. **Implemented.**
7. Add privacy-limited active-domain browser context with secure local pairing and overlap-safe audits. **Implemented.**
8. Defer place-aware work candidates until a dedicated location collector supplies suitable evidence.

This creates real infrastructure for every later phone and wearable source while producing a useful laptop-only capability now. IP and MAC-address tracking are explicitly outside the implementation plan.
