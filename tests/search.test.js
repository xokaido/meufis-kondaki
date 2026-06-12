import { describe, it, expect } from 'vitest';
import { normalize, searchIndex, snippetParts, normalizedWithMap } from '../src/lib/search.js';

const IDX = [
  { id: 'vespers', name: 'მწუხრი', entries: [
    [3, 'დიდი კვერექსი', 'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.'],
    [4, 'დიდი კვერექსი', 'გუნდი: უფალო, შეგვიწყალენ.'],
  ]},
  { id: 'liturgy', name: 'ლიტურგია', entries: [
    [10, 'ანტიფონები', 'გუნდი: უფალო, შეგვიწყალენ, შეგვიწყალენ.'],
  ]},
];

describe('normalize', () => {
  it('strips punctuation and collapses whitespace', () => {
    expect(normalize('უფალო,  შეგვიწყალენ.')).toBe('უფალო შეგვიწყალენ');
  });
  it('lowercases latin', () => {
    expect(normalize('Amen!')).toBe('amen');
  });
});

describe('searchIndex', () => {
  it('finds matches across texts with section context', () => {
    const r = searchIndex(IDX, 'უფალო შეგვიწყალენ');
    expect(r.length).toBe(2);
    expect(r[0]).toMatchObject({ id: 'vespers', name: 'მწუხრი', i: 4, section: 'დიდი კვერექსი' });
    expect(r[1]).toMatchObject({ id: 'liturgy', i: 10 });
  });
  it('ignores queries shorter than 2 chars', () => {
    expect(searchIndex(IDX, 'უ')).toEqual([]);
  });
  it('matches despite punctuation differences', () => {
    expect(searchIndex(IDX, 'ვილოცოთ').length).toBe(1);
  });
  it('caps results at the limit', () => {
    expect(searchIndex(IDX, 'უფალო', 1).length).toBe(1);
  });
});

describe('snippetParts', () => {
  it('locates a match that only matches after punctuation normalization', () => {
    const p = snippetParts('გუნდი: უფალო, შეგვიწყალენ.', 'უფალო შეგვიწყალენ');
    expect(p.match).toBe('უფალო, შეგვიწყალენ');
    expect(p.before.endsWith('გუნდი: ')).toBe(true);
    expect(p.after).toBe('.');
  });
  it('adds ellipses around a mid-text match', () => {
    const body = 'ა'.repeat(100) + ' საკვანძო სიტყვა ' + 'ბ'.repeat(100);
    const p = snippetParts(body, 'საკვანძო');
    expect(p.match).toBe('საკვანძო');
    expect(p.before.startsWith('…')).toBe(true);
    expect(p.after.endsWith('…')).toBe(true);
  });
  it('falls back to a head slice when nothing matches', () => {
    const p = snippetParts('მოკლე ტექსტი', 'არარსებული');
    expect(p.match).toBe('');
    expect(p.before).toBe('მოკლე ტექსტი');
  });
  it('keeps its normalization identical to normalize()', () => {
    const gnarly = '„უფალო",  შეგვი-წყალენ! (ამინ) — Lord·';
    expect(normalizedWithMap(gnarly).norm).toBe(normalize(gnarly));
  });
});

describe('normalization cache', () => {
  it('repeated searches over the same index return identical results', () => {
    const a = searchIndex(IDX, 'უფალო შეგვიწყალენ');
    const b = searchIndex(IDX, 'უფალო შეგვიწყალენ');
    expect(b).toEqual(a);
    expect(searchIndex(IDX, 'ვილოცოთ').length).toBe(1); // different query, cached norms
  });
});
