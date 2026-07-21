export type LocationCaptureMethod = 'fresh' | 'cached';

export interface LocationCaptureResult<T> {
  value: T;
  method: LocationCaptureMethod;
}

interface FreshThenCachedOptions<T> {
  getFresh: () => Promise<T>;
  getCached: () => Promise<T | null>;
  timeoutMs: number;
}

export class LocationCaptureUnavailableError extends Error {
  constructor(message = 'A location fix was not available. Check this device\'s location services and try again.') {
    super(message);
    this.name = 'LocationCaptureUnavailableError';
  }
}

/**
 * Bound the slow, platform-owned location request and use a recent cached point
 * only when a fresh fix cannot be obtained. The original request may still
 * settle later, but Promise.race keeps that result from mutating application state.
 */
export async function captureFreshThenCached<T>({
  getFresh,
  getCached,
  timeoutMs,
}: FreshThenCachedOptions<T>): Promise<LocationCaptureResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new LocationCaptureUnavailableError()), timeoutMs);
  });

  try {
    const value = await Promise.race([getFresh(), timeout]);
    return { value, method: 'fresh' };
  } catch {
    const cached = await getCached();
    if (cached !== null) return { value: cached, method: 'cached' };
    throw new LocationCaptureUnavailableError();
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
