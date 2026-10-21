import Phaser from 'phaser';
import {AURA_MATERIALS,type AuraMaterial} from './masteryAuraMaterials.ts';

const PIPELINE='MasteryFluidMaterial';
const TEXTURE='mastery-aura-noise';

// Deux couches d'un même volume : les courants passent derrière le buste puis devant
// les jambes. Le bruit déforme une matière continue, sans dessiner de pictogrammes.
const FRAGMENT=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 outTexCoord;
varying vec4 outTint;
uniform sampler2D uMainSampler;
uniform float uClock;
uniform float uFront;
uniform float uWidth;
uniform float uMotion;
uniform int uKind;
uniform vec4 uFlow;
uniform float uMotes;
uniform vec3 uVeil;
uniform vec3 uRim;
uniform vec3 uCore;
uniform vec3 uGlint;

#define WIND 0
#define FIRE 1
#define GRACE 2
#define BLOOD 3
#define SHADOW 4
#define SAP 5
#define FORTUNE 6
#define BARRIER 7
#define BREATH 8
#define DUST 9
#define TIME 10
#define MIST 11

float noise(vec2 p){
  return texture2D(uMainSampler,(fract(p/16.)*126.+1.)/128.).r;
}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.07+17.3)*.28+noise(p*4.13+9.7)*.15;}
float bell(float x,float width){return exp(-x*x/(width*width));}

