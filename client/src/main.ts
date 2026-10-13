// Point d'entrée du client : écran d'accueil (DOM), connexion Colyseus, puis lancement de Phaser.
import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH, ROOM_NAME, SERVER_PORT } from '@rod/shared';
import { loadManifest } from './assets/manifest.ts';
import { AssetStore } from './assets/store.ts';
import { GameScene } from './game/GameScene.ts';
import { Hud } from './ui/Hud.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const menu = $('menu');
const pseudoInput = $<HTMLInputElement>('pseudo');
const codeInput = $<HTMLInputElement>('code');
const btnCreate = $<HTMLButtonElement>('btn-create');
const btnJoin = $<HTMLButtonElement>('btn-join');
const errorEl = $('menu-error');

/**
 * Adresse du serveur de jeu.
 * - en dev (Vite sur 5173) : même machine, port du serveur Colyseus ;
 * - en production : le serveur sert aussi le client, donc même origine.
 */
function serverUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV) return `${proto}://${location.hostname}:${SERVER_PORT}`;
  return `${proto}://${location.host}`;
}

const client = new Client(serverUrl());
const manifestPromise = loadManifest();
let game: Phaser.Game | null = null;

// Pseudo mémorisé et code pré-rempli par un lien d'invitation (?code=ABCD).
pseudoInput.value = localStorage.getItem('rod.pseudo') ?? '';
const invited = new URLSearchParams(location.search).get('code');
if (invited) codeInput.value = invited.toUpperCase().slice(0, ROOM_CODE_LENGTH);
(invited && pseudoInput.value ? btnJoin : pseudoInput).focus();

function setBusy(busy: boolean): void {
  btnCreate.disabled = busy;
  btnJoin.disabled = busy;
}

function pseudo(): string {
  const name = pseudoInput.value.trim().slice(0, NAME_MAX_LENGTH);
  localStorage.setItem('rod.pseudo', name);
  return name;
}

/** Traduit les erreurs de connexion en message lisible. */
function explain(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found|no rooms found|invalid/i.test(msg)) return 'Partie introuvable : vérifiez le code.';
  if (/locked|full/i.test(msg)) return 'Cette partie est complète (4 joueurs max).';
  if (/fetch|network|offline|ECONNREFUSED|failed/i.test(msg)) return 'Serveur injoignable. Est-il lancé ?';
  return `Connexion impossible : ${msg}`;
}

async function connect(join: () => Promise<Room>): Promise<void> {
  errorEl.textContent = '';
  setBusy(true);
  try {
    const room = await join();
    await startGame(room);
  } catch (e) {
    console.error(e);
    errorEl.textContent = explain(e);
  } finally {
    setBusy(false);
  }
}

btnCreate.addEventListener('click', () => connect(() => client.create(ROOM_NAME, { name: pseudo() })));

function joinWithCode(): void {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) {
    errorEl.textContent = `Le code fait ${ROOM_CODE_LENGTH} lettres.`;
    return;
  }
  connect(() => client.joinById(code, { name: pseudo() }));
}
btnJoin.addEventListener('click', joinWithCode);
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinWithCode();
});
pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') (codeInput.value ? btnJoin : btnCreate).click();
});

async function startGame(room: Room): Promise<void> {
  const store = new AssetStore(await manifestPromise);
  const hud = new Hud(store, {
    onStart: () => room.send('start'),
    onRestart: () => room.send('restart'),
    onQuit: () => room.leave(),
  });

  menu.classList.add('hidden');
  hud.show(room.roomId);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a2611',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false },
    // La scène reçoit la salle, les assets et le HUD par son constructeur.
    scene: new GameScene({ room, store, hud }),
  });

  // Retour à l'accueil quand on quitte ou que la connexion tombe.
  room.onLeave((code) => {
    hud.hide();
    game?.destroy(true);
    game = null;
    menu.classList.remove('hidden');
    // 1000 = départ volontaire ; tout autre code = coupure.
    errorEl.textContent = code === 1000 || code === 4000 ? '' : 'Connexion au serveur perdue.';
  });
}
