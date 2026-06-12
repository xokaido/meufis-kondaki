import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { textsHotReload } from './scripts/vite-plugin-texts.js';

export default defineConfig({
  // relative base: works at kondaki.ge root AND xokaido.github.io/meufis-kondaki/
  base: './',
  plugins: [
    svelte(),
    textsHotReload(),
    VitePWA({
      // prompt mode: a deploy landing while someone follows a live service
      // must never reload the page under them. The new SW waits; the home
      // screen offers a refresh chip, and a normal app restart applies it.
      registerType: 'prompt',
      // keep the SW filename the old app used so installed clients update in place
      filename: 'sw.js',
      // not in the manifest icons, still wanted offline
      includeAssets: ['icons/apple-touch-icon.png'],
      workbox: {
        // icons + webmanifest are precached via the PWA manifest integration;
        // globbing them too would duplicate the precache entries
        globPatterns: ['**/*.{js,css,html,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
      manifest: {
        name: 'კონდაკი',
        short_name: 'კონდაკი',
        description: 'წესი და განგება მღვდელმთავრის მსახურებისა',
        lang: 'ka',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#191310',
        theme_color: '#191310',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
