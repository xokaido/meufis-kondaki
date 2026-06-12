<script>
  let { sectionName, pos, total, onPrev, onNext } = $props();
</script>

<div class="fbar">
  <button class="step" onclick={onPrev} disabled={pos <= 1} aria-label="წინა სექცია">‹</button>
  <div class="mid">
    <span class="count">{pos}/{total}</span>
    <span class="name">{sectionName}</span>
  </div>
  <button class="step" onclick={onNext} disabled={pos >= total} aria-label="შემდეგი სექცია">›</button>
</div>

<style>
  .fbar { display: flex; align-items: center; gap: 10px; padding: 8px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--bg-raise); }
  .step { font-size: 24px; line-height: 1; color: var(--c-deacon); padding: 8px 20px; border: 1px solid var(--line); border-radius: 12px; min-width: 64px; }
  .step:disabled { opacity: .3; }
  .mid { flex: 1; text-align: center; min-width: 0; }
  .count { display: block; font-size: 11px; color: var(--muted); }
  .name { display: block; font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
