# 0008: Windows desktop shell

**Status:** Accepted for alpha

## Context

The web preview and standalone collector prove the data path, but requiring two browser/terminal processes creates exactly the kind of friction ATIRA intends to remove. The same product must remain fast to develop while also behaving like a normal installed Windows application.

## Decision

Use Electron as the first cross-platform desktop shell. Development mode loads the Expo web server for live reload. Packaged mode serves the exported web bundle from a loopback-only static server. The shell launches the Windows collector with Electron's bundled Node runtime and stores collector data under the application's per-user data directory.

The Windows shell:

- creates a native ATIRA window and application identity;
- embeds and owns the desktop collector when no existing companion is running;
- keeps running in the system tray when the window is closed;
- provides tray actions to open, pause/resume collection, and quit;
- keeps renderer sandboxing, context isolation, and Node integration disabled;
- opens external HTTP links in the system browser;
- packages through Electron Forge and Squirrel.Windows.

The source Expo `main` entry remains unchanged. A packaging hook rewrites only the copied desktop package entry, allowing mobile and desktop development to coexist in one repository.

## Consequences

The installed alpha can be used organically without a collector terminal. The first bundle is larger than necessary because the root project contains mobile build dependencies. A later packaging workspace should include only the exported renderer, collector, and desktop runtime dependencies.

The alpha installer is unsigned. Public distribution requires Windows code signing, release storage encryption, automatic updates, and a branded icon/design pass. Development packaging remains valuable before those production steps because it verifies lifecycle, local services, and passive collection in the actual desktop environment.
