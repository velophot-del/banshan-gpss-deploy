import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3012',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:3012',
        changeOrigin: true
      }
    }
  }
})
