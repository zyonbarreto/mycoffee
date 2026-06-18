import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE on the service worker:
// We cache only the static app shell (HTML/CSS/JS/icons/fonts).
// We do NOT cache any Google Places responses. Caching Places content
// (name, rating, reviews) violates the Maps Platform Terms. place_id is
// the only Places value we ever persist, and that lives in localStorage,
// not the SW cache.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'google-on-white.png'],
      manifest: {
        name: 'MyCoffee',
        short_name: 'MyCoffee',
        description: 'Good coffee, now. Discover top-rated shops near you.',
        theme_color: '#2E2017',
        background_color: '#2E2017',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precache the shell. Runtime-cache fonts only. Never the proxy/API.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } }
          }
        ]
      }
    })
  ]
});
