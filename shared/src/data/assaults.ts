/** Un budget identique, quatre formations : la pression vient aussi des angles. */
export function assaultPlan(wave:number,stage:number){
  if(stage===1&&wave<=2)return{kind:'pursuit',name:'Premiers contacts',groups:1,fast:true,ranged:false};
  switch((wave-1)%4){
    case 0:return{kind:'pursuit',name:'Poursuite',groups:1,fast:true,ranged:false};
    case 1:return{kind:'crossfire',name:'Tirs croisés',groups:2,fast:false,ranged:true};
    case 2:return{kind:'swarm',name:'Horde',groups:1,fast:false,ranged:false};
    default:return{kind:'flanks',name:'Tenaille',groups:2,fast:false,ranged:false};
  }
}
