import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Dev local tras el gateway Nginx: no restringir el Host (evita el bloqueo
    // anti DNS-rebinding de Vite cuando se accede por localhost/IP/servicio).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://game-service:3001',
        changeOrigin: true
      },
      // WebSocket de salas/partidas: imprescindible al entrar por el dev
      // server (5173) en vez del gateway; nginx ya lo proxya en 443.
      '/ws': {
        target: 'ws://game-service:3001',
        ws: true
      }
    }
  }
});
