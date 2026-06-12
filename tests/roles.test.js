import { describe, it, expect } from 'vitest';
import { ROLES, roleName, roleMarks } from '../src/lib/roles.js';

describe('ROLES', () => {
  it('lists the five serving roles', () => {
    expect(ROLES.map((r) => r.id)).toEqual(['bishop', 'priest', 'deacon', 'reader', 'choir']);
  });
  it('roleName resolves Georgian names', () => {
    expect(roleName('choir')).toBe('გუნდი');
    expect(roleName('bishop')).toBe('მღვდელმთავარი');
  });
});

describe('roleMarks', () => {
  const blocks = [
    { t: 'say', role: 'deacon', who: 'დიაკონი', text: 'ა' },   // 0
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'ბ' },      // 1 mine
    { t: 'rubric', text: 'განგება' },                            // 2
    { t: 'sep' },                                                 // 3
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'გ' },      // 4 mine — cue skips sep
    { t: 'say', role: 'choir', who: 'გუნდი', text: 'დ' },      // 5 mine — prev is mine, no cue
  ];
  it('marks my blocks and the block immediately before each (skipping seps)', () => {
    const { mine, cue } = roleMarks(blocks, 'choir');
    expect([...mine].sort()).toEqual([1, 4, 5]);
    expect([...cue].sort()).toEqual([0, 2]);
  });
  it('no role → nothing marked', () => {
    const { mine, cue } = roleMarks(blocks, null);
    expect(mine.size).toBe(0);
    expect(cue.size).toBe(0);
  });
});
