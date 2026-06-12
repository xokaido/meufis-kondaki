import { describe, it, expect } from 'vitest';
import { parseRoute } from '../src/lib/router.js';

describe('parseRoute', () => {
  it('empty hash → home', () => {
    expect(parseRoute('')).toEqual({ view: 'home' });
    expect(parseRoute('#/')).toEqual({ view: 'home' });
  });
  it('category route', () => {
    expect(parseRoute('#/cat/rites')).toEqual({ view: 'category', id: 'rites' });
  });
  it('reader route, with and without block param', () => {
    expect(parseRoute('#/t/vespers')).toEqual({ view: 'reader', id: 'vespers', block: null });
    expect(parseRoute('#/t/liturgy?b=42')).toEqual({ view: 'reader', id: 'liturgy', block: 42 });
  });
  it('legacy ids redirect to reader', () => {
    expect(parseRoute('#/vespers')).toEqual({ view: 'reader', id: 'vespers', block: null, redirect: '#/t/vespers' });
    expect(parseRoute('#/kurtxevani').redirect).toBe('#/t/kurtxevani');
  });
  it('unknown → home', () => {
    expect(parseRoute('#/nonsense/x')).toEqual({ view: 'home' });
  });
});
