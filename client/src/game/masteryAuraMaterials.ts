type RGB=readonly[number,number,number];
export interface AuraMaterial {
  kind:number;
  /** Voile diffus, matière lumineuse, cœur nacré, éclats. */
  veil:RGB;rim:RGB;core:RGB;glint:RGB;
  speed:number;softness:number;curl:number;ribbon:number;motes:number;
}

/** Identités de matière ; le vent du Crâ reste la référence validée. */
export const AURA_MATERIALS:Record<string,AuraMaterial>={
 cra:{kind:0,veil:[.055,.61,.42],rim:[.17,.94,.67],core:[.69,1,.87],glint:[1,.78,.37],speed:1,softness:1,curl:1,ribbon:1,motes:13},
 iop:{kind:1,veil:[.63,.15,.025],rim:[1,.45,.075],core:[1,.91,.61],glint:[1,.69,.21],speed:1.45,softness:.85,curl:1.65,ribbon:1.18,motes:17},
 eniripsa:{kind:2,veil:[.42,.16,.38],rim:[.94,.51,.77],core:[1,.88,.94],glint:[1,.85,.61],speed:.64,softness:1.5,curl:1.25,ribbon:.75,motes:10},
 sacrieur:{kind:3,veil:[.35,.015,.055],rim:[.86,.075,.22],core:[1,.61,.59],glint:[1,.39,.33],speed:.9,softness:.8,curl:.8,ribbon:1.25,motes:12},
 sram:{kind:4,veil:[.075,.035,.13],rim:[.46,.29,.77],core:[.76,.71,1],glint:[.7,.75,1],speed:.59,softness:1.8,curl:1.8,ribbon:.55,motes:7},
 sadida:{kind:5,veil:[.14,.3,.055],rim:[.43,.73,.22],core:[.84,.98,.52],glint:[1,.77,.32],speed:.55,softness:1.05,curl:1.7,ribbon:.85,motes:11},
 ecaflip:{kind:6,veil:[.42,.18,.065],rim:[1,.66,.19],core:[1,.94,.7],glint:[.84,.53,.94],speed:.95,softness:1.05,curl:1.2,ribbon:.85,motes:16},
 feca:{kind:7,veil:[.085,.23,.42],rim:[.34,.65,.97],core:[.79,.91,1],glint:[.84,.83,1],speed:.48,softness:.85,curl:.4,ribbon:.25,motes:8},
 osamodas:{kind:8,veil:[.045,.26,.43],rim:[.11,.77,.9],core:[.64,.98,1],glint:[.51,.74,1],speed:1.17,softness:1.05,curl:1.9,ribbon:1.05,motes:12},
 enutrof:{kind:9,veil:[.39,.22,.045],rim:[.85,.59,.16],core:[1,.9,.57],glint:[1,.94,.76],speed:.72,softness:1.25,curl:.65,ribbon:.28,motes:24},
 xelor:{kind:10,veil:[.17,.14,.39],rim:[.49,.47,.95],core:[.87,.87,1],glint:[1,.79,.36],speed:.8,softness:1.1,curl:.7,ribbon:.35,motes:14},
 pandawa:{kind:11,veil:[.1,.3,.25],rim:[.34,.76,.64],core:[.83,.97,.84],glint:[1,.76,.49],speed:.47,softness:1.85,curl:1.35,ribbon:.58,motes:10},
};
