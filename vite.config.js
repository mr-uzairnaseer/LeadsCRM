import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Suppress noisy ECONNREFUSED errors during backend startup race condition
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (err.code === 'ECONNREFUSED') {
              // Backend not ready yet — return a clean 503 so the frontend
              // error handler can display a proper message instead of hanging
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend starting up, please wait...' }));
              }
            }
          });
        },
      },
    },
  },
})
