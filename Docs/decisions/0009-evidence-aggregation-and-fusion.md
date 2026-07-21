# 0009: Evidence aggregation and multi-source fusion

**Status:** Accepted for alpha

## Context

Raw collector intervals are not automatically meaningful life events. Presenting every foreground-app switch, idle interval, lock interval, or sensor sample as a chronological card produces noise and asks the user to interpret telemetry themselves.

ATIRA needs three separate product layers:

1. **Raw evidence** is retained locally with provenance and quality.
2. **Aggregate audits** summarize a single source without inventing a narrative.
3. **Meaningful moments** are selective interpretations supported by one or more sources.

## Decision

### Chronology belongs to place and meaningful moments

The route map, stays, journeys, and coverage gaps are the primary chronological representation of a day. A list below the map contains only interpretations worth reviewing, not a copy of every raw interval.

### Digital activity is cumulative

Desktop and phone usage use a Screen Time-style presentation:

- usage by hour or multi-hour block;
- descending application totals;
- category totals where the category is supportable;
- application drill-down containing exact observed sessions.

Repeated sessions from the same application aggregate into one row. The alpha presentation threshold is one minute. Sub-minute switches remain raw evidence but do not enter usage totals.

ATIRA and its Electron development/runtime process are excluded from the audit to prevent self-observation. Idle and locked states are also excluded from user-facing usage and life events.

### Absence is evidence, not an event

“Away from computer” is not a life event. An idle desktop interval can become useful only when fused with another source. Examples:

- desktop idle overlapping phone use can support an attention-shift interpretation;
- desktop idle overlapping a calendar meeting can support an away-from-desk meeting interpretation;
- desktop idle without corroboration remains unknown.

### Cross-source inferences remain conservative

- Road-speed location movement can support road travel, but does not prove the user was driving.
- Walking-speed movement plus motion evidence can support walking.
- Audio playback during a journey can describe listening context, but does not determine transport mode by itself.
- Phone application use can explain an otherwise missing desktop interval, but the overlap and timestamps must be visible in evidence.

Every fused interpretation records contributing observations, missing capabilities, alternatives, and confidence. A missing source never becomes a zero value.

## Consequences

Collector fidelity can remain high without overwhelming the user. Aggregate views answer quantitative audit questions, while the timeline is reserved for qualitative reconstruction. Thresholds and application exclusions are provisional and will become user-correctable local rules as the learning loop matures.