void main(){
  vec2 p=vec2((outTexCoord.x-.5)*1.65,(1.-outTexCoord.y)*1.58-.14);
  float t=uClock*uFlow.x;
  float y=p.y;
  float softness=uFlow.y,curl=uFlow.z;
  float breath=1.+sin(t*1.65)*.025;
  float radius=(uWidth*.48+.075+.075*sin(clamp(y,0.,1.)*3.14159))*breath;
  float pulse=1.;
  if(uKind==FIRE)radius*=.82+.20*smoothstep(.03,.72,y);
  if(uKind==GRACE)radius+=sin(y*2.8+.3)*.025;
  if(uKind==BLOOD){pulse=.88+pow(max(0.,sin(uClock*3.1)),4.)*.21;radius*=.97+pulse*.03;}
  if(uKind==SHADOW)radius+=sin(y*5.3-t*.7)*.025;
  if(uKind==SAP)radius+=sin(y*8.2+t*.4)*.025;
  if(uKind==BREATH)radius+=sin(y*5.7-t*.9)*.032;
  if(uKind==MIST)radius+=sin(y*3.1-t*.5)*.042;
  // Déformation lente de la surface, puis détails fins advectés vers le haut.
  vec2 flow=vec2(p.x*4.8,y*2.7-t*.36);
  float warp=fbm(flow+vec2(fbm(flow+8.7),fbm(flow+21.2))*.8);
  float grain=fbm(vec2(p.x*16.+warp*2.,y*8.-t*1.4));
  float envelope=smoothstep(-.03,.13,y)*(1.-smoothstep(.83,1.29,y));
  float rim=abs(p.x)-radius-(warp-.5)*.13*curl;
  float mist=bell(rim,.115*softness)*envelope*(.1+grain*.24);
  float silk=bell(rim,.055*softness)*envelope*pow(smoothstep(.2,.85,grain),1.6)*.48;
  if(uKind==FIRE)silk*=.7+pow(grain,2.)*1.5;
  if(uKind==SHADOW){mist*=1.7;silk*=.52;}
  if(uKind==DUST){mist*=1.1;silk*=.8;}
  if(uKind==TIME){mist*=.9;silk*=.65;}
  if(uKind==MIST){mist*=1.35;silk*=.55;}
  vec3 emerald=uVeil;
  vec3 jade=uRim;
  vec3 pearl=uCore;
  vec3 gold=uGlint;
  if(uKind==FORTUNE)jade=mix(jade,gold,smoothstep(-.14,.14,p.x+sin(t*.7)*.12)*.65);
  if(uKind==FIRE)jade=mix(pearl,jade,smoothstep(.02,.65,y));
  vec3 light=(emerald*mist+jade*silk)*(1.-uFront);
  float coverage=(mist+silk)*(1.-uFront);

  // Rubans effilés : quelques courants complets plutôt qu'une multitude de traits.
  for(int i=0;i<4;i++){
    float k=float(i),side=mod(k,2.)*2.-1.;
    float head=fract(t*(.105+k*.009)+k*.271)*1.7-.1;
    float local=(head-y)/(.57+k*.045);
    float life=smoothstep(0.,.16,local)*(1.-smoothstep(.62,1.,local))*smoothstep(.015,.13,y)*(1.-smoothstep(1.02,1.34,y));
    float curve=side*(radius+sin(y*(uKind==SAP?8.4:5.6)-t*.85+k*2.7)*.048*curl+(warp-.5)*.05*curl);
    float taper=max(.12,sin(clamp(local,0.,1.)*3.14159));
    float d=p.x-curve;
    float feather=bell(d,(.045*taper+.004)*softness)*life*(.55+grain*.6)*uFlow.w;
    float core=bell(d,(.0065*taper+.0018)*min(1.3,softness))*life*uFlow.w;
    float tip=bell(local-.15,.17);
    float layer=mix(1.,.13,uFront);
    light+=(jade*feather*.42+mix(pearl,gold,tip*.5)*core*.45)*layer;
    coverage+=(feather*.42+core*.45)*layer;
  }

  // Une torsade elliptique change réellement de profondeur autour du personnage.
  for(int i=0;i<2;i++){
    float k=float(i),winding=uKind==BREATH?8.3:uKind==SAP?7.5:6.2;
    float angle=y*winding-t*.58+k*3.14159;
    float orbit=sin(angle)*(radius+.018);
    float face=cos(angle);
    float layer=uFront>.5?smoothstep(-.1,.4,face):1.-smoothstep(-.4,.1,face);
    float fade=smoothstep(.02,.18,y)*(1.-smoothstep(.53,.84,y));
    float d=p.x-orbit;
    float ribbon=(bell(d,.024*softness)*.16+bell(d,.0045)*.28)*fade*layer;
    if(uKind==FIRE||uKind==DUST)ribbon*=.35;
    if(uKind==BARRIER||uKind==TIME)ribbon*=.4;
    light+=mix(jade,pearl,.36)*ribbon;
    coverage+=ribbon;
  }

  // Poussière portée par les courants : taille, vitesse et éclat sont indépendants.
  for(int i=0;i<24;i++){
    if(float(i)>=uMotes)break;
    float k=float(i),seed=fract(k*.618033989+.193);
    float age=fract(t*(.105+seed*.065)+seed*11.);
    float falling=uKind==BLOOD||uKind==GRACE||uKind==MIST?1.:0.;
    float py=mix(age,1.-age,falling)*1.42-.04;
    float px=(mod(k,2.)*2.-1.)*(radius+.015+seed*.12)+sin(age*5.5+k)*.035;
    float life=sin(age*3.14159);
    float size=uKind==DUST?2.1:uKind==FIRE?1.15:1.;
    float dotLight=bell(length((p-vec2(px,py))*vec2(1.,uKind==BLOOD?.55:.82)),(.0045+seed*.002)*size)*life;
    float tail=bell(p.x-px,.0027)*bell(p.y-py+.018,.026)*life*.14;
    float gleam=bell(length(p-vec2(px,py)),.022)*life*.06;
    float layer=mod(k,3.)<1.?uFront:1.-uFront;
    light+=mix(pearl,gold,step(.74,seed))*(dotLight*.7+tail+gleam)*layer;
    coverage+=(dotLight*.7+tail+gleam)*layer;
  }
  // Le Féca contient une membrane de verre vivante, sans glyphes ni anneaux au sol.
  if(uKind==BARRIER){
    float shell=length(vec2(p.x/(radius+.045),(y-.55)/.67))-1.;
    float field=(bell(shell,.1)*.08+bell(shell,.015)*.28)*(1.-smoothstep(1.21,1.32,y));
    float caustic=.6+.4*sin(y*13.-t*1.4+warp*3.);
    float layer=uFront>.5?.24:1.;
    light+=(jade*field*.7+pearl*field*.3*caustic)*layer;coverage+=field*layer;
  }
  // Le Xélor replie les courants en arcs à deux hauteurs et deux sens de rotation.
  if(uKind==TIME)for(int i=0;i<2;i++){
    float k=float(i),cy=.3+k*.43;
    vec2 q=vec2(p.x/(radius+.05),(y-cy-p.x*.22)/.11);
    float a=atan(q.y,q.x),phase=a-t*(k<.5?.65:-.48)+k*2.;
    float arc=pow(.5+.5*cos(phase),5.);
    float layer=uFront>.5?smoothstep(-.1,.2,q.y):1.-smoothstep(-.2,.1,q.y);
    float trail=(bell(length(q)-1.,.065)*.4+bell(length(q)-1.,.17)*.09)*arc*layer;
    light+=mix(jade,gold,arc*.75)*trail;coverage+=trail;
  }
  // Reflet diffus au contact du sol, sans cercle ni bord dur.
  float contact=bell(p.x,.28)*bell(y+.005,.026)*.11*(1.-uFront);
  light+=emerald*contact;coverage+=contact;
  light*=pulse;coverage*=pulse;
  float edge=smoothstep(.02,.11,outTexCoord.x)*(1.-smoothstep(.89,.98,outTexCoord.x));
  float opacity=outTint.a*edge*(.92+uMotion*.08);
  gl_FragColor=vec4(light*opacity,min(.82,coverage)*opacity);
}`;

interface WindData {clock:number;front:number;width:number;motion:number;material:AuraMaterial}
class FluidAuraPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game:Phaser.Game){super({game,fragShader:FRAGMENT});}
  onBind(object?:Phaser.GameObjects.GameObject):void {
    if(!object)return;
    // Les uniformes appartiennent à chaque personnage, même si le pipeline est partagé.
    this.flush();
    const data=(object as Phaser.GameObjects.Image).pipelineData as WindData;
    this.set1f('uClock',data.clock).set1f('uFront',data.front).set1f('uWidth',data.width).set1f('uMotion',data.motion);
    const m=data.material;
    this.set1i('uKind',m.kind).set4f('uFlow',m.speed,m.softness,m.curl,m.ribbon).set1f('uMotes',m.motes);
    this.set3f('uVeil',...m.veil).set3f('uRim',...m.rim).set3f('uCore',...m.core).set3f('uGlint',...m.glint);
  }
}

/** Matières fluides déclinées depuis le vent d'émeraude du Crâ. */
export class FluidMasteryAura {
  readonly back:Phaser.GameObjects.Image;
  readonly front:Phaser.GameObjects.Image;
  private clock=0;
  private lastX?:number;
  private lean=0;
  private motion=0;
  constructor(scene:Phaser.Scene,classId:string){
    const renderer=scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if(!renderer.pipelines.has(PIPELINE))renderer.pipelines.add(PIPELINE,new FluidAuraPipeline(scene.game));
    if(!scene.textures.exists(TEXTURE)){
      // Le champ de bruit périodique est calculé une seule fois. Le GPU interpole
      // ensuite la texture : pas de dizaines de sinus recalculés par pixel et par image.
      const texture=scene.textures.createCanvas(TEXTURE,128,128)!,pixels=texture.context.createImageData(128,128);
      const hash=(x:number,y:number)=>{const v=Math.sin(((x%16+16)%16)*127.1+((y%16+16)%16)*311.7)*43758.5453;return v-Math.floor(v);};
      const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const px=(x-.5)/126*16,py=(y-.5)/126*16,ix=Math.floor(px),iy=Math.floor(py);
        const fx=px-ix,fy=py-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
        const n=Math.round(mix(mix(hash(ix,iy),hash(ix+1,iy),sx),mix(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy)*255),p=(y*128+x)*4;
        pixels.data[p]=n;pixels.data[p+1]=n;pixels.data[p+2]=n;pixels.data[p+3]=255;
      }
      texture.context.putImageData(pixels,0,0);texture.setFilter(Phaser.Textures.FilterMode.LINEAR);texture.refresh();
    }
    const make=(front:number)=>scene.add.image(0,0,TEXTURE).setBlendMode(Phaser.BlendModes.NORMAL)
      .setPipeline(PIPELINE,{clock:0,front,width:.5,motion:0,material:AURA_MATERIALS[classId]},false);
    this.back=make(0);this.front=make(1);
  }
  setVisible(visible:boolean):void {this.back.setVisible(visible);this.front.setVisible(visible);}
  update(dt:number,body:Phaser.GameObjects.Sprite,center:number,feet:number,width:number,height:number):void {
    this.clock+=Math.max(0,dt);
    const response=1-Math.exp(-Math.max(0,dt)*6);
    const dx=this.lastX===undefined?0:center-this.lastX;this.lastX=center;
    const speed=dt>0?Math.abs(dx)/dt:0;
    this.motion+=(Math.min(1,speed/65)-this.motion)*response;
    this.lean+=(Phaser.Math.Clamp(-dx*.08,-.09,.09)-this.lean)*response;
    for(const [image,front]of [[this.back,0],[this.front,1]]as const){
      const data=image.pipelineData as WindData;
      data.clock=this.clock;data.width=Phaser.Math.Clamp(width/height,.32,.7);data.motion=this.motion;
      image.setPosition(center,feet-height*.65).setDisplaySize(height*1.65,height*1.58)
        .setRotation(this.lean).setDepth(body.depth+(front?.036:-.036)).setAlpha(body.alpha);
    }
  }
  destroy():void {this.back.destroy();this.front.destroy();}
}
