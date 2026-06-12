// Georgian-aware text normalization: Georgian has no case, but titles may
// contain Latin; punctuation differs between query and source.
const PUNCT = /[„""''«»,.;:!?()\[\]—–\-_*·~]/;

export function normalize(s) {
  return s.toLowerCase()
    .replace(/[„""''«»,.;:!?()\[\]—–\-_*·~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// normalize(), but keeping a raw-index map per normalized character so a
// match found in normalized space can be located in the original text.
// Invariant (unit-tested): .norm === normalize(s).
export function normalizedWithMap(s) {
  const out = [], map = [];
  let pendingSpace = false;
  for (let i = 0; i < s.length; i++) {
    if (PUNCT.test(s[i]) || /\s/.test(s[i])) { pendingSpace = out.length > 0; continue; }
    if (pendingSpace) { out.push(' '); map.push(i); pendingSpace = false; }
    for (const c of s[i].toLowerCase()) { out.push(c); map.push(i); }
  }
  return { norm: out.join(''), map };
}

// Snippet around the first normalized match: raw-text segments so the UI can
// render the match highlighted without HTML injection. Falls back to the head
// of the body (match: '') when the query can't be located.
export function snippetParts(body, query, context = 40) {
  const q = normalize(query);
  if (q.length >= 2) {
    const { norm, map } = normalizedWithMap(body);
    const at = norm.indexOf(q);
    if (at !== -1) {
      const rawStart = map[at];
      const rawEnd = map[at + q.length - 1] + 1;
      const ctxStart = Math.max(0, rawStart - context);
      const ctxEnd = Math.min(body.length, rawEnd + Math.round(context * 1.5));
      return {
        before: (ctxStart > 0 ? '…' : '') + body.slice(ctxStart, rawStart),
        match: body.slice(rawStart, rawEnd),
        after: body.slice(rawEnd, ctxEnd) + (ctxEnd < body.length ? '…' : ''),
      };
    }
  }
  return { before: body.length > 120 ? body.slice(0, 120) + '…' : body, match: '', after: '' };
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
