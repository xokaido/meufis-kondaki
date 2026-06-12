// Georgian-aware text normalization: Georgian has no case, but titles may
// contain Latin; punctuation differs between query and source.
export function normalize(s) {
  return s.toLowerCase()
    .replace(/[„""''«»,.;:!?()\[\]—–\-_*·~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Linear scan over the prebuilt index — at hundreds of texts this is a few
// hundred KB of strings, fine on-device. entries: [blockIndex, section, text].
export function searchIndex(index, query, limit = 60) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const out = [];
  for (const text of index) {
    for (const [i, section, body] of text.entries) {
      if (normalize(body).includes(q)) {
        out.push({ id: text.id, name: text.name, i, section, body });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}
