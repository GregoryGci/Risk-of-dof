// Banc d'essai des apparats (skins.html) : chaque apparat extrait est affiché animé à côté du
// personnage de base, pour juger le rendu avant de brancher les apparats dans le jeu.
import Phaser from 'phaser';
import { CLASSES } from '@rod/shared';
import { ASSET_ROOT, DEFAULT_MIRROR, loadManifest, type SpriteDef } from './assets/manifest.ts';

type SkinDef = SpriteDef & { name?: string };
const ANIMS: [string, string][] = [['idle', 'Repos'], ['run', 'Course'], ['attack', 'Attaque'], ['cast1', 'Sort 1'], ['cast2', 'Sort 2'], ['death', 'Mort']];
const DIR_NAMES = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
const CELL_W = 210;
const CELL_H = 250;

const manifest = await loadManifest();
/** Atlas d'apparats, hors du manifeste du jeu (fichier local écrit par tools/extract-skins.mjs). */
const skins: Record<string, Record<string, SkinDef>> = await fetch(`${ASSET_ROOT}skins/skins.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const state = { classId: location.hash.slice(1) in skins ? location.hash.slice(1) : Object.keys(skins)[0] ?? 'cra', anim: 'idle', dir: 1, spin: false };

class LabScene extends Phaser.Scene {
  private views: { key: string; def: SkinDef; sprite: Phaser.GameObjects.Sprite }[] = [];
  private spinClock = 0;

  constructor() { super('lab'); }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    for (const [key, def] of this.entries()) if (def.atlas) this.load.atlas(key, def.image, def.atlas);
  }

  /** Personnage de base puis ses apparats. */
  private entries(): [string, SkinDef][] {
    const base = manifest.characters?.[state.classId];
    const list: [string, SkinDef][] = base ? [[`base_${state.classId}`, { ...base, name: 'Sans apparat' }]] : [];
    for (const [id, def] of Object.entries(skins[state.classId] ?? {})) list.push([`skin_${state.classId}_${id}`, def]);
    return list;
  }

  create(): void {
    const entries = this.entries();
    const cols = Math.max(1, Math.floor(this.scale.width / CELL_W));
    entries.forEach(([key, def], i) => {
      const x = (i % cols) * CELL_W + CELL_W / 2;
      const y = Math.floor(i / cols) * CELL_H;
      this.add.ellipse(x, y + 190, 90, 26, 0x000000, 0.35);
      this.add.text(x, y + 214, def.name ?? key, { fontSize: '13px', color: '#efe3c4', align: 'center', wordWrap: { width: CELL_W - 16 } }).setOrigin(0.5, 0);
      for (const [name, byDir] of Object.entries(def.anims ?? {})) for (const [dir, a] of Object.entries(byDir)) {
        this.anims.create({ key: `${key}:${name}:${dir}`, frames: this.anims.generateFrameNames(key, { prefix: a.prefix, start: a.start ?? 0, end: a.end ?? 0 }), frameRate: a.frameRate ?? 10, repeat: name === 'idle' || name === 'run' ? -1 : 0 });
      }
      const sprite = this.add.sprite(x, y + 190, key).setOrigin(...(def.origin ?? [0.5, 0.9])).setScale((def.scale ?? 1) * 1.6);
      // Animation jouée une fois : on la relance après une courte pause pour pouvoir la revoir.
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(700, () => this.play(this.views.find((v) => v.sprite === sprite)!)));
      this.views.push({ key, def, sprite });
    });
    this.scale.resize(this.scale.width, Math.ceil(entries.length / cols) * CELL_H + 10);
    this.refresh();
  }

  update(_t: number, dt: number): void {
    if (!state.spin) return;
    this.spinClock += dt;
    if (this.spinClock < 900) return;
    this.spinClock = 0;
    state.dir = (state.dir + 1) % 8;
    renderButtons();
    this.refresh();
  }

  refresh(): void { for (const v of this.views) this.play(v); }

  private play(v: { key: string; def: SkinDef; sprite: Phaser.GameObjects.Sprite }): void {
    const byDir = v.def.anims?.[state.anim] ?? v.def.anims?.idle ?? {};
    const name = v.def.anims?.[state.anim] ? state.anim : 'idle';
    let dir = String(state.dir);
    let flip = false;
    if (!byDir[dir]) { dir = String((v.def.mirror ?? DEFAULT_MIRROR)[dir] ?? Object.keys(byDir)[0]); flip = true; }
    v.sprite.setFlipX(flip).play(`${v.key}:${name}:${dir}`, false);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'lab',
  width: Math.max(CELL_W, window.innerWidth - 4),
  height: 600,
  transparent: true,
  scene: LabScene,
});
const lab = () => game.scene.getScene('lab') as LabScene;

function renderButtons(): void {
  const btn = (label: string, active: boolean, onClick: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
    b.onclick = onClick;
    return b;
  };
  document.getElementById('classes')!.replaceChildren(...Object.keys(skins).map((id) => btn(CLASSES[id]?.name ?? id, id === state.classId, () => { state.classId = id; location.hash = id; location.reload(); })));
  document.getElementById('anims')!.replaceChildren(...ANIMS.map(([id, label]) => btn(label, id === state.anim, () => { state.anim = id; renderButtons(); lab().refresh(); })));
  document.getElementById('dirs')!.replaceChildren(
    ...DIR_NAMES.map((label, i) => btn(label, !state.spin && i === state.dir, () => { state.dir = i; state.spin = false; renderButtons(); lab().refresh(); })),
    btn('Tourner', state.spin, () => { state.spin = !state.spin; renderButtons(); }),
  );
}
renderButtons();
