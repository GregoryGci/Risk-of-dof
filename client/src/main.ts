// Point d'entrée du client : écran d'accueil (DOM), connexion Colyseus, puis lancement de Phaser.
import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { CLASSES, DEFAULT_CLASS, EQUIPMENT_TIERS, GAME_MODES, PHASE_PLAYING, NAME_MAX_LENGTH, ROOM_CODE_LENGTH, ROOM_NAME, SERVER_PORT, type GearDrop, type RunReward } from '@rod/shared';
import { loadManifest } from './assets/manifest.ts';
import { AssetStore } from './assets/store.ts';
import { GameScene } from './game/GameScene.ts';
import { Hud, escapeHtml } from './ui/Hud.ts';
import { TalentsPage } from './ui/Talents.ts';
import { EquipmentPage } from './ui/EquipmentPage.ts';
import { EncyclopediaPage } from './ui/EncyclopediaPage.ts';
import { setupDialogNavigation } from './ui/dialogNavigation.ts';
import { account } from './account.ts';
import { settings, saveSettings } from './settings.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
setupDialogNavigation();

const menu = $('menu');
const pseudoInput = $<HTMLInputElement>('pseudo');
const codeInput = $<HTMLInputElement>('code');
const btnCreate = $<HTMLButtonElement>('btn-create');
const btnJoin = $<HTMLButtonElement>('btn-join');
const btnSolo = $<HTMLButtonElement>('btn-solo');
const errorEl = $('menu-error');

/**
 * Adresse du serveur de jeu.
 * - en dev (Vite sur 5173) : même machine, port du serveur Colyseus ;
 * - version publiée (GitHub Pages) : adresse du serveur inscrite au build (VITE_SERVER_URL) ;
 * - sinon en production : le serveur sert aussi le client, donc même origine.
 */
function serverUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
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
let setupMode = 0;
let currentView = '';

// Classe choisie, mémorisée d'une partie à l'autre.
let classId = localStorage.getItem('rod.classe') ?? DEFAULT_CLASS;
if (!CLASSES[classId]) classId = DEFAULT_CLASS;
const classPicker = $('class-picker');
function renderClassPicker(): void {
  classPicker.innerHTML = Object.values(CLASSES).map(c => `<button class="home-class${c.id === classId ? ' active' : ''}" data-class="${c.id}" aria-pressed="${c.id === classId}" title="${escapeHtml(c.description)}"><img src="assets/dofus/portraits/${c.id}.png" alt=""><span>${escapeHtml(c.name)}</span></button>`).join('');
  $('class-desc').textContent = CLASSES[classId].description;
  $('character-name').textContent = CLASSES[classId].name;
  const portrait = $<HTMLImageElement>('character-portrait');
  portrait.src = `assets/dofus/portraits/${classId}.png`;
  portrait.alt = CLASSES[classId].name;
  renderProfile();
}
classPicker.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-class]')?.dataset.class;
  if (!id || !CLASSES[id]) return;
  classId = id;
  localStorage.setItem('rod.classe', id);
  renderClassPicker();
});
renderClassPicker();

// Arbre de talents : depuis l'accueil, ou depuis le salon (les sorts équipés sont alors envoyés au serveur).
let currentRoom: Room | null = null;
const talents = new TalentsPage(null, classId, (cls) => {
  if (currentRoom && cls === classId) currentRoom.send('loadout', { spells: account.loadout(cls) });
});
$('btn-talents').addEventListener('click', () => talents.open(classId));
const equipmentPage = new EquipmentPage(() => {
  currentRoom?.send('equipment', { equipment: account.equipment });
  renderProfile();
}, () => !currentRoom || currentRoom.state.phase !== PHASE_PLAYING);
const encyclopedia = new EncyclopediaPage();
$('btn-encyclopedia').addEventListener('click', () => encyclopedia.open());
$('equipment-collection').addEventListener('click', () => encyclopedia.open());
$('btn-equipment').addEventListener('click', () => equipmentPage.open(classId));
$('btn-go-equipment').addEventListener('click', () => equipmentPage.open(classId));

