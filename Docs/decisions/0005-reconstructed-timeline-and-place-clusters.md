# ADR 0005: Reconstructed Timeline and anonymous place clusters

## Status

Accepted for the prototype.

## Decision

The Timeline reads persisted location segments produced by the reconstruction engine whenever they exist for the selected day. Fixture routes remain only as an explicitly labelled visual fallback.

Repeat stays are clustered locally within a conservative 160 metre radius. The first version assigns anonymous labels such as `Place A`; semantic labels such as Home, Work, and Gym require later user confirmation or multi-source inference. Clustering is deterministic and derived from persisted stays, so it can be recomputed without introducing another source of truth.

Every reconstructed segment carries evidence origin (`real`, `synthetic`, or `mixed`). The Timeline displays that provenance and renders coverage gaps as dashed connections rather than measured travel.

## Consequences

- Synthetic traces can validate the entire observation-to-map contract without masquerading as user history.
- Real collector observations can replace test inputs without changing the Timeline component.
- Anonymous clusters avoid premature semantic claims.
- User labels and stable label persistence require a future repository migration.
- A real map tile provider remains a separate presentation decision; reconstruction does not depend on one.
