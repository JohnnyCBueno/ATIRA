# Fresh Codex handoff for the ATIRA Mac sprint

Paste the following into the new Codex task after the private repository has been cloned and opened:

> You are working on ATIRA from a borrowed Mac. Read `AGENTS.md` completely, then read `Docs/development/MAC_SPRINT_RUNBOOK.md`, `Docs/FIRST_IPHONE_BUILD.md`, `Docs/product/PRODUCT_CHARTER.md`, and `Docs/decisions/0003-local-first-data-layer.md`. This repository uses Expo SDK 57; consult the exact versioned Expo documentation before changing code.
>
> First inspect `git status`, the current branch/commit, `origin`, macOS/Xcode/Node/CocoaPods versions, available storage, and whether the owner's iPhone is visible. Run `./scripts/macos-preflight.sh`; do not mutate the project until you report its failures. Then run `./scripts/macos-bootstrap.sh`.
>
> Follow the runbook gates in order. The priorities are: (1) reproducible repository handoff, (2) simulator compile, (3) owner-signed physical Debug build, (4) foreground/background location and native persistence, (5) self-contained Release field build, and only then (6) a read-only HealthKit local Expo-module spike. Do not attempt Screen Time/Family Controls, App Store distribution, Apple Watch, UI polish, Expo upgrades, or generated-native-directory commits.
>
> Use the owner's Apple Personal Team, never the sister's Apple Account. Never ask for or store passwords, two-factor codes, certificates, provisioning profiles, health samples, or location traces in Git or chat. Keep `ios/` generated and ignored. Commit and push every intentional change and a scrubbed test-result record before the Mac session ends.
>
> At each gate, state exactly what is expected to work, what was observed, and whether it is safe to proceed. Stop on signing, capability, storage, macOS, or Xcode incompatibility rather than improvising a permanent architectural change.

The new task does not need this conversation history. The repository documentation, tests, Git history, and runbook are the handoff contract.
