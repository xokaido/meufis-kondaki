import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// fresh module per test so internal lock/want state resets
async function freshWake() {
  vi.resetModules();
  return import('../src/lib/wake.js');
}

beforeEach(() => {
  delete navigator.wakeLock;
});

describe('wake status', () => {
  it('reports unsupported when the API is missing', async () => {
    const { setWake, wakeStatus } = await freshWake();
    setWake(true);
    await Promise.resolve();
    expect(get(wakeStatus)).toBe('unsupported');
  });

  it('reports active on successful acquisition, off after release', async () => {
    const lock = { release: vi.fn(), addEventListener: vi.fn() };
    navigator.wakeLock = { request: vi.fn().mockResolvedValue(lock) };
    const { setWake, wakeStatus } = await freshWake();
    setWake(true);
    await vi.waitFor(() => expect(get(wakeStatus)).toBe('active'));
    setWake(false);
    expect(lock.release).toHaveBeenCalled();
    expect(get(wakeStatus)).toBe('off');
  });

  it('reports failed when the browser denies the request', async () => {
    navigator.wakeLock = { request: vi.fn().mockRejectedValue(new Error('denied')) };
    const { setWake, wakeStatus } = await freshWake();
    setWake(true);
    await vi.waitFor(() => expect(get(wakeStatus)).toBe('failed'));
  });
});
