// Écrans de chargement « Encre des Douze » : l'accueil au démarrage de la page, puis le lancement de chaque partie.
// L'écran d'accueil est déjà dans index.html (styles en ligne) pour couvrir la page avant le chargement du code.
import { CLASSES, DEFAULT_CLASS, GAME_MODES, runZone } from '@rod/shared';
import { classPortrait } from './classPortrait.ts';
import '../loaders.css';

/** Durée minimale de l'écran d'accueil, comptée depuis l'ouverture de la page. */
const HOME_MIN_MS = 2200;
/** Au-delà, l'accueil s'affiche quoi qu'il arrive (réseau lent, image en échec). */
const HOME_MAX_MS = 8000;
/** Durée minimale de l'écran de lancement : sans elle, il clignote sur une connexion rapide. */
const RUN_MIN_MS = 1500;
/** Images de l'accueil à décoder avant de le montrer. */
const HOME_IMAGES = ['assets/menu/twelve-classes.png', 'assets/menu/ink-wordmark.png', 'assets/menu/class-portraits.png'];

const TIPS = [
  'Le dash traverse les projectiles : gardez-le pour les annonces des gardiens.',
  'Les sorts se lancent seuls. Concentrez-vous sur le placement.',
  'Ramassez l’XP sans tarder : chaque niveau offre un nouveau choix de sort ou de passif.',
  'Deux sorts associés évoluent ensemble. Les cartes de niveau indiquent les paires.',
  'Un Zaap maudit triple les chances de Dofus, mais les monstres frappent plus fort.',
  'Les élites offrent des bénédictions qui changent votre façon de jouer.',
  'Entre deux donjons, la halte permet de choisir sa route.',
  'Le butin est conservé après la défaite : chaque run renforce la suivante.',
];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
const decode = (src: string) => { const img = new Image(); img.src = src; return img.decode().catch(() => {}); };
const pageLoaded = () => new Promise<void>((resolve) => document.readyState === 'complete' ? resolve() : addEventListener('load', () => resolve(), { once: true }));

function fadeOut(el: HTMLElement): void {
  el.classList.add('done');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
  // Sans transition (animations réduites), transitionend ne vient jamais.
  setTimeout(() => el.remove(), 900);
}

/** Retire l'écran d'accueil une fois la page, les polices et les images principales prêtes. */
export async function finishHomeLoader(): Promise<void> {
  const el = document.getElementById('home-loader');
  if (!el) return;
  const ready = Promise.all([pageLoaded(), document.fonts?.ready, ...HOME_IMAGES.map(decode)]);
  await Promise.race([Promise.all([ready, wait(HOME_MIN_MS - performance.now())]), wait(HOME_MAX_MS - performance.now())]);
  el.dataset.final = '1';
  el.style.setProperty('--progress', '1');
  await wait(350);
  fadeOut(el);
}

/** Écran de lancement d'une partie : portrait de la classe, donjon de départ, astuce et progression. */
export class RunLoader {
  private el: HTMLElement | null = null;
  private shownAt = 0;

  show(classId: string): void {
    this.el?.remove();
    const id = CLASSES[classId] ? classId : DEFAULT_CLASS;
    const el = document.createElement('div');
    el.className = 'run-loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<div class="run-loader-art"><img class="run-loader-enso" src="assets/menu/ink-enso.svg" alt="">${classPortrait(id)}</div>
      <div class="run-loader-text"><span class="run-loader-eyebrow">${CLASSES[id].name.toUpperCase()} · PRÉPARATION</span><h2>En route vers le donjon</h2>
      <p class="run-loader-tip"><b>Conseil</b>${TIPS[Math.floor(Math.random() * TIPS.length)]}</p>
      <div class="run-loader-bar"><i></i></div><span class="run-loader-status">Connexion au serveur…</span></div>`;
    document.body.append(el);
    this.el = el;
    this.shownAt = performance.now();
  }

  /** Le serveur a envoyé la partie : on connaît le donjon de départ et la difficulté. */
  zone(stage: number, mode: number, order = ''): void {
    if (!this.el) return;
    this.el.querySelector('.run-loader-eyebrow')!.textContent = `${(GAME_MODES[mode]?.name ?? '').toUpperCase()} · ZONE ${stage}`;
    this.el.querySelector('h2')!.textContent = runZone(order,stage).name;
    this.status('Préparation du donjon…');
  }

  progress(ratio: number): void {
    if (!this.el) return;
    this.el.style.setProperty('--progress', String(Math.min(1, Math.max(0, ratio))));
    this.status(`Chargement des créatures… ${Math.round(ratio * 100)} %`);
  }

  /** La scène est prête : on termine la barre, puis on dévoile le jeu. */
  async done(): Promise<void> {
    const el = this.el;
    if (!el) return;
    this.el = null;
    el.style.setProperty('--progress', '1');
    el.querySelector('.run-loader-status')!.textContent = 'Bonne chance, aventurier.';
    await wait(RUN_MIN_MS - (performance.now() - this.shownAt));
    fadeOut(el);
  }

  /** Échec ou retour à l'accueil : retrait immédiat. */
  hide(): void {
    this.el?.remove();
    this.el = null;
  }

  private status(text: string): void {
    const status = this.el?.querySelector('.run-loader-status');
    if (status) status.textContent = text;
  }
}
