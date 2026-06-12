// Hash router. Pure parser — App.svelte owns the hashchange listener.
const LEGACY_IDS = ['vespers', 'matins', 'liturgy', 'kmevebi', 'paraklisi',
  'litanioba', 'jvari', 'ziareba', 'gansatevebelni', 'kurtxevani'];

export function parseRoute(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  if (!path) return { view: 'home' };
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'cat' && seg[1]) return { view: 'category', id: seg[1] };
  if (seg[0] === 't' && seg[1]) {
    const params = new URLSearchParams(query || '');
    const bVal = params.get('b');
    const b = +bVal;
    return { view: 'reader', id: seg[1], block: params.has('b') && bVal && Number.isInteger(b) ? b : null };
  }
  if (seg.length === 1 && LEGACY_IDS.includes(seg[0])) {
    return { view: 'reader', id: seg[0], block: null, redirect: '#/t/' + seg[0] };
  }
  return { view: 'home' };
}
