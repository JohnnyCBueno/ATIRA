import { requireOptionalNativeModule } from 'expo-modules-core';

export interface ApplePlaceSearchOptions {
  latitude: number;
  longitude: number;
  radiusMetres: number;
}

export interface NativeApplePlaceCandidate {
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  street?: string;
  locality?: string;
}

interface AtiraPlaceSearchNativeModule {
  searchNearby(options: ApplePlaceSearchOptions): Promise<NativeApplePlaceCandidate[]>;
}

const nativeModule = requireOptionalNativeModule<AtiraPlaceSearchNativeModule>('AtiraPlaceSearch');

export function isApplePlaceSearchAvailable() {
  return nativeModule != null;
}

export async function searchNearbyApplePlaces(options: ApplePlaceSearchOptions) {
  if (!nativeModule) {
    throw new Error('Apple place search requires an ATIRA iOS development build containing the MapKit module.');
  }
  return nativeModule.searchNearby(options);
}
