<script>
  import { parseRoute } from './lib/router.js';
  import { theme, fontScale, showRubrics } from './lib/store.js';
  import Home from './views/Home.svelte';
  import Category from './views/Category.svelte';
  import Reader from './views/Reader.svelte';

  // Resolve legacy URLs (#/vespers → #/t/vespers) during init so the reader
  // never renders for one tick before the redirect lands.
  const initial = parseRoute(location.hash);
  if (initial.redirect) location.replace(initial.redirect);
  let route = $state(initial.redirect ? { view: 'home' } : initial);

  function onHash() {
    const r = parseRoute(location.hash);
    if (r.redirect) { location.replace(r.redirect); return; }
    route = r;
  }
  $effect(() => {
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  // Home's title lives here so it can't go stale after leaving the reader;
  // Category and Reader set their own richer titles when their data loads.
  $effect(() => {
    if (route.view === 'home') document.title = 'მეუფის კონდაკი';
  });

  // global settings → document
  $effect(() => {
    document.documentElement.dataset.theme = $theme;
    document.documentElement.style.setProperty('--fs', $fontScale);
    document.body.classList.toggle('hide-rubrics', !$showRubrics);
    const mc = document.querySelector('meta[name=theme-color]');
    if (mc) mc.content = $theme === 'light' ? '#f6efdd' : '#191310';
  });
</script>

{#key route.view + ':' + (route.id || '') + ':' + (route.block ?? '')}
  {#if route.view === 'home'}
    <Home />
  {:else if route.view === 'category'}
    <Category id={route.id} />
  {:else}
    <Reader id={route.id} block={route.block} />
  {/if}
{/key}
