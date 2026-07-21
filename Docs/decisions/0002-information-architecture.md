# Decision 0002: Timeline, Patterns, and You

## Status

Accepted for Prototype V2.

## Decision

ATIRA’s primary navigation has three destinations:

1. **Timeline** combines places, journeys, and interpreted activities. It supports day, week, and month scales rather than separating the map from the chronology.
2. **Patterns** combines user-directed data exploration with ATIRA-generated cross-source insights. Users can focus on a life domain instead of receiving only a generic feed.
3. **You** owns collection health, platform capability, learned memory, privacy, retention, export, deletion, and notification controls.

## Map semantics

The route is continuous when observations support continuity. Observed travel uses a solid path. Interpolated or inferred coverage uses a visibly dashed path. Genuine unknowns remain gaps rather than being presented as measured movement.

A map provider will eventually render geographic context, but the route itself comes from ATIRA’s timestamped observations and reconstruction pipeline. Choosing a renderer does not solve sampling, background collection, map matching, or missing coverage.

## Consequences

- The storage model must support multiple days and period aggregation.
- Events, journeys, places, evidence, and corrections need stable identifiers.
- Insights need domain tags, contributing-source provenance, comparison periods, and confidence.
- The collector layer must expose coverage as data rather than silently filling gaps.
