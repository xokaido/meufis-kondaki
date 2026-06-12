<script>
  import { loadIndex } from '../lib/data.js';
  import { theme, role, getPos, getLast } from '../lib/store.js';
  import { roleName } from '../lib/roles.js';
  import { isStandalone, isIOS, onInstallable, promptInstall } from '../lib/install.js';
  import SearchOverlay from '../components/SearchOverlay.svelte';
  import RoleSheet from '../components/RoleSheet.svelte';

  let index = $state(null);
  let failed = $state(false);
  let installable = $state(false);
  let showGuide = $state(false);
  let roleSheetOpen = $state(false);
  let searchOpen = $state(false);

  loadIndex().then((i) => { index = i; }).catch(() => { failed = true; });
  $effect(() => onInstallable((v) => { installable = v; }));

  const services = $derived(index ? index.texts.filter((t) => t.category === 'services') : []);
  const tiles = $derived(index
    ? index.categories.filter((c) => c.id !== 'services').map((c) => ({
        ...c, count: index.texts.filter((t) => t.category === c.id).length,
      }))
    : []);

  const last = getLast();
  const cont = $derived.by(() => {
    if (!last || !index) return null;
    const t = index.texts.find((x) => x.id === last.id);
    if (!t) return null;
    const pos = getPos(t.id);
    if (pos <= 2) return null;
    return { ...t, pct: Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) };
  });

  function pctFor(t) {
    const pos = getPos(t.id);
    return pos > 2 ? Math.min(100, Math.round((pos / (t.blockCount - 1)) * 100)) : 0;
  }
  function toggleTheme() { theme.update((t) => (t === 'light' ? 'dark' : 'light')); }
  function install() { if (!promptInstall()) showGuide = true; }
</script>

