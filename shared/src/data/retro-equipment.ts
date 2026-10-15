import source from './retro-catalogue.json';
import type {EquipmentBase} from './equipment.ts';
import type {EquipmentSet} from './equipment-sets.ts';
/** Données 1.29 normalisées, sans dépendance au cache local au lancement du jeu. */
export const RETRO_SETS:EquipmentSet[]=source.map(s=>({id:s.id,name:s.name,level:s.level,zone:s.zone,members:s.members}));
export const RETRO_ITEMS:Record<string,EquipmentBase>=Object.fromEntries(source.flatMap(s=>s.items.map(i=>[i.id,{name:i.name,kind:i.kind,tier:i.tier,level:i.level,zone:i.zone,set:i.set,stats:i.stats,iconMissing:!i.icon} as EquipmentBase])));
