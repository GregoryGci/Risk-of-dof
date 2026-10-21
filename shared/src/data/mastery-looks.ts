/** Recolorations des tenues originales et signatures lumineuses de chaque classe. */
export interface MasteryLook {classId:string;skinId:string;name:string;auraName:string;color:number;accent:number;description:string}
export const MASTERY_LOOKS:Record<string,MasteryLook>=Object.fromEntries([
  ['cra','Sentinelle astrale','Vent d’émeraude',0x62dfbc,0xf5d58c,'Des voiles d’émeraude remontent autour du corps. Les courants s’entrelacent devant les jambes et derrière les épaules, avec quelques éclats dorés.'],
  ['iop','Chevalier solaire','Couronne du zénith',0xff964d,0xffe3a0,'Étoffes d’ivoire froid, détails dorés et cuirs d’ardoise. Une flamme solaire enveloppe le corps.'],
  ['eniripsa','Séraphine de rosée','Pétales de l’aurore',0xf29fda,0xffe3bf,'Des voiles rose nacré se déploient lentement, accompagnés d’une rosée lumineuse qui retombe autour du corps.'],
  ['sacrieur','Martyr écarlate','Serment de sang',0xed526f,0xffbf9b,'Des filets écarlates et des gouttes lumineuses suivent une pulsation sanguine autour du corps.'],
  ['sram','Souverain des ombres','Éclipse funeste',0xb58afa,0xd8e8ff,'Une fumée d’encre et de violet se tord lentement, bordée de reflets spectraux.'],
  ['sadida','Gardien sylvestre','Sève des anciens',0x8bd968,0xffda8b,'Des courants de sève serpentent en remontant, dans des tons de mousse, de vert tendre et d’ambre.'],
  ['ecaflip','Prince des arcanes','Main royale',0xf1b64d,0xffedbf,'Des courants d’ambre et de pourpre s’entrelacent, ponctués d’éclats changeants.'],
  ['feca','Égide céleste','Rempart des étoiles',0x7bb8ff,0xe2ddff,'Une membrane de verre bleu enveloppe le corps, parcourue de reflets protecteurs et d’ondes douces.'],
  ['osamodas','Pacte draconique','Souffle primordial',0x4fd9df,0xc3f6ff,'Un souffle turquoise se replie en torsades vives, avec un cœur de lumière glacée.'],
  ['enutrof','Roi des profondeurs','Trésor des abysses',0xe7bb58,0xffeab2,'Une poussière d’or et de bronze s’élève autour du corps, avec des grains lumineux et des reflets chauds.'],
  ['xelor','Horloger sidéral','Mécanique éternelle',0xa6a5ff,0xffd88f,'Des courants indigo et des arcs dorés tournent en sens opposés, à deux hauteurs autour du corps.'],
  ['pandawa','Empereur du lotus','Lotus impérial',0x63d4bb,0xffd795,'Une brume de jade se balance lentement, traversée de vapeur nacrée et de quelques gouttes cuivrées.'],
].map(([classId,name,auraName,color,accent,description])=>[classId,{classId,skinId:`${classId}__mastery`,name,auraName,color,accent,description} as MasteryLook]));
