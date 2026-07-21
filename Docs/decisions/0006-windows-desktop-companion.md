# 0006: Windows desktop companion boundary

**Status:** Accepted for prototype

## Context

ATIRA needs desktop activity to distinguish focused computer work from meetings, breaks, and phone use. A process-level desktop signal is useful without collecting the far more sensitive contents of a user's screen or documents. Development is currently taking place on Windows without a .NET or Rust toolchain.

## Decision

Build the first companion as a dependency-light Node.js process with a small PowerShell Windows sampler. The sampler uses Windows user-interface APIs to identify the foreground process and last-input state. A deterministic sessionizer converts samples into normalized `desktop_foreground` raw observations.

The companion:

- binds a read-only HTTP API to `127.0.0.1` only;
- permits only the local Expo web development origins;
- records process name and active/idle/locked intervals;
- keeps window titles off unless a developer explicitly opts in;
- never captures screenshots, keystrokes, document contents, or URLs;
- feeds observations through the same repository contract as other ATIRA collectors.

The browser app explicitly imports completed observations instead of silently reaching across devices. This keeps the prototype inspectable and gives us an end-to-end data path before packaging work.

## Consequences

The milestone proves real collection, normalization, deduplication, and import on the current Windows machine without waiting for a distributable desktop shell. It does not yet infer productivity or add desktop sessions to the reconstructed timeline; those are downstream interpretation stages.

The local NDJSON file is plaintext and development-only. Before external testing, replace it with encrypted persistence backed by OS-protected key material, package the collector as a signed desktop app, add pause/retention/export/delete controls, and authenticate any cross-device transport. macOS needs a separately implemented and tested native sampler, but can share the normalized observation contract and reconstruction logic.
