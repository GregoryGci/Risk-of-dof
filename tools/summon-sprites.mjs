// Les invocations de l'Osamodas réutilisent les sprites Dofus des monstres existants.
// Usage : node tools/summon-sprites.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updateManifest } from './manifest.mjs';

const SPRITES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/public/assets/dofus');

const ALIASES = {
  osa_tofu_meute: ['tofu', 1], osa_bouftou_tank: ['bouftou', 1], osa_dragonnet: ['osa_tofu', 1.2],
  // Fusions de l'Osamodas.
  osa_gros_tofu: ['tofu', 1.6], osa_mini_crocabulia: ['crocabulia', 0.8],
  osa_mini_tofu_royal: ['batofu', 1.1], osa_mini_bouftou_royal: ['bouftou_royal', 1.15],
};
/**
 * Images fixes (sans animation) à déposer dans client/public/assets/dofus/sprites/ : PNG transparent, créature tournée
 * vers la droite, pieds en bas au centre. Tant que le fichier manque, l'alias ci-dessus est gardé.
 */
const STATIC = {
  osa_chef_bouftou: { image: 'sprites/osa_chef_bouftou.png', origin: [0.5, 0.92], scale: 1 },
  osa_mini_tofu_royal: { image: 'sprites/osa_mini_tofu_royal.png', origin: [0.5, 0.95], scale: 0.47 },
};
const statics = Object.entries(STATIC).filter(([, def]) => fs.existsSync(path.join(SPRITES, def.image)));
updateManifest((manifest) => {
  for (const [id, [source, scale]] of Object.entries(ALIASES)) {
    const def = manifest.monsters?.[source];
    if (!def) throw new Error(`Sprite manquant : ${source}`);
    manifest.monsters[id] = { ...def, scale: (def.scale ?? 1) * scale };
  }
  for (const [id, def] of statics) manifest.monsters[id] = def;
});
console.log([...Object.keys(ALIASES), ...statics.map(([id]) => `${id} (image fixe)`)].join(', '));
