import { describe, it, expect, beforeEach } from 'vitest';
import { persisted, getPos, setPos, getLast, setLast, sweepPositions } from '../src/lib/store.js';
import { get } from 'svelte/store';

beforeEach(() => localStorage.clear());

describe('persisted', () => {
  it('uses the default when nothing is stored', () => {
    expect(get(persisted('x1', 7))).toBe(7);
  });
  it('reads existing mk:-prefixed values (back-compat with old app)', () => {
    localStorage.setItem('mk:font', '1.3');
    expect(get(persisted('font', 1))).toBe(1.3);
  });
  it('writes back under mk: prefix', () => {
    const s = persisted('x2', 'a');
    s.set('b');
    expect(localStorage.getItem('mk:x2')).toBe('"b"');
  });
});

describe('positions', () => {
  it('round-trips a reading position and records last-read', () => {
    setPos('vespers', 42);
    expect(getPos('vespers')).toBe(42);
    expect(getLast().id).toBe('vespers');
  });
  it('getLast returns null when never set', () => {
    expect(getLast()).toBe(null);
  });
  it('setLast is explicit too', () => {
    setLast('matins');
    expect(getLast().id).toBe('matins');
  });
});

describe('sweepPositions', () => {
  it('drops position keys for texts no longer in the index, keeps valid ones', () => {
    setPos('vespers', 10);
    setPos('ghost', 33);
    localStorage.setItem('mk:theme', '"dark"'); // unrelated keys untouched
    sweepPositions(new Set(['vespers', 'matins']));
    expect(getPos('vespers')).toBe(10);
    expect(localStorage.getItem('mk:pos:ghost')).toBe(null);
    expect(localStorage.getItem('mk:theme')).toBe('"dark"');
  });
  it('clears mk:last when it points at a removed text', () => {
    setLast('ghost');
    sweepPositions(new Set(['vespers']));
    expect(getLast()).toBe(null);
    setLast('vespers');
    sweepPositions(new Set(['vespers']));
    expect(getLast().id).toBe('vespers');
  });
});
