import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { 'node:crypto': fileURLToPath(new URL('./src/devCrypto.ts', import.meta.url)) } },
  // Chemins relatifs : le jeu marche aussi publié dans un sous-dossier (GitHub Pages /Risk-of-dof/).
  base: './',
  server: {
    port: 5173,
    // Écoute sur le réseau local : un ami sur le même Wi-Fi peut ouvrir http://<ip>:5173
    host: true,
  },
  build: {
    rollupOptions:{input:{game:fileURLToPath(new URL('./index.html',import.meta.url)),mastery:fileURLToPath(new URL('./mastery-test.html',import.meta.url))}},
    // Phaser est volumineux : inutile d'avertir.
    chunkSizeWarningLimit: 2500,
  },
});
