import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseLines, loadTexts } = require('../build.cjs');

// Regression net for the real markdown sources: a content edit that breaks
// block classification, TOC coverage, or a curated landmark should fail here,
// not be discovered in church. Ranges leave headroom for normal text edits.
const EXPECTED = {
  vespers: { blocks: [150, 230], toc: [10, 18], roles: ['bishop', 'deacon', 'choir'] },
  matins: { blocks: [260, 390], toc: [16, 26], roles: ['bishop', 'deacon', 'choir', 'reader'] },
  liturgy: { blocks: [560, 820], toc: [10, 18], roles: ['bishop', 'priest', 'deacon', 'choir'] },
  kmevebi: { blocks: [30, 65], toc: [8, 15], roles: [] },
  paraklisi: { blocks: [50, 95], toc: [2, 6], roles: ['choir'] },
  litanioba: { blocks: [45, 90], toc: [1, 4], roles: ['choir'] },
  jvari: { blocks: [20, 45], toc: [1, 4], roles: [] },
  ziareba: { blocks: [170, 270], toc: [22, 38], roles: [] },
  gansatevebelni: { blocks: [20, 42], toc: [9, 18], roles: [] },
  kurtxevani: { blocks: [42, 85], toc: [5, 11], roles: [] },
};

const parsed = loadTexts().map((t) => ({
  ...t,
  ...parseLines(t.bodyLines, t.id, !!t.skipTitle, t.mode, t.landmarks),
}));

describe('golden data (real sources)', () => {
  it('produces exactly the expected text ids, in library order', () => {
    expect(parsed.map((t) => t.id)).toEqual(Object.keys(EXPECTED));
  });

  for (const [id, exp] of Object.entries(EXPECTED)) {
    describe(id, () => {
      const t = () => parsed.find((x) => x.id === id);

      it('block count stays within the expected range', () => {
        const n = t().blocks.length;
        expect(n).toBeGreaterThanOrEqual(exp.blocks[0]);
        expect(n).toBeLessThanOrEqual(exp.blocks[1]);
      });

      it('TOC is present and within range', () => {
        const n = t().toc.length;
        expect(n).toBeGreaterThanOrEqual(exp.toc[0]);
        expect(n).toBeLessThanOrEqual(exp.toc[1]);
      });

      it('every curated landmark resolves to a TOC-covered block', () => {
        // The landmark's match phrase must find a block, and that block must
        // be a TOC anchor. The anchor may carry a different label when the
        // block is itself a heading (dedup keeps the heading's own text).
        const tocIdx = new Set(t().toc.map((a) => a.i));
        for (const [match] of t().landmarks) {
          const i = t().blocks.findIndex(
            (b) => (b.text || '').includes(match) || (b.who || '').includes(match));
          expect(i, `landmark "${match}" finds no block`).toBeGreaterThanOrEqual(0);
          expect(tocIdx.has(i), `landmark "${match}" block ${i} not in TOC`).toBe(true);
        }
      });

      it('key speaking roles appear in the text', () => {
        const roles = new Set(t().blocks.filter((b) => b.t === 'say').map((b) => b.role));
        for (const r of exp.roles) expect([...roles]).toContain(r);
      });

      it('has only known block types; only say blocks may be text-empty', () => {
        for (const b of t().blocks) {
          expect(['say', 'rubric', 'text', 'prayer', 'head', 'sep']).toContain(b.t);
          // speaker-only lines ("საიდუმლოდ მღვდელმან:") legitimately have no
          // text — the prayer they introduce follows as its own block
          if (b.t !== 'sep' && b.t !== 'say') expect(b.text.length).toBeGreaterThan(0);
          if (b.t === 'say') expect(b.who.length).toBeGreaterThan(0);
        }
      });
    });
  }
});
