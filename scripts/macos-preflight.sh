#!/usr/bin/env bash

set -u

failures=0
warnings=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

version_at_least() {
  awk -v current="$1" -v required="$2" '
    BEGIN {
      split(current, c, ".");
      split(required, r, ".");
      for (i = 1; i <= 3; i++) {
        cv = (c[i] == "" ? 0 : c[i]) + 0;
        rv = (r[i] == "" ? 0 : r[i]) + 0;
        if (cv > rv) exit 0;
        if (cv < rv) exit 1;
      }
      exit 0;
    }
  '
}

printf 'ATIRA macOS / iOS preflight\n'
printf '===========================\n'

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "This script must run on macOS."
else
  macos_version="$(sw_vers -productVersion)"
  architecture="$(uname -m)"
  printf 'INFO  macOS %s on %s\n' "$macos_version" "$architecture"
  if version_at_least "$macos_version" "26.2"; then
    pass "macOS meets the Expo SDK 57 / Xcode 26.4 floor (26.2+)."
  else
    fail "macOS $macos_version is below 26.2; Expo SDK 57 requires Xcode 26.4+, which requires macOS 26.2+."
  fi
fi

available_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
available_gb=$((available_kb / 1024 / 1024))
if (( available_gb >= 50 )); then
  pass "$available_gb GB free on the startup volume."
elif (( available_gb >= 30 )); then
  warn "Only $available_gb GB free. A first Xcode build and simulator runtime may exhaust this."
else
  fail "Only $available_gb GB free. Free at least 30 GB; 50 GB is the working target."
fi

if command -v xcodebuild >/dev/null 2>&1; then
  xcode_version="$(xcodebuild -version 2>/dev/null | awk 'NR == 1 { print $2 }')"
  if [[ -n "$xcode_version" ]] && version_at_least "$xcode_version" "26.4"; then
    pass "Xcode $xcode_version is selected."
  else
    fail "Xcode ${xcode_version:-unknown} is selected; Expo SDK 57 requires Xcode 26.4+."
  fi
else
  fail "Xcode command-line tools are not selected."
fi

if command -v xcode-select >/dev/null 2>&1; then
  developer_dir="$(xcode-select -p 2>/dev/null || true)"
  if [[ "$developer_dir" == *"Xcode.app/Contents/Developer"* ]]; then
    pass "Full Xcode developer directory is selected."
  else
    warn "Selected developer directory is '${developer_dir:-none}', not the full Xcode application."
  fi
fi

if xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  pass "Xcode first-launch components and licence are ready."
else
  warn "Open Xcode once, accept the licence, install requested components, and select Command Line Tools."
fi

if command -v node >/dev/null 2>&1; then
  node_version="$(node -p 'process.versions.node')"
  if version_at_least "$node_version" "22.13.0"; then
    pass "Node.js $node_version meets Expo SDK 57's minimum."
  else
    fail "Node.js $node_version is below Expo SDK 57's 22.13.x minimum."
  fi
else
  fail "Node.js is not installed."
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm $(npm --version) is available."
else
  fail "npm is not installed."
fi

if command -v pod >/dev/null 2>&1; then
  pass "CocoaPods $(pod --version) is available."
else
  fail "CocoaPods is not installed. Install it before the first native build."
fi

if command -v git >/dev/null 2>&1; then
  pass "Git $(git --version | awk '{ print $3 }') is available."
else
  fail "Git is not installed."
fi

if command -v watchman >/dev/null 2>&1; then
  pass "Watchman is available."
else
  warn "Watchman is not installed. Expo can run without it, but file watching is less reliable."
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git branch --show-current)"
  commit="$(git rev-parse --short HEAD)"
  printf 'INFO  repository %s at %s\n' "$branch" "$commit"
  if [[ -z "$(git status --porcelain)" ]]; then
    pass "Working tree is clean."
  else
    warn "Working tree has changes. Commit or preserve them before native generation."
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    pass "Git origin is $(git remote get-url origin)."
  else
    fail "No Git origin is configured; the Mac cannot return work safely."
  fi
else
  fail "Run this script from the ATIRA repository."
fi

if command -v xcrun >/dev/null 2>&1; then
  if xcrun simctl list runtimes available 2>/dev/null | grep -q "iOS"; then
    pass "An iOS Simulator runtime is available."
  else
    warn "No available iOS Simulator runtime was found. Install one in Xcode Settings > Components."
  fi

  if xcrun devicectl list devices 2>/dev/null | grep -q "iPhone"; then
    pass "An iPhone is visible to Xcode."
  else
    warn "No iPhone is currently visible. Connect it with a data cable, unlock it, and tap Trust."
  fi
fi

printf '\nSummary: %s failure(s), %s warning(s).\n' "$failures" "$warnings"
if (( failures > 0 )); then
  exit 1
fi