<div class="home">
  <header class="hdr">
    <span class="cross" aria-hidden="true">☩</span>
    <h1>მეუფის კონდაკი</h1>
    <button class="badge" onclick={() => { roleSheetOpen = true; }} aria-label="როლის არჩევა">
      {$role ? roleName($role) : 'როლი —'}
    </button>
  </header>
  <p class="tagline">წესი და განგება მღვდელმთავრის მსახურებისა</p>
  <button class="srch" onclick={() => { searchOpen = true; }}>⌕ ძიება ყველა ტექსტში…</button>

  {#if failed}
    <div class="err">
      <p>ვერ ჩაიტვირთა — შეამოწმეთ კავშირი</p>
      <button class="card" onclick={() => location.reload()}><span class="nm">განახლება</span></button>
    </div>
  {:else if index}
    {#if cont}
      <a class="cont" href="#/t/{cont.id}">
        <span class="lbl">გაგრძელება</span>
        <span class="nm">{cont.name}</span>
        <span class="pr"><i style="width:{cont.pct}%"></i></span>
      </a>
    {/if}

    <h2 class="sect">მსახურებანი</h2>
    {#each services as t (t.id)}
      <a class="card" href="#/t/{t.id}">
        <span class="main"><span class="nm">{t.name}</span><span class="sb">{t.subtitle}</span></span>
        <span class="go" aria-hidden="true">›</span>
        {#if pctFor(t)}<span class="pr" aria-label="წაკითხულია {pctFor(t)}%"><i style="width:{pctFor(t)}%"></i></span>{/if}
      </a>
    {/each}

    <h2 class="sect">ბიბლიოთეკა</h2>
    <div class="tiles">
      {#each tiles as c (c.id)}
        {#if c.soon}
          <span class="tile soon"><span class="nm">{c.name}</span><span class="ct">მალე</span></span>
        {:else}
          <a class="tile" href="#/cat/{c.id}">
            <span class="nm">{c.name}</span><span class="ct">{c.count} ტექსტი</span>
          </a>
        {/if}
      {/each}
    </div>

    <div class="foot-row">
      {#if installable || (!isStandalone() && isIOS())}
        <button class="install" onclick={install}>დააყენეთ ტელეფონზე</button>
      {/if}
      <button class="theme" onclick={toggleTheme} aria-label="თემა">{$theme === 'light' ? '☾' : '☀'}</button>
    </div>
    <p class="foot">ტექსტი და თქვენი ადგილი ინახება ამ მოწყობილობაზე</p>
  {/if}

  {#if showGuide}
    <div class="guide" role="dialog" aria-label="დაყენების ინსტრუქცია">
      <button class="scrim" onclick={() => { showGuide = false; }} aria-label="დახურვა"></button>
      <div class="gsheet">
        <h3>დააყენეთ ტელეფონზე</h3>
        <ol>
          <li>{isIOS() ? 'Safari-ში' : 'ბრაუზერში'} შეეხეთ <b>გაზიარების</b> ღილაკს</li>
          <li>აირჩიეთ <b>„ეკრანზე დამატება"</b></li>
        </ol>
        <p>ამის შემდეგ აპლიკაცია გაიხსნება სრულ ეკრანზე და იმუშავებს ინტერნეტის გარეშეც.</p>
        <button class="ok" onclick={() => { showGuide = false; }}>გასაგებია</button>
      </div>
    </div>
  {/if}
  {#if searchOpen}<SearchOverlay onClose={() => { searchOpen = false; }} />{/if}
  {#if roleSheetOpen}<RoleSheet onClose={() => { roleSheetOpen = false; }} />{/if}
</div>

<style>
  .home { max-width: 560px; margin: 0 auto; padding: max(14px, env(safe-area-inset-top)) 16px 32px; }
  .hdr { display: flex; align-items: center; gap: 10px; padding-top: 10px; }
  .cross { color: var(--accent); font-size: 20px; }
  h1 { font-size: 19px; flex: 1; }
  .badge { font-size: 12px; border: 1px solid var(--line); background: var(--bg-sheet); border-radius: 99px; padding: 4px 11px; color: var(--c-choir); font-weight: 700; }
  .tagline { color: var(--muted); font-size: 13px; margin: 4px 0 18px; }
  .srch { display: block; width: 100%; text-align: left; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 10px; padding: 10px 13px; color: var(--muted); font-size: 14px; margin-bottom: 16px; }
  .cont { display: block; text-decoration: none; color: inherit; background: var(--accent-soft); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; margin-bottom: 18px; }
  .cont .lbl { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); font-weight: 700; display: block; }
  .cont .nm { font-weight: 600; }
  .pr { display: block; height: 3px; background: var(--line); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .pr i { display: block; height: 3px; background: var(--accent); border-radius: 2px; }
  .sect { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 18px 0 9px; font-weight: 700; }
  .card { display: block; text-decoration: none; color: inherit; position: relative; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 9px; }
  .card .main { display: inline-flex; flex-direction: column; width: calc(100% - 20px); }
  .card .nm { font-size: 16px; font-weight: 600; }
  .card .sb { font-size: 12px; color: var(--muted); }
  .card .go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .tile { display: flex; flex-direction: column; text-decoration: none; color: inherit; background: var(--bg-sheet); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .tile .nm { font-weight: 700; font-size: 14px; }
  .tile .ct { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .tile.soon { opacity: .55; }
  .foot-row { display: flex; align-items: center; gap: 10px; margin-top: 22px; }
  .install { flex: 1; border: 1px solid var(--accent); color: var(--accent); border-radius: 10px; padding: 10px; font-weight: 600; }
  .theme { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
  .foot { text-align: center; color: var(--muted); font-size: 11.5px; margin-top: 14px; }
  .err { text-align: center; padding: 40px 0; color: var(--muted); }
  .guide { position: fixed; inset: 0; z-index: 50; }
  .scrim { position: absolute; inset: 0; background: rgba(0,0,0,.45); width: 100%; }
  .gsheet { position: absolute; left: 0; right: 0; bottom: 0; background: var(--bg-sheet); border-radius: 18px 18px 0 0; padding: 22px 20px calc(22px + env(safe-area-inset-bottom)); }
  .gsheet ol { padding-left: 22px; margin: 12px 0; }
  .gsheet li { margin-bottom: 8px; }
  .gsheet p { color: var(--muted); font-size: 13px; }
  .ok { width: 100%; margin-top: 12px; background: var(--accent); color: var(--bg); border-radius: 10px; padding: 11px; font-weight: 700; }
</style>
