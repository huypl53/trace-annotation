import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite natively supports --port and --host CLI arguments
// For backend proxy configuration, use environment variables
const backendPort = process.env.BACKEND_PORT || process.env.PORT || 3001;
const backendHost = process.env.BACKEND_HOST || process.env.HOST || 'localhost';
const backendUrl = `http://${backendHost}:${backendPort}`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port and host can be set via Vite's native CLI args: --port, --host
    // or via environment variables: VITE_PORT, VITE_HOST
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/files': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});

