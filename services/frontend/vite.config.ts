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
      }
    }
  }
});
