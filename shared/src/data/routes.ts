export const ROUTES = {
  normal: {id:'normal',name:'Voie du voyageur',icon:'◇',risk:'Difficulté habituelle',reward:'Un choix de bénédiction à la victoire',spawn:1,kamas:1,bossHp:1,bossDamage:1,boons:1},
  hunt: {id:'hunt',name:'Chasse sauvage',icon:'⚔',risk:'30 % de renforts supplémentaires',reward:'+30 % de kamas sur les ennemis',spawn:1.3,kamas:1.3,bossHp:1,bossDamage:1,boons:1},
  ordeal: {id:'ordeal',name:'Serment du gardien',icon:'✦',risk:'Gardien : +35 % PV, +15 % dégâts',reward:'Deux choix de bénédiction à la victoire',spawn:1,kamas:1,bossHp:1.35,bossDamage:1.15,boons:2},
} as const;
export type RouteId=keyof typeof ROUTES;
export function getRoute(id:string){return Object.hasOwn(ROUTES,id)?ROUTES[id as RouteId]:ROUTES.normal;}
/** Majorité, puis vote de l'hôte en cas d'égalité ; ordre stable s'il est absent. */
export function resolveRoute(votes:string[],hostVote:string):RouteId {
  const ids=Object.keys(ROUTES) as RouteId[];
  const counts=ids.map(id=>({id,count:votes.filter(v=>getRoute(v).id===id).length}));
  const maximum=Math.max(0,...counts.map(c=>c.count));
  const tied=counts.filter(c=>c.count===maximum).map(c=>c.id);
  return tied.includes(hostVote as RouteId)?hostVote as RouteId:tied[0];
}
