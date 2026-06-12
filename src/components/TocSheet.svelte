<script>
  import { fontScale, showRubrics, wakeWanted } from '../lib/store.js';
  import { setWake } from '../lib/wake.js';

  let { toc = [], currentI = 0, onGo, onClose, onPickRole } = $props();

  function fontStep(d) {
    fontScale.update((f) => Math.min(1.7, Math.max(0.8, +(f + d).toFixed(2))));
  }
  function toggleWake() {
    wakeWanted.update((w) => { setWake(!w); return !w; });
  }
  // current section = last toc anchor at or before currentI
  const curAnchor = $derived.by(() => {
    let cur = toc[0]?.i ?? 0;
    for (const t of toc) { if (t.i <= currentI) cur = t.i; else break; }
    return cur;
  });
</script>

<button class="scrim" onclick={onClose} aria-label="დახურვა"></button>
<div class="sheet" role="dialog" aria-label="სარჩევი და პარამეტრები">
  <div class="grip"></div>
  <div class="controls">
    <div class="ctl"><button onclick={() => fontStep(-0.1)}>A−</button><button onclick={() => fontStep(0.1)}>A+</button></div>
    <button class="ctl one" class:on={$showRubrics} onclick={() => showRubrics.update((r) => !r)}>განგება</button>
    <button class="ctl one" class:on={$wakeWanted} onclick={toggleWake}>⏾ ეკრანი</button>
    <button class="ctl one" onclick={onPickRole}>როლი</button>
  </div>
  <nav class="toc">
    {#each toc as t, n (t.i)}
      <button class:cur={t.i === curAnchor} onclick={() => onGo(t.i)}>
        <span class="n">{n + 1}</span>{t.text}
      </button>
    {/each}
  </nav>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 40; width: 100%; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 72vh; display: flex; flex-direction: column; background: var(--bg-sheet); border-radius: 18px 18px 0 0; z-index: 41; padding: 8px 16px calc(14px + env(safe-area-inset-bottom)); box-shadow: var(--shadow); }
  .grip { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 4px auto 12px; }
  .controls { display: flex; gap: 8px; margin-bottom: 12px; }
  .ctl { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .ctl button, .ctl.one { padding: 8px 12px; font-size: 13.5px; font-weight: 600; }
  .ctl.one.on { color: var(--accent); border-color: var(--accent); }
  .toc { overflow-y: auto; }
  .toc button { display: flex; gap: 10px; align-items: baseline; width: 100%; text-align: left; padding: 9px 6px; border-bottom: 1px solid var(--line); font-size: 14.5px; }
  .toc button.cur { color: var(--accent); font-weight: 700; }
  .toc .n { color: var(--muted); font-size: 11px; min-width: 16px; }
</style>
