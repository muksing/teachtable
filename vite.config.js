import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const src = resolve(__dirname, 'src')

export default defineConfig({
  root: __dirname,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'SchoolLOG',
        short_name: 'SchoolLOG',
        description: 'ระบบบริหารโรงเรียน SchoolLOG',
        theme_color: '#6d28d9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'th',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [{ find: '@', replacement: src }],
  },
  optimizeDeps: {
    include: ['exceljs'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // ใส่ content hash ใน filename เสมอ (ค่า default ของ Vite) เพื่อ cache-bust
        // อัตโนมัติทุกครั้งที่ deploy — ถ้าตั้งชื่อไฟล์คงที่ (ไม่มี hash) เบราว์เซอร์/CDN/
        // เครือข่ายมือถือจะแคชไฟล์เก่าไว้ที่ URL เดิมได้เรื่อย ๆ แม้เนื้อหาจะเปลี่ยนแล้ว
        inlineDynamicImports: true,
      },
    },
    assetsInlineLimit: 999999999,
  },
})
