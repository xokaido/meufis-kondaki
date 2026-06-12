import { describe, it, expect } from 'vitest';
import { groupBlocks } from '../src/lib/blocks.js';

describe('groupBlocks', () => {
  it('wraps head + consecutive prayers into a group, exactly that run', () => {
    const blocks = [
      { t: 'head', text: 'ლოცვები' },
      { t: 'prayer', text: 'ა' },
      { t: 'prayer', text: 'ბ' },
      { t: 'rubric', text: 'განგება' },
      { t: 'head', text: 'სხვა' },
      { t: 'say', role: 'choir', who: 'გუნდი', text: 'უფალო' },
    ];
    const items = groupBlocks(blocks);
    expect(items[0]).toEqual({ group: true, head: blocks[0], i: 0, blocks: [blocks[1], blocks[2]], start: 1 });
    expect(items[1]).toEqual({ group: false, block: blocks[3], i: 3 });
    // head NOT followed by prayer stays a plain block
    expect(items[2]).toEqual({ group: false, block: blocks[4], i: 4 });
    expect(items[3]).toEqual({ group: false, block: blocks[5], i: 5 });
  });
});
