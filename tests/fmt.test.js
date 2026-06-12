import { describe, it, expect } from 'vitest';
import { esc, fmt } from '../src/lib/fmt.js';

describe('esc/fmt', () => {
  it('escapes HTML', () => {
    expect(esc('<b> & x')).toBe('&lt;b&gt; &amp; x');
  });
  it('renders *emphasis* as <em>', () => {
    expect(fmt('აქა *სიტყვა* არს')).toBe('<span class="si">ა</span>ქა <em>სიტყვა</em> არს');
  });
  it('escapes before formatting', () => {
    expect(fmt('<i>*x*</i>')).toBe('&lt;i&gt;<em>x</em>&lt;/i&gt;');
  });
});

describe('sentence initials', () => {
  it('wraps the first Georgian letter of the text', () => {
    expect(fmt('უფალო, შეგვიწყალენ.')).toBe('<span class="si">უ</span>ფალო, შეგვიწყალენ.');
  });
  it('wraps the first letter after each sentence end', () => {
    expect(fmt('ამინ. დიდება შენდა! რამეთუ ძლიერ ხარ?')).toBe(
      '<span class="si">ა</span>მინ. <span class="si">დ</span>იდება შენდა! <span class="si">რ</span>ამეთუ ძლიერ ხარ?');
  });
  it('reaches initials behind opening quotes and emphasis', () => {
    expect(fmt('თქვა. „უფალო"')).toBe('<span class="si">თ</span>ქვა. „<span class="si">უ</span>ფალო"');
    expect(fmt('*სიტყვა* არს')).toBe('<em><span class="si">ს</span>იტყვა</em> არს');
  });
  it('mid-sentence commas and colons do not create initials', () => {
    expect(fmt('ერთი, ორი: სამი')).toBe('<span class="si">ე</span>რთი, ორი: სამი');
  });
  it('non-Georgian starts are untouched', () => {
    expect(fmt('Amen. ამინ.')).toBe('Amen. <span class="si">ა</span>მინ.');
  });
});
