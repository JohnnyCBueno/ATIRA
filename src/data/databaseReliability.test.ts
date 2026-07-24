import { describe, expect, it, vi } from 'vitest';
import { classifyDatabaseFailure, databaseStartupMessage, retryTransientDatabaseOperation } from './databaseReliability';

describe('database reliability', () => {
  it('classifies failures without exposing their raw details to the UI', () => {
    expect(classifyDatabaseFailure(new Error('database is locked'))).toBe('busy');
    expect(classifyDatabaseFailure(new Error('file is encrypted or is not a database'))).toBe('key_unavailable');
    expect(classifyDatabaseFailure(new Error('no such column: newer_field'))).toBe('incompatible');
    expect(classifyDatabaseFailure(new Error('disk I/O error'))).toBe('storage');
    expect(databaseStartupMessage(new Error('secret internal database detail'))).not.toContain('secret');
  });

  it('retries a transient lock and returns the successful result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('database is busy'))
      .mockResolvedValue('opened');

    await expect(retryTransientDatabaseOperation(operation, { attempts: 3, delaysMs: [0, 0] })).resolves.toBe('opened');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry encryption or schema failures', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('file is not a database'));

    await expect(retryTransientDatabaseOperation(operation, { attempts: 3, delaysMs: [0, 0] })).rejects.toThrow('file is not a database');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('stops after the configured number of busy attempts', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('database is locked'));

    await expect(retryTransientDatabaseOperation(operation, { attempts: 3, delaysMs: [0, 0] })).rejects.toThrow('database is locked');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
