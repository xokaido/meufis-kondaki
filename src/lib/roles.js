export const ROLES = [
  { id: 'bishop', name: 'მღვდელმთავარი' },
  { id: 'priest', name: 'მღვდელი' },
  { id: 'deacon', name: 'დიაკონი' },
  { id: 'reader', name: 'მკითხველი' },
  { id: 'choir', name: 'გუნდი' },
];

export function roleName(id) {
  const r = ROLES.find((x) => x.id === id);
  return r ? r.name : '';
}

// neutral "person" icon for the no-role state (mirrors ROLE_ICONS styling)
export const NO_ROLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M5.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>';

// mine: indices of blocks spoken by `role`. cue: the nearest non-separator
// block before each run of mine — "your entrance is next."
export function roleMarks(blocks, role) {
  const mine = new Set(), cue = new Set();
  if (!role) return { mine, cue };
  blocks.forEach((b, i) => { if (b.t === 'say' && b.role === role) mine.add(i); });
  for (const i of mine) {
    for (let j = i - 1; j >= 0; j--) {
      if (blocks[j].t === 'sep') continue;
      if (!mine.has(j)) cue.add(j);
      break;
    }
  }
  return { mine, cue };
}

export const ROLE_ICONS = {
  bishop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M8.5 6h7M6.5 10h11M8.5 13l7 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  priest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v17M7 9h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>',
  deacon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="16" r="3.8" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 12.2V8.5M12 8.5 8.8 4.2M12 8.5l3.2-4.3M9 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
  choir: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.5" cy="15.8" r="2.4" fill="currentColor"/><path d="M10.4 17.5V7.2l8.5-2v10.6M10.4 9.4l8.5-2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  reader: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.3C10.2 5 7.8 4.4 4.8 4.6V18c3-.2 5.4.4 7.2 1.7 1.8-1.3 4.2-1.9 7.2-1.7V4.6c-3-.2-5.4.4-7.2 1.7Zm0 0v13.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>',
};
