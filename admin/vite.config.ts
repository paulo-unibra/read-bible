import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  css: {
    transformer: 'postcss',
  },
  build: {
    cssMinify: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
