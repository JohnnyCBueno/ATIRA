# 0007: Conservative desktop activity reconstruction

**Status:** Accepted for prototype

## Context

A process name is useful evidence but does not reveal a person's intent. Excel strongly suggests document work, while a browser could contain work, learning, entertainment, or private communication. ATIRA must generate a useful timeline without converting weak signals into false certainty.

## Decision

Completed Windows companion sessions are deterministically classified into focused work, communication, learning, entertainment, browser, AI assistance, general computer activity, idle, or locked states. Adjacent sessions with the same classification are merged into blocks, and each block becomes an inspectable timeline event backed by its source observation IDs.

Application-specific rules use conservative confidence levels:

- focused creation tools and communication clients can produce high-confidence category inferences;
- browsers and ChatGPT remain medium-confidence digital activity because the process alone cannot reveal purpose;
- short idle noise is ignored, while meaningful idle and locked intervals become possible-break events;
- window titles, URLs, screenshots, and content remain outside the default collector boundary.

Desktop observations create or update real dated day records. Existing confirmed or corrected events are preserved when a stable block is reconstructed again. ATIRA polls the loopback companion every 30 seconds while the web app is open and retains imported history when the companion is offline.

## Consequences

The Windows prototype now produces a genuine personal timeline without phone data. Its work totals deliberately exclude ambiguous browser, AI, entertainment, and general desktop time. The timeline identifies a desktop-only day and does not draw a fictitious location route.

Greater qualitative accuracy will require triangulation. Calendar intervals can distinguish scheduled meetings, an opt-in browser-domain collector can separate work tools from entertainment, and phone/location/health sources can explain time away from the computer. These sources should raise or revise confidence rather than overwrite the raw desktop evidence.
