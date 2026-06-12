import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseLines, roleFor, searchEntries, parseFrontmatter, loadTexts, CATEGORIES } = require('../build.cjs');

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
  it('every text in texts/ has a browsable category', () => {
    const browsable = CATEGORIES.filter((c) => !c.soon).map((c) => c.id);
    const texts = loadTexts();
    expect(texts.length).toBeGreaterThanOrEqual(10);
    for (const t of texts) {
      expect(browsable).toContain(t.category);
    }
  });
  it('CATEGORIES lists browsable + coming-soon categories in order', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['services', 'rites', 'prayers', 'propers', 'scores']);
    expect(CATEGORIES.find((c) => c.id === 'propers').soon).toBe(true);
  });
});

describe('parseFrontmatter', () => {
  it('parses keys, landmarks, skipTitle and returns the body', () => {
    const raw = [
      '---',
      'id: test',
      'name: სატესტო',
      'subtitle: ქვესათაური',
      'category: rites',
      'mode: hybrid',
      'skipTitle: true',
      'landmark: საძიებო ფრაზა | იარლიყი',
      'landmark: მეორე | ანკერი',
      '---',
      'პირველი სტრიქონი',
    ].join('\n');
    const { meta, bodyLines } = parseFrontmatter(raw, 'test.md');
    expect(meta).toEqual({
      id: 'test', name: 'სატესტო', subtitle: 'ქვესათაური', category: 'rites',
      mode: 'hybrid', skipTitle: true,
      landmarks: [['საძიებო ფრაზა', 'იარლიყი'], ['მეორე', 'ანკერი']],
    });
    expect(bodyLines).toEqual(['პირველი სტრიქონი']);
  });
  it('rejects files without frontmatter or required keys', () => {
    expect(() => parseFrontmatter('plain text', 'x.md')).toThrow(/missing frontmatter/);
    expect(() => parseFrontmatter('---\nid: a\n---\n', 'x.md')).toThrow(/missing "name"/);
    expect(() => parseFrontmatter('---\nid: a\n', 'x.md')).toThrow(/unterminated/);
  });
  it('rejects unknown keys and invalid modes (silent typos)', () => {
    const base = 'id: a\nname: ბ\nsubtitle: გ\ncategory: rites\n';
    expect(() => parseFrontmatter(`---\n${base}moed: hybrid\n---\n`, 'x.md')).toThrow(/unknown frontmatter key "moed"/);
    expect(() => parseFrontmatter(`---\n${base}mode: hybird\n---\n`, 'x.md')).toThrow(/mode must be "hybrid" or "text"/);
    expect(() => parseFrontmatter(`---\n${base}mode: hybrid\n---\n`, 'x.md')).not.toThrow();
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

  it('attributes blocks to the correct section across multiple anchors', () => {
    const svc = {
      blocks: [
        { t: 'prayer', text: 'one' },
        { t: 'prayer', text: 'two' },
        { t: 'prayer', text: 'three' },
        { t: 'prayer', text: 'four' },
      ],
      toc: [{ text: 'A', i: 0 }, { text: 'B', i: 2 }],
    };
    const e = searchEntries(svc);
    expect(e[0][1]).toBe('A');
    expect(e[1][1]).toBe('A');
    expect(e[2][1]).toBe('B');
    expect(e[3][1]).toBe('B');
  });
});
