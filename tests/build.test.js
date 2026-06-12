import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseLines, roleFor, searchEntries, CATEGORIES, SOURCES, SECTIONS } = require('../build.cjs');

describe('roleFor', () => {
  it('maps speaker labels to roles', () => {
    expect(roleFor('დიაკონი')).toBe('deacon');
    expect(roleFor('გუნდი')).toBe('choir');
    expect(roleFor('მღვდელმთავარი')).toBe('bishop');
    expect(roleFor('მკითხველი')).toBe('reader');
    expect(roleFor('არავინ')).toBe(null);
  });
});

describe('parseLines', () => {
  const lines = [
    '**დასაწყისი**',
    '',
    'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.',
    '',
    'გუნდი: უფალო, შეგვიწყალენ.',
  ];
  it('parses speaker blocks with roles', () => {
    const { blocks } = parseLines(lines, 'x', false);
    expect(blocks[0]).toEqual({ t: 'head', text: 'დასაწყისი' });
    expect(blocks[1]).toEqual({ t: 'say', role: 'deacon', who: 'დიაკონი', text: 'მშვიდობით უფლისა მიმართ ვილოცოთ.' });
    expect(blocks[2].role).toBe('choir');
  });
});

describe('categories', () => {
  it('every source text has a category', () => {
    for (const s of [...SOURCES, ...SECTIONS]) {
      expect(['services', 'rites', 'prayers']).toContain(s.category);
    }
  });
  it('CATEGORIES lists browsable + coming-soon categories in order', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['services', 'rites', 'prayers', 'propers', 'scores']);
    expect(CATEGORIES.find((c) => c.id === 'propers').soon).toBe(true);
  });
});

describe('searchEntries', () => {
  it('emits [blockIndex, sectionTitle, plainText] per searchable block', () => {
    const svc = {
      blocks: [
        { t: 'head', text: 'დასაწყისი' },
        { t: 'say', role: 'deacon', who: 'დიაკონი', text: 'მშვიდობით *უფლისა* მიმართ ვილოცოთ.' },
        { t: 'sep' },
        { t: 'prayer', text: 'წმიდაო ღმერთო' },
      ],
      toc: [{ text: 'დასაწყისი', i: 0 }],
    };
    const e = searchEntries(svc);
    expect(e).toEqual([
      [0, 'დასაწყისი', 'დასაწყისი'],
      [1, 'დასაწყისი', 'დიაკონი: მშვიდობით უფლისა მიმართ ვილოცოთ.'],
      [3, 'დასაწყისი', 'წმიდაო ღმერთო'],
    ]);
  });
});
