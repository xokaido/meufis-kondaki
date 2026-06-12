<script>
  import { role } from '../lib/store.js';
  import { ROLES, ROLE_ICONS } from '../lib/roles.js';
  import { dialog } from '../lib/dialog.js';

  let { onClose } = $props();
  function pick(id) { role.set(id); onClose(); }
</script>

<button class="scrim" onclick={onClose} aria-label="დახურვა"></button>
<div class="sheet" role="dialog" aria-label="როლის არჩევა" use:dialog={{ onClose }}>
  <div class="grip"></div>
  <h3>ვინ ხართ მსახურებაზე?</h3>
  <p class="note">თქვენი სტრიქონები გამოიკვეთება — არაფერი იმალება</p>
  {#each ROLES as r (r.id)}
    <button class="opt role-{r.id}" class:cur={$role === r.id} onclick={() => pick(r.id)}>
      <span class="ic">{@html ROLE_ICONS[r.id]}</span>{r.name}
      {#if $role === r.id}<span class="chk">✓</span>{/if}
    </button>
  {/each}
  <button class="opt" class:cur={$role === null} onclick={() => pick(null)}>
    მლოცველი — როლის გარეშე
    {#if $role === null}<span class="chk">✓</span>{/if}
  </button>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50; width: 100%; }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; background: var(--bg-sheet); border-radius: 18px 18px 0 0; z-index: 51; padding: 8px 18px calc(18px + env(safe-area-inset-bottom)); box-shadow: var(--shadow); }
  .grip { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 4px auto 12px; }
  h3 { font-size: 16px; }
  .note { color: var(--muted); font-size: 12.5px; margin: 2px 0 12px; }
  .opt { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 11px 8px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 600; }
  .opt .ic { display: inline-flex; }
  .opt .ic :global(svg) { width: 18px; height: 18px; }
  .role-bishop .ic { color: var(--c-bishop); }
  .role-priest .ic { color: var(--c-priest); }
  .role-deacon .ic { color: var(--c-deacon); }
  .role-reader .ic { color: var(--c-reader); }
  .role-choir .ic { color: var(--c-choir); }
  .opt .chk { margin-left: auto; color: var(--accent); }
  .opt.cur { color: var(--accent); }
</style>
