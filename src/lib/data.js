// Data loading with in-memory memoization. Everything is also SW-precached,
// so these fetches are instant and offline-safe after first install.
const cache = {};

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
}

function memo(key, url) {
  if (!cache[key]) {
    cache[key] = fetchJson(url).catch((err) => { delete cache[key]; throw err; });
  }
  return cache[key];
}

export const loadIndex = () => memo('index', 'data/index.json');
export const loadText = (id) => memo('t:' + id, 'data/' + id + '.json');
export const loadSearchIndex = () => memo('search', 'data/search-index.json');
