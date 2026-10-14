import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le jeu marche aussi publié dans un sous-dossier (GitHub Pages /Risk-of-dof/).
  base: './',
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
