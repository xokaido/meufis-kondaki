<script>
  import { loadIndex } from '../lib/data.js';
  import { getPos } from '../lib/store.js';

  let { id } = $props();
  let index = $state(null);
  loadIndex().then((i) => { index = i; });

  const cat = $derived(index ? index.categories.find((c) => c.id === id) : null);
  const texts = $derived(index ? index.texts.filter((t) => t.category === id) : []);
  function pctFor(t) {
    const pos = getPos(t.id);
    return pos > 2 ? Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) : 0;
  }
</script>

<div class="cat">
  <header class="bar">
    <a class="back" href="#/" aria-label="უკან">‹</a>
    <h1>{cat ? cat.name : ''}</h1>
  </header>
  {#each texts as t (t.id)}
    <a class="card" href="#/t/{t.id}">
      <span class="main"><span class="nm">{t.name}</span><span class="sb">{t.subtitle}</span></span>
      <span class="go" aria-hidden="true">›</span>
      {#if pctFor(t)}<span class="pr"><i style="width:{pctFor(t)}%"></i></span>{/if}
    </a>
  {/each}
</div>

<style>
  .cat { max-width: 560px; margin: 0 auto; padding: max(10px, env(safe-area-inset-top)) 16px 32px; }
  .bar { display: flex; align-items: center; gap: 6px; padding: 8px 0 14px; }
  .back { font-size: 26px; line-height: 1; text-decoration: none; color: var(--muted); padding: 0 8px 4px 0; }
  h1 { font-size: 17px; }
  .card { display: block; text-decoration: none; color: inherit; position: relative; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 9px; }
  .card .main { display: inline-flex; flex-direction: column; width: calc(100% - 20px); }
  .card .nm { font-size: 16px; font-weight: 600; }
  .card .sb { font-size: 12px; color: var(--muted); }
  .card .go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .pr { display: block; height: 3px; background: var(--line); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .pr i { display: block; height: 3px; background: var(--accent); border-radius: 2px; }
</style>
