// Collapsible prayer groups. Strict rule (ported from the old app): a heading
// followed IMMEDIATELY by one or more consecutive prayer blocks becomes a
// group covering exactly that run. Anything else in between breaks the group,
// so block order is never changed — only wrapped.
export function groupBlocks(blocks) {
  const items = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === 'head' && i + 1 < blocks.length && blocks[i + 1].t === 'prayer') {
      let j = i + 1;
      while (j < blocks.length && blocks[j].t === 'prayer') j++;
      items.push({ group: true, head: b, i, blocks: blocks.slice(i + 1, j), start: i + 1 });
      i = j - 1;
    } else {
      items.push({ group: false, block: b, i });
    }
  }
  return items;
}
