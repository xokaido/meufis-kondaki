import { describe, it, expect } from 'vitest';
import { esc, fmt } from '../src/lib/fmt.js';

describe('esc/fmt', () => {
  it('escapes HTML', () => {
    expect(esc('<b> & x')).toBe('&lt;b&gt; &amp; x');
  });
  it('renders *emphasis* as <em>', () => {
    expect(fmt('აქა *სიტყვა* არს')).toBe('აქა <em>სიტყვა</em> არს');
  });
  it('escapes before formatting', () => {
    expect(fmt('<i>*x*</i>')).toBe('&lt;i&gt;<em>x</em>&lt;/i&gt;');
  });
});
