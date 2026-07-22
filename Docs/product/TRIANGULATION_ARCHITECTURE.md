# ATIRA triangulation architecture

For the full product-owner explanation, scenario ledger, confidence caveats, and repeatable quality-audit method, see [ATIRA's brain under the hood](./ONTOLOGICAL_REASONING_AUDIT.md).

ATIRA reconstructs lived behaviour from limited evidence. The triangulation layer is deliberately conservative: it combines independently observed sources only when their coverage is explicit, preserves contradictions and alternatives, and never promotes declared intention into observed fact.

## Evidence roles

Every normalized fact has one role:

- `observed`: directly recorded by a sensor or device collector;
- `declared`: a plan or statement, such as a calendar event;
- `derived`: a deterministic transformation with traceable observed lineage, such as a known-place interval;
- `confirmed`: an interpretation explicitly confirmed by the user.

Calendar information remains optional declared context. It is excluded from the observed-source count and cannot establish an observed behavioural association. No calendar connector is part of this implementation slice.

## Coverage is evidence

Collectors must eventually emit explicit coverage windows with observed, partial, missing, paused, or unavailable states. Silence is not coverage, and missing evidence is not zero activity.

The fusion engine blocks a candidate when any required source lacks sufficient coverage for the candidate period. Longitudinal analysis discards under-covered days instead of assigning them zero values.

## Moment reconstruction

`buildTemporalTriangulation` evaluates deterministic rules against normalized evidence. The initial rules are intentionally narrow:

- phone activity overlapping a desktop-away interval;
- movement overlapping a desktop-away interval;
- a workout record corroborated by a separate motion source;
- desktop activity overlapping a derived, user-labelled work-place interval.

Each candidate retains anchor, supporting, and contradictory evidence; independent source types; source coverage; confidence reasoning; alternatives; and the raw observation IDs behind it. The summaries describe only the supported overlap and do not infer productivity, motivation, quality, or causation.

With the current Windows collector alone, the expected result is `single_source`, with no cross-source candidate.

## Longitudinal analysis

`analyzeLongitudinalAssociation` accepts paired daily metrics from independent observed sources. It requires:

- at least 70% coverage for each paired daily metric;
- at least 7 paired days across 14 days for an emerging association;
- at least 20 paired days across 28 days for an established association;
- sufficient variation and relationship strength;
- at least two independent source types;
- no declared-intent metric in an observed behavioural association.

Reported language always states that an association is not evidence that one measurement caused the other.

## Selective confirmations

The confirmation policy creates a yes/no prompt only when an unresolved candidate is uncertain enough to benefit from correction and the answer has sufficient expected information value. It also enforces:

- a default maximum of two questions per day;
- quiet hours from 21:00 to 09:00;
- no repeated question after an answer;
- a seven-day cooldown after dismissal;
- expiry for stale prompts.

Confirmed candidates gain explicit user-confirmed status. Rejected candidates have zero confidence and must not support later interpretations.

## Current boundary

This milestone is a pure, source-neutral reasoning foundation. It does not add a visual surface, connect calendar data, manufacture fixture insights, or persist confirmation prompts yet. Provider adapters will supply normalized observations and explicit coverage when real Huawei, phone, location, motion, or other sources become available.
