import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const src = resolve(__dirname, 'src')

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: src },
    ]
  },
  optimizeDeps: {
    include: ['exceljs'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Bundle เป็นไฟล์เดียวสำหรับ GAS
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    // Inline ทุก asset เพื่อส่งเป็น index.html เดียว
    assetsInlineLimit: 999999999
  }
})
