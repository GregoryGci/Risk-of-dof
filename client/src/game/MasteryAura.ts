import Phaser from 'phaser';
import {MASTERY_LOOKS} from '@rod/shared';
import {FluidMasteryAura} from './FluidMasteryAura.ts';

/** Énergie autour du corps : halo de silhouette, voile lumineux et filaments ascendants. */
export class MasteryAura {
  private back:Phaser.GameObjects.Graphics;
  private front:Phaser.GameObjects.Graphics;
  private echoes:Phaser.GameObjects.Image[];
  private time=0;
  private height=0;
  private width=0;
  private textureKey='';
  private frameName:string|number='';
  private fluid?:FluidMasteryAura;
  constructor(scene:Phaser.Scene,readonly classId:string){
    this.back=scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.front=scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    if(MASTERY_LOOKS[classId]&&scene.game.renderer.type===Phaser.WEBGL)this.fluid=new FluidMasteryAura(scene,classId);
    this.echoes=Array.from({length:this.fluid?0:8},()=>scene.add.image(0,0,'__WHITE').setVisible(false).setBlendMode(Phaser.BlendModes.ADD));
  }
  update(dt:number,body:Phaser.GameObjects.Sprite,visible=true):void {
    this.time+=dt;
    const look=MASTERY_LOOKS[this.classId],back=this.back,front=this.front;
    back.clear().setVisible(visible);front.clear().setVisible(visible);
    this.fluid?.setVisible(visible&&Boolean(look));
    if(!visible||!look){for(const echo of this.echoes)echo.setVisible(false);return;}
    const frame=body.frame,sx=Math.abs(body.scaleX),sy=Math.abs(body.scaleY);
    const w=frame.cutWidth*sx,h=frame.cutHeight*sy;
    const left=body.x+((body.flipX?frame.realWidth-frame.x-frame.cutWidth:frame.x)-body.originX*frame.realWidth)*sx;
    const top=body.y+(frame.y-body.originY*frame.realHeight)*sy;
    const center=left+w/2,feet=top+h;
    const blend=this.height?1-Math.exp(-Math.max(0,dt)*12):1;
    this.height+=(Math.max(30,h)-this.height)*blend;this.width+=(Math.max(18,w)-this.width)*blend;
    const height=this.height,width=Math.max(18,Math.min(this.width,height*.9)),radius=width*.52+9,t=this.time;
    back.setPosition(center,feet).setDepth(body.depth-.03);
    front.setPosition(center,feet).setDepth(body.depth+.035);
    if(this.fluid){this.fluid.update(dt,body,center,feet,width,height);return;}
    // Les copies suivent exactement l'image, le miroir et l'origine du corps : seul le bord dépasse.
    const textureChanged=this.textureKey!==body.texture.key||this.frameName!==frame.name;
    if(textureChanged){this.textureKey=body.texture.key;this.frameName=frame.name;}
    this.echoes.forEach((echo,i)=>{
      if(textureChanged)echo.setTexture(body.texture.key,frame.name);
      const angle=i*Math.PI/4,spread=1.8+Math.sin(t*2.2)*.35;
      echo.setOrigin(body.originX,body.originY).setScale(body.scaleX,body.scaleY).setFlip(body.flipX,body.flipY)
        .setPosition(body.x+Math.cos(angle)*spread,body.y+Math.sin(angle)*spread)
        .setDepth(body.depth-.015-i*.0001).setTintFill(look.color).setAlpha(.105*body.alpha).setVisible(true);
    });
    // Un dégradé vertical, à hauteur du personnage, plutôt qu'un cercle au sol.
    for(let layer=12;layer>=1;layer--){
      const f=layer/12,pulse=1+Math.sin(t*1.9+f)*.035;
      back.fillStyle(look.color,.012*(1-f*.45)*body.alpha).fillEllipse(0,-height*.51,radius*(1+f*.7)*2*pulse,height*(.96+f*.35)*pulse);
    }
    // Le voile reste enveloppant ; chaque famille a son propre rythme et son contour.
    for(const side of[-1,1])for(let strand=0;strand<3;strand++){
      const points:{x:number;y:number}[]=[],phase=t*(.8+strand*.13)+strand*2.1+side;
      for(let j=0;j<=24;j++){
        const p=j/24,envelope=Math.sin(p*Math.PI);
        const frequency=this.classId==='sram'?6:this.classId==='iop'?18:this.classId==='pandawa'?7:11;
        const flutter=Math.sin(p*frequency-phase)*(this.classId==='iop'?3.8:2.3)*envelope;
        points.push({x:side*(radius*(.48+.52*envelope)+flutter+strand*1.8)*(1-.23*p),y:-height*(p*1.1)+Math.sin(phase+p*6)*1.6});
      }
      for(const [thickness,alpha]of[[5,.035],[2,.12],[.7,.3]]as const){
        back.lineStyle(thickness,look.color,alpha*body.alpha).beginPath().moveTo(points[0].x,points[0].y);
        for(const p of points.slice(1))back.lineTo(p.x,p.y);back.strokePath();
      }
    }
    this.signature(back,front,radius,height,t,look.color,look.accent,body.alpha);
  }
  /** Motifs dessinés dans l'espace du halo, jamais attachés à la tenue. */
  private signature(back:Phaser.GameObjects.Graphics,front:Phaser.GameObjects.Graphics,r:number,h:number,t:number,color:number,accent:number,opacity:number):void {
    for(let i=0;i<10;i++){
      const p=(t*(.2+(i%3)*.025)+i*.618)%1,angle=i*2.4+t*.65;
      const x=Math.cos(angle)*r*(.7+.3*Math.sin(p*Math.PI)),y=-p*h*1.18;
      const g=Math.sin(angle)>0?front:back,alpha=Math.sin(p*Math.PI)*.65*opacity;
      g.fillStyle(color,alpha*.1).fillCircle(x,y,4);
      g.lineStyle(.75,i%3?color:accent,alpha);
      switch(this.classId){
        case 'cra': // Flèches d'émeraude, tirées vers le haut.
          g.lineBetween(x,y+5,x,y-4).lineBetween(x-2.2,y-1,x,y-4).lineBetween(x+2.2,y-1,x,y-4);
          break;
        case 'iop': { // Langues de feu effilées, avec un cœur solaire.
          const flicker=Math.sin(t*7+i)*1.3;
          g.fillStyle(i%3?color:accent,alpha*.75).fillPoints([{x:x-2,y:y+3},{x:x+flicker,y:y-7},{x:x+2,y:y+3},{x,y:y+5}],true);
          g.fillStyle(accent,alpha).fillTriangle(x-1,y+3,x,y-2,x+1,y+3);break;
        }
        case 'eniripsa': // Pétales légers, ouverts autour d'un cœur de lumière.
          this.petal(g,x,y,2.4,4,angle,color,alpha*.65);
          g.fillStyle(accent,alpha).fillCircle(x,y,.7);break;
        case 'sacrieur': // Gouttes écarlates et liens qui battent au rythme du cœur.
          g.fillStyle(color,alpha).fillTriangle(x,y-4,x-1.8,y+1,x+1.8,y+1).fillCircle(x,y+1,1.8);
          break;
        case 'sram': // Croissants de fumée interrompus, qui se résorbent dans l'ombre.
          g.lineStyle(1.6,color,alpha*.5).beginPath().arc(x,y,3.8,angle,angle+Math.PI*1.2).strokePath();
          g.lineStyle(.65,accent,alpha*.6).beginPath().arc(x,y,3,angle+.2,angle+2).strokePath();break;
        case 'sadida':
          this.petal(g,x,y,2.1,4.5,angle,color,alpha*.8);
          g.lineStyle(.5,accent,alpha*.7).lineBetween(x-1,y+2,x+1,y-2);break;
        case 'ecaflip': { // Cartes en rotation, avec quatre enseignes distinctes.
          const points=[[-2.5,-3.5],[2.5,-3.5],[2.5,3.5],[-2.5,3.5]].map(([a,b])=>({x:x+a*Math.cos(angle)-b*Math.sin(angle),y:y+a*Math.sin(angle)+b*Math.cos(angle)}));
          g.fillStyle(color,alpha*.12).fillPoints(points,true).strokePoints(points,true);
          if(i%4===0)g.fillStyle(accent,alpha).fillTriangle(x,y-1.7,x-1.3,y,x+1.3,y).fillTriangle(x,y+1.7,x-1.3,y,x+1.3,y);
          else if(i%4===1)g.fillStyle(accent,alpha).fillCircle(x-.6,y-.4,.9).fillCircle(x+.6,y-.4,.9).fillTriangle(x-1.4,y-.2,x+1.4,y-.2,x,y+1.4);
          else if(i%4===2)g.fillStyle(accent,alpha).fillCircle(x,y-.6,.8).fillCircle(x-.7,y+.3,.8).fillCircle(x+.7,y+.3,.8);
          else g.fillStyle(accent,alpha).fillTriangle(x,y-1.5,x-1.3,y+.5,x+1.3,y+.5).fillRect(x-.4,y+.3,.8,1.4);
          break;
        }
        case 'feca': // Petites facettes de barrière protectrice.
          this.polygon(g,x,y,3.6,6,Math.PI/6,color,alpha);break;
        case 'osamodas': // Écailles et marques de griffes dans le souffle draconique.
          g.beginPath().moveTo(x-2.6,y-2).lineTo(x,y+3).lineTo(x+2.6,y-2).strokePath();
          g.lineStyle(.55,accent,alpha*.6).lineBetween(x-1,y-3,x-1.5,y).lineBetween(x+1,y-3,x+1.5,y);break;
        case 'enutrof': // Pièces qui pivotent sur leur tranche.
          g.lineStyle(.9,accent,alpha).strokeEllipse(x,y,2+Math.abs(Math.cos(t*2+i))*4,6);
          g.lineStyle(.6,color,alpha*.8).lineBetween(x,y-1.6,x,y+1.6);break;
        case 'xelor':
          this.gear(g,x,y,3.3,angle,accent,alpha*.85);break;
        case 'pandawa':
          this.petal(g,x,y,2.2,3.7,Math.sin(t+i)*.9,color,alpha*.6);
          g.lineStyle(.7,accent,alpha*.6).beginPath().arc(x,y+1,3,Math.PI*.15,Math.PI*.85).strokePath();break;
      }
    }
    // Grandes signatures latérales : lisibles même à la taille normale en combat.
    for(const side of[-1,1]){
      const x=side*(r+1),y=-h*.54;
      back.lineStyle(.9,color,.34*opacity);
      switch(this.classId){
        case 'cra':
          back.beginPath().arc(side*r*.55,-h*.54,h*.44,side<0?Math.PI*.64:-Math.PI*.36,side<0?Math.PI*1.36:Math.PI*.36).strokePath();
          for(let k=0;k<3;k++)back.lineBetween(x-2,-h*(.3+k*.18)+3,x,-h*(.3+k*.18)-1).lineBetween(x+2,-h*(.3+k*.18)+3,x,-h*(.3+k*.18)-1);
          break;
        case 'iop':
          for(let k=0;k<4;k++)this.flame(back,x,-h*(.14+k*.23),3.5,17,t*4+k+side,color,.2*opacity);
          break;
        case 'eniripsa':
          for(let k=0;k<3;k++)this.petal(back,x+side*(k%2)*3,-h*(.3+k*.23),3,7,side*(.4+Math.sin(t+k)*.2),color,.22*opacity);
          break;
        case 'sacrieur': {
          const beat=Math.pow(Math.max(0,Math.sin(t*3.8)),4);
          for(let k=0;k<7;k++)back.lineStyle(.9,accent,(.14+beat*.24)*opacity).strokeEllipse(x+Math.sin(k*.9+t)*2,-h*(.12+k*.14),4,7);
          break;
        }
        case 'sram':
          for(let k=0;k<3;k++)back.lineStyle(3-k*.7,color,.1*opacity).beginPath().arc(x-side*3,-h*(.3+k*.24),7+Math.sin(t+k)*2,side<0?1.2:4.2,side<0?4.3:7.3).strokePath();
          break;
        case 'sadida':
          for(let k=0;k<5;k++)this.petal(back,x+Math.sin(k+t*.5)*3,-h*(.14+k*.19),2.8,6,side*(.6+k*.1),k%2?accent:color,.28*opacity);
          break;
        case 'ecaflip':
          this.polygon(back,x,y,5.5,4,t*.35,color,.28*opacity);break;
        case 'feca':
          for(let k=0;k<3;k++)this.polygon(back,x+side*(k%2)*3,-h*(.26+k*.26),7.5,6,Math.PI/6,color,(.18+Math.sin(t*2+k)*.06)*opacity);
          break;
        case 'osamodas':
          for(let k=0;k<3;k++)back.lineStyle(1,accent,.24*opacity).beginPath().moveTo(x-side*3,-h*(.2+k*.27)).lineTo(x+side*4,-h*(.3+k*.27)).lineTo(x+side*2,-h*(.38+k*.27)).strokePath();
          break;
        case 'enutrof':
          for(let k=0;k<3;k++)back.lineStyle(1,accent,.3*opacity).strokeEllipse(x,-h*(.25+k*.28),5+Math.abs(Math.cos(t+k))*5,10);
          break;
        case 'xelor':
          this.gear(back,x,-h*.32,7,side*t*.45,accent,.32*opacity);
          this.gear(back,x-side*2,-h*.84,5,-side*t*.6,color,.38*opacity);break;
        case 'pandawa':
          for(let k=0;k<3;k++)back.lineStyle(1.1,color,.22*opacity).beginPath().arc(x-side*4,-h*(.24+k*.27),8+Math.sin(t*1.5+k)*2,side<0?2:4,side<0?4.3:6.3).strokePath();
          break;
      }
    }
  }
  private petal(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,angle:number,color:number,alpha:number):void {
    const points=Array.from({length:12},(_,j)=>{const a=j*Math.PI/6,px=Math.sin(a)*w,py=Math.cos(a)*h;return {x:x+px*Math.cos(angle)-py*Math.sin(angle),y:y+px*Math.sin(angle)+py*Math.cos(angle)};});
    g.fillStyle(color,alpha).fillPoints(points,true);
  }
  private flame(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,phase:number,color:number,alpha:number):void {
    const points=[];
    for(const side of[-1,1])for(let j=0;j<=12;j++){
      const p=side<0?j/12:1-j/12;
      points.push({x:x+Math.sin(p*5-phase)*w*.6+side*Math.sin(p*Math.PI)*w*(1-p*.65),y:y-p*h});
    }
    g.fillStyle(color,alpha).fillPoints(points,true);
  }
  private polygon(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,n:number,angle:number,color:number,alpha:number):void {
    const points=Array.from({length:n},(_,j)=>({x:x+Math.cos(angle+j*Math.PI*2/n)*r,y:y+Math.sin(angle+j*Math.PI*2/n)*r}));
    g.fillStyle(color,alpha*.1).fillPoints(points,true).lineStyle(.85,color,alpha).strokePoints(points,true);
  }
  private gear(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,angle:number,color:number,alpha:number):void {
    g.lineStyle(.8,color,alpha).strokeCircle(x,y,r*.7);
    for(let k=0;k<8;k++){const a=angle+k*Math.PI/4;g.lineBetween(x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7,x+Math.cos(a)*r,y+Math.sin(a)*r);}
    g.lineStyle(.65,color,alpha*.8).lineBetween(x,y,x+Math.cos(angle)*r*.5,y+Math.sin(angle)*r*.5);
  }
  destroy():void {this.fluid?.destroy();this.back.destroy();this.front.destroy();for(const echo of this.echoes)echo.destroy();}
}
