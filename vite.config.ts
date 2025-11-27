import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}', 'images/icon-*.png', 'images/banner.jpg', 'images/fj.jpg']
      },
      manifest: {
        name: 'Forest Pests',
        short_name: 'Forest Pests',
        description: 'A first-person arcade shooter inspired by classic Space Invaders',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#00ff88',
        icons: [
          { src: './images/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './images/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
});
