// Écriture du manifeste d'assets partagée par les extracteurs : on relit le fichier juste avant
// d'écrire et on ne remplace que ses propres sections, pour que deux extractions lancées en même
// temps n'effacent pas le travail l'une de l'autre.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/assets/dofus/manifest.json');

export function readManifest() {
  return fs.existsSync(MANIFEST_FILE) ? JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')) : {};
}

/** Relit le manifeste, applique `change` (qui modifie l'objet reçu) et l'écrit aussitôt. */
export function updateManifest(change) {
  const manifest = readManifest();
  change(manifest);
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}
