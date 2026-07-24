export type DatabaseFailureKind = 'busy' | 'key_unavailable' | 'incompatible' | 'storage' | 'unknown';

interface RetryOptions {
  attempts?: number;
  delaysMs?: number[];
}

export function classifyDatabaseFailure(cause: unknown): DatabaseFailureKind {
  const message = cause instanceof Error ? cause.message.toLowerCase() : String(cause).toLowerCase();
  if (message.includes('locked') || message.includes('busy')) return 'busy';
  if (
    message.includes('securestore')
    || message.includes('secure store')
    || message.includes('keychain')
    || message.includes('not a database')
    || message.includes('encrypted')
    || message.includes('cipher')
  ) return 'key_unavailable';
  if (
    message.includes('newer application version')
    || message.includes('no such table')
    || message.includes('no such column')
    || message.includes('malformed schema')
    || message.includes('user_version')
  ) return 'incompatible';
  if (
    message.includes('disk')
    || message.includes('storage')
    || message.includes('i/o')
    || message.includes('readonly')
    || message.includes('read-only')
    || message.includes('unable to open database file')
  ) return 'storage';
  return 'unknown';
}

export function databaseStartupMessage(cause: unknown) {
  switch (classifyDatabaseFailure(cause)) {
    case 'busy':
      return 'Your private timeline is briefly busy finishing another local update. Try again in a moment.';
    case 'key_unavailable':
      return 'ATIRA could not unlock your private timeline. Make sure the device is unlocked, then try again.';
    case 'incompatible':
      return 'This local timeline could not be upgraded safely with the current app version.';
    case 'storage':
      return 'ATIRA could not access local storage. Check that the device has free space, then try again.';
    default:
      return 'ATIRA could not open its private local timeline. Your data has not been deleted.';
  }
}

export async function retryTransientDatabaseOperation<T>(
  operation: () => Promise<T>,
  { attempts = 3, delaysMs = [60, 180] }: RetryOptions = {},
): Promise<T> {
  let lastCause: unknown;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      return await operation();
    } catch (cause) {
      lastCause = cause;
      if (classifyDatabaseFailure(cause) !== 'busy' || attempt >= attempts - 1) throw cause;
      const delayMs = delaysMs[Math.min(attempt, delaysMs.length - 1)] ?? 0;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastCause;
}
