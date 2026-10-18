// Effets décoratifs de l'accueil, indépendants de Phaser et de la simulation.
const AMBIENCE = {
  image: {width: 1672, height: 941},
  // Coordonnées dans sanctuary-infernal.jpg : suit le cadrage CSS center / cover.
  portal: {x: 1235, y: 475, radiusX: 280, radiusY: 320},
  maxEmbers: 72,
  pixelsPerEmber: 24000,
  portalMotes: 16,
  maxPixelRatio: 1.5,
  maxCanvasPixels: 2_500_000,
  ink: {maxMotes: 42, pixelsPerMote: 36000, speed: .6},
};
const instances = new WeakMap<HTMLElement, () => void>();
interface Ember {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; age: number; phase: number;
}

// Halos mis en cache : aucun flou CSS ni création de gradient par particule/frame.
function lightSprite(color: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext('2d')!;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#fff5df');
  glow.addColorStop(.12, color);
  glow.addColorStop(.4, color + '60');
  glow.addColorStop(1, color + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return sprite;
}

function inkWashSprite(): HTMLCanvasElement {
  const sprite=document.createElement('canvas');sprite.width=sprite.height=128;
  const ctx=sprite.getContext('2d')!;
  const wash=ctx.createRadialGradient(64,64,0,64,64,64);
  wash.addColorStop(0,'rgba(191,190,172,.15)');
  wash.addColorStop(.45,'rgba(164,167,148,.065)');
  wash.addColorStop(1,'rgba(164,167,148,0)');
  ctx.fillStyle=wash;ctx.fillRect(0,0,128,128);return sprite;
}

/** Renvoie le nettoyage complet (notamment pour le rechargement à chaud). */
export function startHomeAmbience(menu: HTMLElement): () => void {
  instances.get(menu)?.();
  const canvas = document.createElement('canvas');
  canvas.className = 'home-ambience';
  canvas.setAttribute('aria-hidden', 'true');
  menu.insertBefore(canvas, menu.querySelector('.home-grain'));
  const ctx = canvas.getContext('2d');
  if (!ctx) {canvas.remove(); return () => {};}
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fire = lightSprite('#ff803b'), magic = lightSprite('#65e8ed'), dust = lightSprite('#b8ad99');
  const wash=inkWashSprite();
  const embers: Ember[] = [];
  let width = 0, height = 0, scale = 1, offsetX = 0, offsetY = 0;
  let frameId = 0, last = 0, elapsed = 0, disposed = false;
  let infernal = document.body.classList.contains('underworld');
  let legends = document.body.classList.contains('legends');
  let wasActive:boolean|undefined;
  let pointerX=.5,pointerY=.5,lightX=.5,lightY=.5;
  const move=(event:PointerEvent)=>{
    if(!legends||document.hidden||menu.classList.contains('hidden'))return;
    pointerX=event.clientX/Math.max(1,width);pointerY=event.clientY/Math.max(1,height);
  };

  function resetEmber(ember: Ember, scattered = false): void {
    ember.x = width * (legends ? .1+Math.random()*.85 : .35+Math.random()*.65);
    ember.y = scattered||legends ? Math.random() * height : height + 12;
    ember.vx = (Math.random() - .5) * 12;
    ember.vy = -(18 + Math.random() * 38);
    ember.size = .7 + Math.random() * 1.5;
    ember.life = 7 + Math.random() * 7;
    ember.age = scattered ? Math.random() * ember.life : 0;
    ember.phase = Math.random() * Math.PI * 2;
  }
  function resize(): void {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, AMBIENCE.maxPixelRatio,
      Math.sqrt(AMBIENCE.maxCanvasPixels / Math.max(1, width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    ctx!.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    scale = Math.max(width / AMBIENCE.image.width, height / AMBIENCE.image.height);
    offsetX = (width - AMBIENCE.image.width * scale) / 2;
    offsetY = (height - AMBIENCE.image.height * scale) / 2;
    // Réduit aussi la population après un passage d'un grand écran au mobile.
    const count = Math.min(legends ? AMBIENCE.ink.maxMotes : AMBIENCE.maxEmbers, Math.round(width * height / (legends ? AMBIENCE.ink.pixelsPerMote : AMBIENCE.pixelsPerEmber)));
    embers.length = Math.min(embers.length, count);
    while (embers.length < count) {
      const ember = {} as Ember;
      resetEmber(ember, true); embers.push(ember);
    }
    for (const ember of embers) resetEmber(ember, true);
  }
  function drawPortal(time: number): void {
    const portal = AMBIENCE.portal;
    const x = offsetX + portal.x * scale, y = offsetY + portal.y * scale;
    const rx = portal.radiusX * scale, ry = portal.radiusY * scale;
    if (x + rx < 0 || x - rx > width) return;
    const pulse = .5 + .5 * Math.sin(time * .75);
    ctx!.save();
    ctx!.translate(x, y);
    // Lueur elliptique : pas de déplacement ni de déformation de l'illustration.
    ctx!.globalAlpha = .055 + pulse * .035;
    ctx!.drawImage(magic, -rx * 1.25, -ry * 1.25, rx * 2.5, ry * 2.5);
    // Énergie sur le bord gauche et supérieur, dégagé par le personnage.
    for (let i = 0; i < AMBIENCE.portalMotes; i++) {
      const progress = (i / AMBIENCE.portalMotes + time * .045) % 1;
      const angle = 2.35 + progress * 2.5;
      const orbit = .94 + Math.sin(time + i * 2.4) * .025;
      const px = Math.cos(angle) * rx * orbit, py = Math.sin(angle) * ry * orbit;
      const fade = Math.sin(progress * Math.PI);
      const size = (1.2 + (i % 3) * .45) * Math.min(scale, 1.5);
      ctx!.globalAlpha = fade * .3;
      ctx!.strokeStyle = '#85eff2'; ctx!.lineWidth = Math.max(.5, scale * .65);
      ctx!.beginPath();
      ctx!.ellipse(0, 0, rx * orbit, ry * orbit, 0, angle - .035, angle);
      ctx!.stroke();
      ctx!.globalAlpha = fade * (.55 + pulse * .2);
      ctx!.drawImage(magic, px - size * 4, py - size * 4, size * 8, size * 8);
    }
    ctx!.restore();
  }
  function frame(now: number): void {
    frameId = 0;
    const dt = Math.min(.05, (now - last) / 1000);
    last = now; elapsed += dt;
    ctx!.clearRect(0, 0, width, height);
    ctx!.globalCompositeOperation = 'lighter';
    if (infernal) drawPortal(elapsed);
    if(legends){
      const follow=1-Math.exp(-dt*3);
      lightX+=(pointerX-lightX)*follow;lightY+=(pointerY-lightY)*follow;
      // Lavis en mouvement au ras du sol : l'illustration reste entière et immobile.
      for(let i=0;i<3;i++){
        const x=width*(.2+i*.32+Math.sin(elapsed*.12+i*2)*.065),y=height*(.87+Math.sin(elapsed*.16+i)*.04);
        ctx!.globalAlpha=.32+.08*Math.sin(elapsed*.25+i);
        ctx!.drawImage(wash,x-width*.32,y-height*.1,width*.64,height*.2);
      }
      ctx!.globalAlpha=.2;
      ctx!.drawImage(wash,width*lightX-width*.22,height*lightY-height*.28,width*.44,height*.56);
    }
    for (const ember of embers) {
      ember.age += dt;
      if (ember.age >= ember.life || ember.y < -15) resetEmber(ember);
      const speed = legends ? AMBIENCE.ink.speed : 1;
      ember.x += (ember.vx + Math.sin(elapsed * 1.3 + ember.phase) * 9+(legends?(lightX-.5)*8:0)) * dt * speed;
      ember.y += ember.vy * dt * speed;
      const fade = Math.min(1, ember.age / 1.2, (ember.life - ember.age) / 2);
      const flicker = .75 + .25 * Math.sin(elapsed * 4 + ember.phase);
      const radius = ember.size * (legends ? 3 : 4);
      ctx!.globalAlpha = fade * flicker * (infernal ? .8 : legends ? .38 : .45);
      ctx!.drawImage(infernal ? fire : legends ? dust : magic, ember.x - radius, ember.y - radius, radius * 2, radius * 2);
    }
    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = 'source-over';
    frameId = requestAnimationFrame(frame);
  }
  function sync(): void {
    if (disposed) return;
    infernal = document.body.classList.contains('underworld');
    const nextLegends = document.body.classList.contains('legends');
    if(nextLegends!==legends){legends=nextLegends;resize();}
    const active = !document.hidden && !motion.matches && menu.isConnected &&
      !menu.hidden && getComputedStyle(menu).display !== 'none' && getComputedStyle(menu).visibility !== 'hidden';
    if(active!==wasActive){wasActive=active;menu.classList.toggle('ambience-paused',!active);}
    canvas.hidden = !active;
    if (active && !frameId) {
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    } else if (!active && frameId) {
      cancelAnimationFrame(frameId); frameId = 0;
      ctx!.clearRect(0, 0, width, height);
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(menu, {attributes: true, attributeFilter: ['class', 'style', 'hidden']});
  observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  addEventListener('resize', resize);
  addEventListener('pointermove',move,{passive:true});
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  resize(); sync();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    removeEventListener('resize', resize);
    removeEventListener('pointermove',move);
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
    canvas.remove(); embers.length = 0;menu.classList.remove('ambience-paused');
    instances.delete(menu);
  };
  instances.set(menu, dispose);
  return dispose;
}
