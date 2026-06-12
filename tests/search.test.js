import { describe, it, expect } from 'vitest';
import { normalize, searchIndex } from '../src/lib/search.js';

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
