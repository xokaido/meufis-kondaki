<script>
  import { parseRoute } from './lib/router.js';
  import { theme, fontScale, showRubrics } from './lib/store.js';
  import Home from './views/Home.svelte';

  let route = $state(parseRoute(location.hash));

  function onHash() {
    const r = parseRoute(location.hash);
    if (r.redirect) { location.replace(r.redirect); return; }
    route = r;
  }
  $effect(() => {
    addEventListener('hashchange', onHash);
    onHash(); // handle a legacy URL on initial load too
    return () => removeEventListener('hashchange', onHash);
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

{#if route.view === 'home'}
  <Home />
{:else if route.view === 'category'}
  <main style="padding:2rem"><p>placeholder category: {route.id}</p></main>
{:else}
  <main style="padding:2rem"><p>placeholder reader: {route.id}</p></main>
{/if}
