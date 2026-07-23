#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

./scripts/macos-preflight.sh

printf '\nInstalling the locked JavaScript dependency graph...\n'
npm ci

printf '\nChecking Expo SDK dependency compatibility...\n'
npx expo install --check
npx --yes expo-doctor

printf '\nRunning ATIRA type checks and automated tests...\n'
npm run check

printf '\nResolving the public Expo configuration...\n'
npx expo config --type public

printf '\nATIRA JavaScript and configuration bootstrap passed.\n'
printf 'Next: follow Docs/development/MAC_SPRINT_RUNBOOK.md from the simulator gate.\n'