function renderProfile(): void {
  const tier = EQUIPMENT_TIERS[account.bestTier];
  const count = Object.keys(account.equipment).length;
  $('home-profile').innerHTML = `<img src="assets/dofus/portraits/${classId}.png" alt=""><div><b>${escapeHtml(pseudoInput.value.trim() || 'Aventurier')}</b><span>${CLASSES[classId].name} · ${count} équipements</span></div><span class="profile-bank">${account.bank.toLocaleString('fr')}<small>KAMAS</small></span>`;
  $('home-progress').textContent = `PALIER ${tier.level} · ${account.inventory.length} ÉQUIPEMENTS`;
  $('equipment-summary').textContent = `${count} emplacements équipés · ${account.inventory.length} objets`;
  $('collection-summary').textContent = `${account.discovered.length} / ${account.catalogSize} découverts`;
  $('talents-summary').textContent = `${account.bank.toLocaleString('fr')} kamas pour débloquer vos sorts`;
  $('solo-character').innerHTML = `<img src="assets/dofus/portraits/${classId}.png" alt=""><div><b>${CLASSES[classId].name}</b><span>${CLASSES[classId].maxHp + account.bonuses.maxHp} PV de départ · ${count} équipements</span></div>`;
}
function showView(view: string): void {
  currentView = view;
  const names: Record<string, [string,string]> = { solo: ['L’AVENTURE EN SOLITAIRE','Single player'], multi: ['PLUS FORTS ENSEMBLE','Multiplayer'], character: ['PRÊT POUR LA PROCHAINE RUN','Character'], settings: ['À VOTRE FAÇON','Settings'] };
  $('home-view').classList.toggle('hidden', !view);
  $('home-welcome').classList.toggle('hidden', !!view);
  menu.classList.toggle('has-view', !!view);
  for (const name of Object.keys(names)) $(`view-${name}`).classList.toggle('hidden', view !== name);
  document.querySelectorAll<HTMLElement>('.home-nav-button').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $('identity-row').classList.toggle('hidden', view === 'settings');
  $('menu-error').textContent = '';
  if (names[view]) { $('view-eyebrow').textContent = names[view][0]; $('view-title').textContent = names[view][1]; }
  renderProfile();
  if (view === 'settings') renderSettings();
  if (view) $('view-close').focus();
}
menu.addEventListener('click', e => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
  if (button?.dataset.view) showView(button.dataset.view);
});
$('view-close').addEventListener('click', () => { const prev = currentView; showView(''); document.querySelector<HTMLElement>(`.home-nav-button[data-view="${prev}"]`)?.focus(); });
pseudoInput.addEventListener('input', () => { localStorage.setItem('rod.pseudo', pseudoInput.value); renderProfile(); });
function renderSettings(): void {
  $('home-settings').innerHTML = `<label class="home-setting"><div><b>Attaque automatique</b><span>L’attaque de base vise l’ennemi le plus proche à portée. Le clic gauche garde la visée manuelle.</span></div><input type="checkbox" name="autoAttack" ${settings.autoAttack ? 'checked' : ''}><i aria-hidden="true"></i></label>
    <label class="home-setting"><div><b>Smart cast</b><span>Espace et R lancent aussitôt le sort vers la souris. Désactivé, un clic confirme votre cible.</span></div><input type="checkbox" name="smartCast" ${settings.smartCast ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
}
$('home-settings').addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if (input.name === 'autoAttack' || input.name === 'smartCast') { settings[input.name] = input.checked; saveSettings(); }
});
function renderModes(): void {
  $('setup-modes').innerHTML = GAME_MODES.map((m,i) => `<button class="setup-mode${setupMode === m.id ? ' active' : ''}" data-setup-mode="${m.id}" aria-pressed="${setupMode === m.id}" title="${escapeHtml(m.description)}"><span>${['Facile','Normal','Difficile'][i]}</span><b>${m.name}</b><small>${['Découvrez les champs','Avec une première tenue','Tenue de palier 80 conseillée'][i]}</small></button>`).join('');
}
$('setup-modes').addEventListener('click', e => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-setup-mode]');
  if (button) { setupMode = Number(button.dataset.setupMode); renderModes(); }
});
renderModes();
if (invited) showView('multi');

function setBusy(busy: boolean): void {
  btnCreate.disabled = busy;
  btnJoin.disabled = busy;
  btnSolo.disabled = busy;
  btnSolo.textContent = busy ? 'Connexion…' : 'Partir à l’aventure →';
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

const joinOptions = () => ({ name: pseudo(), classId, spells: account.loadout(classId), equipment: account.equipment });
btnCreate.addEventListener('click', () => connect(() => client.create(ROOM_NAME, joinOptions())));
btnSolo.addEventListener('click', () => connect(async () => {
  const room = await client.create(ROOM_NAME, { ...joinOptions(), singlePlayer: true });
  room.send('mode', { mode: setupMode });
  room.send('start');
  return room;
}));

function joinWithCode(): void {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) {
    errorEl.textContent = `Le code fait ${ROOM_CODE_LENGTH} lettres.`;
    return;
  }
  connect(() => client.joinById(code, joinOptions()));
}
btnJoin.addEventListener('click', joinWithCode);
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinWithCode();
});
pseudoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') (currentView === 'solo' ? btnSolo : codeInput.value ? btnJoin : btnCreate).click();
});

async function startGame(room: Room): Promise<void> {
  currentRoom = room;
  const store = new AssetStore(await manifestPromise);
  const hud = new Hud(store, {
    onStart: () => { room.send('equipment', { equipment: account.equipment }); room.send('start'); },
    onRestart: () => room.send('restart'),
    onQuit: () => room.leave(),
    onSpellHover: () => {},
    onMode: (mode) => room.send('mode', { mode }),
    onEquipment: (uid) => equipmentPage.open(classId, uid),
    onTalents: () => talents.open(classId),
    onClass: (id) => {
      // Le choix fait dans le salon devient aussi le choix par défaut de l'accueil.
      classId = id;
      localStorage.setItem('rod.classe', id);
      renderClassPicker();
      room.send('class', { classId: id, spells: account.loadout(id) });
    },
  });

  room.onMessage('gearDrop',(message:{player:string;drop:GearDrop})=>{ if(message.player===room.sessionId) hud.collectDrop(message.drop); });
  room.onMessage('runReward',(message:{player:string;reward:RunReward})=>{ if(message.player===room.sessionId) { account.creditRun(message.reward); renderProfile(); } });
  menu.classList.add('hidden');
  hud.show(room.roomId);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a2611',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    // maxTextures: 1 contourne un bug de rendu WebGL de Phaser 3.90 : au-delà de 16 textures par image,
    // créer une texture en cours de partie (chiffre de dégâts, effet...) faisait disparaître les sprites
    // des personnages. Le sol est pré-dessiné dans une seule texture pour limiter le coût (MapView).
    render: { antialias: true, roundPixels: false, maxTextures: 1 },
    // La scène reçoit la salle, les assets et le HUD par son constructeur.
    scene: new GameScene({ room, store, hud }),
  });

  // Retour à l'accueil quand on quitte ou que la connexion tombe.
  room.onLeave((code) => {
    currentRoom = null;
    hud.hide();
    equipmentPage.close();
    encyclopedia.close();
    talents.close();
    game?.destroy(true);
    game = null;
    menu.classList.remove('hidden');
    renderProfile();
    // 1000 = départ volontaire ; tout autre code = coupure.
    errorEl.textContent = code === 1000 || code === 4000 ? '' : 'Connexion au serveur perdue.';
  });
}
