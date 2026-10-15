// Les invocations de l'Osamodas réutilisent les sprites Dofus des monstres existants.
// Usage : node tools/summon-sprites.mjs
import { updateManifest } from './manifest.mjs';

const ALIASES = { osa_tofu_meute: ['tofu', 1], osa_bouftou_tank: ['bouftou', 1], osa_dragonnet: ['osa_tofu', 1.2] };
updateManifest((manifest) => {
  for (const [id, [source, scale]] of Object.entries(ALIASES)) {
    const def = manifest.monsters?.[source];
    if (!def) throw new Error(`Sprite manquant : ${source}`);
    manifest.monsters[id] = { ...def, scale: (def.scale ?? 1) * scale };
  }
});
console.log(Object.keys(ALIASES).join(', '));
