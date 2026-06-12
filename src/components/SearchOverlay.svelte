<script>
  import { loadSearchIndex } from '../lib/data.js';
  import { searchIndex, snippetParts } from '../lib/search.js';
  import { dialog } from '../lib/dialog.js';

  let { onClose } = $props();
  let query = $state('');
  let idx = $state(null);
  let failed = $state(false);
  let input;

  function loadIdx() {
    failed = false;
    loadSearchIndex().then((i) => { idx = i; }).catch(() => { failed = true; });
  }
  loadIdx();
  $effect(() => { input && input.focus(); });

  const results = $derived(idx && query ? searchIndex(idx, query) : []);
  // group consecutive results by text for display
  const grouped = $derived.by(() => {
    const g = [];
    for (const r of results) {
      const last = g[g.length - 1];
      if (last && last.id === r.id) last.hits.push(r);
      else g.push({ id: r.id, name: r.name, hits: [r] });
    }
    return g;
  });

  function go(r) {
    onClose();
    location.hash = `#/t/${r.id}?b=${r.i}`;
  }
</script>

<div class="overlay" role="dialog" aria-label="ძიება" use:dialog={{ onClose, initialFocus: false }}>
  <header class="bar">
    <input bind:this={input} bind:value={query} placeholder="ძიება ყველა ტექსტში…"
      type="search" enterkeyhint="search" />
    <button class="close" onclick={onClose}>დახურვა</button>
  </header>
  <div class="results">
    {#if failed}
      <div class="empty">
        <p>ძიების ინდექსი ვერ ჩაიტვირთა</p>
        <button class="retry" onclick={loadIdx}>კიდევ სცადეთ</button>
      </div>
    {/if}
    {#if query.trim().length >= 2 && idx}
      {#if grouped.length === 0}
        <p class="empty">ვერაფერი მოიძებნა</p>
      {/if}
      {#each grouped as g (g.id)}
        <h3>{g.name}</h3>
        {#each g.hits as r (r.i)}
          {@const p = snippetParts(r.body, query)}
          <button class="hit" onclick={() => go(r)}>
            <span class="sec">{r.section}</span>
            <span class="body">{p.before}{#if p.match}<mark>{p.match}</mark>{/if}{p.after}</span>
          </button>
        {/each}
      {/each}
    {/if}
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; }
  .bar { display: flex; gap: 8px; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; border-bottom: 1px solid var(--line); }
  input { flex: 1; font: inherit; font-size: 15px; color: var(--ink); background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; outline: none; }
  input:focus { border-color: var(--accent); }
  .close { color: var(--accent); font-size: 13.5px; font-weight: 600; }
  .results { flex: 1; overflow-y: auto; padding: 10px 14px 30px; max-width: 560px; margin: 0 auto; width: 100%; }
  h3 { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 16px 0 6px; }
  .hit { display: block; width: 100%; text-align: left; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; margin-bottom: 7px; }
  .sec { display: block; font-size: 10.5px; color: var(--accent); font-weight: 700; }
  .body { font-size: 13.5px; color: var(--ink-soft); }
  .body mark { background: var(--accent-soft); color: var(--ink); font-weight: 600; border-radius: 3px; padding: 0 1px; }
  .empty { color: var(--muted); text-align: center; padding: 30px 0; }
  .retry { margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 18px; font-weight: 600; color: var(--ink); }
</style>
