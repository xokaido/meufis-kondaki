<script>
  import { parseRoute } from './lib/router.js';
  import { theme, fontScale, showRubrics } from './lib/store.js';
  import Home from './views/Home.svelte';
  import Category from './views/Category.svelte';
  import Reader from './views/Reader.svelte';

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

{#key route.view + ':' + (route.id || '') + ':' + (route.block ?? '')}
  {#if route.view === 'home'}
    <Home />
  {:else if route.view === 'category'}
    <Category id={route.id} />
  {:else}
    <Reader id={route.id} block={route.block} />
  {/if}
{/key}
