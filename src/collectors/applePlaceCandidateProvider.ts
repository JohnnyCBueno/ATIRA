import {
  isApplePlaceSearchAvailable,
  searchNearbyApplePlaces,
} from '../../modules/atira-place-search';
import {
  ApplePlaceCandidate,
  LocationSegmentRecord,
  PlaceCandidateSetRecord,
  TimelineRepository,
} from '../data/contracts';
import {
  normalizeApplePlaceCandidates,
} from '../reconstruction/placeCandidateEngine';

export interface ApplePlaceCandidateSearchResult {
  state: 'available' | 'native_build_required' | 'not_a_real_stay';
  candidates: ApplePlaceCandidate[];
}

export function canSearchApplePlaceCandidates() {
  return isApplePlaceSearchAvailable();
}

export async function searchApplePlaceCandidatesForStay(
  stay: LocationSegmentRecord,
  radiusMetres = 180,
): Promise<ApplePlaceCandidateSearchResult> {
  if (stay.kind !== 'stay' || !stay.center || stay.origin !== 'real') {
    return { state: 'not_a_real_stay', candidates: [] };
  }
  if (!isApplePlaceSearchAvailable()) {
    return { state: 'native_build_required', candidates: [] };
  }
  const candidates = await searchNearbyApplePlaces({
    latitude: stay.center.latitude,
    longitude: stay.center.longitude,
    radiusMetres,
  });
  return {
    state: 'available',
    candidates: normalizeApplePlaceCandidates(stay, candidates),
  };
}

export async function enrichStoredApplePlaceCandidates(
  repository: TimelineRepository,
  maximumSearches = 3,
) {
  if (!isApplePlaceSearchAvailable()) return 0;
  const [segments, existingSets] = await Promise.all([
    repository.listLocationSegments(),
    repository.listPlaceCandidateSets(),
  ]);
  const searchedSegmentIds = new Set(existingSets.map((item) => item.segmentId));
  const now = Date.now();
  const eligible = segments
    .filter((segment) => segment.kind === 'stay' && segment.origin === 'real' && segment.center)
    .filter((segment) => Date.parse(segment.endedAt) <= now - 2 * 60_000)
    .filter((segment) => !searchedSegmentIds.has(segment.id))
    .sort((left, right) => right.endedAt.localeCompare(left.endedAt))
    .slice(0, Math.max(0, maximumSearches));

  let stored = 0;
  for (const stay of eligible) {
    try {
      const result = await searchApplePlaceCandidatesForStay(stay);
      if (result.state !== 'available') continue;
      const timestamp = new Date().toISOString();
      const candidateSet: PlaceCandidateSetRecord = {
        id: `place-candidates:${stay.id}`,
        segmentId: stay.id,
        dayId: stay.dayId,
        provider: 'apple_mapkit',
        searchRadiusMetres: 180,
        searchedAt: timestamp,
        candidates: result.candidates,
        updatedAt: timestamp,
      };
      await repository.upsertPlaceCandidateSet(candidateSet);
      stored += 1;
    } catch {
      // A transient Apple Maps or network failure leaves this stay eligible for a later retry.
    }
  }
  return stored;
}
