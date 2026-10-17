// Ambiance animée de l'accueil : braises qui montent et lueur pulsante du portail, sur un canvas léger.
// S'arrête quand le menu est masqué et respecte « réduire les animations ».
const IMAGE = {w: 1672, h: 941, portal: {x: 1180, y: 330, r: 230}};

interface Ember {x: number; y: number; vx: number; vy: number; size: number; life: number; age: number; hue: number}

export function startHomeAmbience(menu: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;width:100vw;height:100vh';
  menu.querySelector('.home-grain')?.before(canvas);
  const ctx = canvas.getContext('2d')!;
  const embers: Ember[] = [];
  let w = 0, h = 0, scale = 1, offsetX = 0, offsetY = 0, last = performance.now();
  const resize = () => {
    w = canvas.width = innerWidth; h = canvas.height = innerHeight;
    // Même cadrage que l'image de fond en `center/cover`.
    scale = Math.max(w / IMAGE.w, h / IMAGE.h); offsetX = (w - IMAGE.w * scale) / 2; offsetY = (h - IMAGE.h * scale) / 2;
  };
  resize(); addEventListener('resize', resize);
  const spawn = (): Ember => ({x: w * (.35 + Math.random() * .65), y: h + 10, vx: (Math.random() - .5) * 12, vy: -(25 + Math.random() * 45),
    size: .8 + Math.random() * 2.2, life: 5 + Math.random() * 6, age: 0, hue: 8 + Math.random() * 30});
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (menu.classList.contains('hidden') || document.hidden) {last = now; return;}
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, w, h);
    // Lueur du portail : halo turquoise qui respire doucement.
    const px = offsetX + IMAGE.portal.x * scale, py = offsetY + IMAGE.portal.y * scale, pr = IMAGE.portal.r * scale;
    const pulse = .5 + .5 * Math.sin(now / 1400);
    const glow = ctx.createRadialGradient(px, py, pr * .2, px, py, pr * 1.15);
    glow.addColorStop(0, `rgba(120,240,230,${.10 + .08 * pulse})`); glow.addColorStop(.7, `rgba(80,210,220,${.05 + .05 * pulse})`); glow.addColorStop(1, 'rgba(80,210,220,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, pr * 1.15, 0, Math.PI * 2); ctx.fill();
    // Braises : montent en ondulant, scintillent et s'éteignent.
    while (embers.length < Math.min(90, Math.round(w * h / 22000))) {const e = spawn(); e.y = Math.random() * h; e.age = Math.random() * e.life; embers.push(e);}
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]; e.age += dt;
      if (e.age >= e.life || e.y < -10) {embers[i] = spawn(); continue;}
      e.x += (e.vx + Math.sin(now / 700 + i) * 10) * dt; e.y += e.vy * dt;
      const fade = Math.min(1, e.age / .6) * (1 - e.age / e.life), flicker = .65 + .35 * Math.sin(now / 90 + i * 7);
      ctx.fillStyle = `hsla(${e.hue},100%,60%,${.85 * fade * flicker})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsla(${e.hue},100%,55%,${.18 * fade})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(frame);
}
