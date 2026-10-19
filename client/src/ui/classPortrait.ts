import {CLASSES,DEFAULT_CLASS} from '@rod/shared';

// Atlas original du menu, quatre colonnes et trois lignes. L'ordre du registre peut changer.
const CELLS:Record<string,number>={cra:0,iop:1,eniripsa:2,sacrieur:3,sram:4,sadida:5,ecaflip:6,feca:7,osamodas:8,enutrof:9,xelor:10,pandawa:11};
export function classPortraitStyle(classId:string):string {
  const cell=Object.hasOwn(CELLS,classId)?CELLS[classId]:0,row=Math.floor(cell/4);
  // Les bottes de la rangée précédente dépassent de quelques pixels dans l'atlas original.
  return `--cell-x:${cell%4/3*100}%;--cell-y:${row/2*100}%;--portrait-trim:${row===0?0:row===1?2.2:3}%`;
}

/** Vue du même atlas que le carrousel ; les deux thèmes historiques gardent leur portrait Retro. */
export function classPortrait(classId:string):string {
  const id=Object.hasOwn(CLASSES,classId)?classId:DEFAULT_CLASS;
  return `<span class="class-portrait" aria-hidden="true" style="${classPortraitStyle(id)}"><img class="portrait-retro" src="assets/dofus/portraits/${id}.png" alt=""><span class="class-portrait-art"></span></span>`;
}
