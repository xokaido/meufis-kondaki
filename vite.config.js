import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // relative base: works at gulani.ge root AND xokaido.github.io/meufis-kondaki/
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
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
        skipWaiting: true,
      },
      manifest: {
        name: 'გულანი',
        short_name: 'გულანი',
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
