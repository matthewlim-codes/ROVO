import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal'
import path from 'path'

export default defineConfig(async () => ({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({ root: path.resolve(__dirname, '..') }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}))
