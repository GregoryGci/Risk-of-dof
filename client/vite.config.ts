import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // Écoute sur le réseau local : un ami sur le même Wi-Fi peut ouvrir http://<ip>:5173
    host: true,
  },
  build: {
    // Phaser est volumineux : inutile d'avertir.
    chunkSizeWarningLimit: 2500,
  },
});
