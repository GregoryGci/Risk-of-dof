// Point d'entrée du client : écran d'accueil (DOM), connexion Colyseus, puis lancement de Phaser.
import Phaser from 'phaser';
import { Client, type Room } from '@colyseus/sdk';
import { BLESSINGS,getBlessing, CLASSES, GAME_PROTOCOL_VERSION, DEFAULT_CLASS, EQUIPMENT_TIERS, GAME_MODES, PHASE_PLAYING, NAME_MAX_LENGTH, ROOM_CODE_LENGTH, ROOM_NAME, SERVER_PORT, type GearDrop, type RunReward } from '@rod/shared';
import { ASSET_ROOT, loadManifest } from './assets/manifest.ts';
import { AssetStore } from './assets/store.ts';
import { GameScene } from './game/GameScene.ts';
import { Hud, escapeHtml } from './ui/Hud.ts';
import { TalentsPage } from './ui/Talents.ts';
import { EquipmentPage } from './ui/EquipmentPage.ts';
import { EncyclopediaPage } from './ui/EncyclopediaPage.ts';
import {HistoryPage} from './ui/HistoryPage.ts';
import {AccountPage} from './ui/AccountPage.ts';
import {AtlasPage} from './ui/AtlasPage.ts';
import {LadderPage} from './ui/LadderPage.ts';
import {cloud} from './cloud.ts';
import { setupDialogNavigation } from './ui/dialogNavigation.ts';
import { account } from './account.ts';
import { settings, saveSettings, subscribeSettings, VOLUMES, type VolumeKey } from './settings.ts';
import { ambiance, music, MENU_TRACK } from './music.ts';
import { applyCrosshair, crosshairUrl, CROSSHAIR_COLORS, CROSSHAIR_SHAPES } from './crosshair.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
setupDialogNavigation();
const applyTheme=()=>document.body.classList.toggle('underworld',settings.uiTheme==='underworld');
applyTheme();subscribeSettings(applyTheme);

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
/**
 * Contexte audio unique pour toutes les parties : Phaser ferme le sien à chaque destruction du jeu,
 * et ses écouteurs de visibilité tentaient ensuite de relancer un contexte fermé.
 * Fourni par la config, il est seulement suspendu ; on le relance au début de chaque partie.
 */
const audioContext = new AudioContext();
manifestPromise.then((m) => { music.setManifest(m); ambiance.setManifest(m); });
music.play(MENU_TRACK);
applyCrosshair();

// Pseudo mémorisé et code pré-rempli par un lien d'invitation (?code=ABCD).
pseudoInput.value = localStorage.getItem('rod.pseudo') ?? '';
const invited = new URLSearchParams(location.search).get('code');
if (invited) codeInput.value = invited.toUpperCase().slice(0, ROOM_CODE_LENGTH);
let setupMode = 1;
let currentView = '';
let blessingId=getBlessing(localStorage.getItem('rod.blessing'))?.id??'ember';
function renderBlessings():void{
  const html=`<div class="pact-heading"><span class="eyebrow">VOTRE PREMIER POUVOIR</span><h3>Choisissez votre bénédiction</h3><p>Un effet de combat pour toute la run. Votre classe garde ses propres sorts.</p></div><div class="pact-grid">${Object.values(BLESSINGS).map(b=>`<button class="pact-card${blessingId===b.id?' selected':''}" data-blessing="${b.id}" style="--pact:#${b.color.toString(16)}" aria-pressed="${blessingId===b.id}" title="${escapeHtml(b.description)}"><span class="pact-family">${b.family}<i>${blessingId===b.id?'✓':'◇'}</i></span><img src="assets/dofus/spells/${b.icon}.png" alt=""><b>${b.name}</b><span>${b.short}</span></button>`).join('')}</div><p class="pact-description">${escapeHtml(BLESSINGS[blessingId].description)}</p>`;
  $('solo-blessings').innerHTML=html;$('multi-blessings').innerHTML=html;
}
renderBlessings();

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
  cloud.changed();
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
const history=new HistoryPage(),atlas=new AtlasPage();
$('btn-atlas').onclick=()=>atlas.open();
const accountPage=new AccountPage(),ladder=new LadderPage();
$('btn-account').onclick=()=>accountPage.open();
$('btn-ladder').onclick=()=>ladder.open();
cloud.subscribe(()=>{if(cloud.busy)return;classId=localStorage.getItem('rod.classe')??DEFAULT_CLASS;if(!CLASSES[classId])classId=DEFAULT_CLASS;pseudoInput.value=localStorage.getItem('rod.pseudo')??'';renderClassPicker();applyCrosshair();});
$('btn-history').onclick=()=>history.open();
$('btn-encyclopedia').addEventListener('click', () => encyclopedia.open());
$('equipment-collection').addEventListener('click', () => encyclopedia.open());
$('btn-equipment').addEventListener('click', () => equipmentPage.open(classId));
$('btn-go-equipment').addEventListener('click', () => equipmentPage.open(classId));

function renderProfile(): void {
  const tier = EQUIPMENT_TIERS[account.bestTier];
  const count = Object.keys(account.equipment).length;
  $('home-profile').innerHTML = `<img src="assets/dofus/portraits/${account.profile.avatar||classId}.png" alt=""><div><b>${escapeHtml(account.profile.name||pseudoInput.value.trim() || 'Aventurier')}</b><span>${CLASSES[classId].name} · ${count} équipements</span></div><span class="profile-bank">${account.bank.toLocaleString('fr')}<small>KAMAS</small><small class="profile-forge">${account.fragments.toLocaleString('fr')} ◈ forge</small></span>`;
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
  $('identity-row').classList.add('hidden');
  $('menu-error').textContent = '';
  if (names[view]) { $('view-eyebrow').textContent = names[view][0]; $('view-title').textContent = names[view][1]; }
  renderProfile();
  if (view === 'settings') renderSettings();
  if (view) $('view-close').focus();
}
menu.addEventListener('click', e => {
  const choice=(e.target as HTMLElement).closest<HTMLElement>('[data-blessing]')?.dataset.blessing;
  const blessing=getBlessing(choice);if(blessing){blessingId=blessing.id;localStorage.setItem('rod.blessing',blessingId);renderBlessings();document.querySelector<HTMLElement>(`#view-${currentView} [data-blessing="${blessingId}"]`)?.focus();}
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
  if (button?.dataset.view) showView(button.dataset.view);
});
$('view-close').addEventListener('click', () => { const prev = currentView; showView(''); document.querySelector<HTMLElement>(`.home-nav-button[data-view="${prev}"]`)?.focus(); });
pseudoInput.addEventListener('input', () => { localStorage.setItem('rod.pseudo', pseudoInput.value); cloud.changed(); renderProfile(); });
/** Réglages de volume : clé, titre, explication. */
const VOLUME_ROWS: [VolumeKey, string, string][] = [
  ['musicVolume', 'Musique', 'Musiques de Dofus 1.29 : une par région, une autre pendant le combat contre le gardien.'],
  ['ambianceVolume', 'Ambiance', 'Bruits de la région (vent, oiseaux, forêt) et annonces : objet, gardien, nouvelle zone.'],
  ['sfxVolume', 'Sorts et combat', 'Sons officiels des sorts, coups, critiques et explosions.'],
];
/** Son joué au relâchement d'un curseur de volume, pour entendre le réglage depuis le menu. */
const VOLUME_PREVIEW: Partial<Record<VolumeKey, string>> = { ambianceVolume: 'item', sfxVolume: 'cast_pression' };
function previewVolume(key: VolumeKey): void {
  const sound = VOLUME_PREVIEW[key];
  manifestPromise.then((m) => {
    const file = sound && m.sounds?.[sound];
    if (!file || settings[key] <= 0) return;
    const audio = new Audio(ASSET_ROOT + file);
    audio.volume = Math.min(1, 0.5 * settings[key]);
    audio.play().catch(() => {});
  });
}
function renderSettings(): void {
  $('home-settings').innerHTML = `<label class="home-setting"><div><b>Direction artistique</b><span>Pacte des Douze : illustration infernale, rouge et ivoire. Ou le style parchemin.</span></div><select name="uiTheme" aria-label="Direction artistique"><option value="underworld" ${settings.uiTheme==='underworld'?'selected':''}>Pacte des Douze</option><option value="retro" ${settings.uiTheme==='retro'?'selected':''}>Parchemin</option></select></label><label class="home-setting"><div><b>Attaque automatique</b><span>L’attaque de base vise l’ennemi le plus proche à portée. Le clic gauche garde la visée manuelle.</span></div><input type="checkbox" name="autoAttack" ${settings.autoAttack ? 'checked' : ''}><i aria-hidden="true"></i></label>
    <label class="home-setting"><div><b>Rendu du jeu</b><span>Le changement s’applique à la prochaine partie.</span></div><select name="renderMode" aria-label="Rendu du jeu"><option value="standard" ${settings.renderMode==='standard'?'selected':''}>Standard</option><option value="compatible" ${settings.renderMode==='compatible'?'selected':''}>Compatibilité</option></select></label><label class="home-setting"><div><b>Performances en jeu</b><span>FPS, aller-retour réseau et nombre de créatures pour identifier les ralentissements.</span></div><input type="checkbox" name="showPerformance" ${settings.showPerformance?'checked':''}><i aria-hidden="true"></i></label><label class="home-setting"><div><b>Smart cast</b><span>Espace et R lancent aussitôt le sort vers la souris. Désactivé, un clic confirme votre cible.</span></div><input type="checkbox" name="smartCast" ${settings.smartCast ? 'checked' : ''}><i aria-hidden="true"></i></label>
    ${VOLUME_ROWS.map(([key, name, help]) => `<div class="home-setting setting-wide"><div><b>${name}</b><span>${help}</span></div><input class="setting-range" type="range" name="${key}" min="0" max="100" step="5" value="${Math.round(settings[key] * 100)}" aria-label="Volume : ${name}"><output id="${key}-value">${Math.round(settings[key] * 100)} %</output></div>`).join('')}
    <div class="home-setting setting-wide crosshair-setting"><div><b>Viseur</b><span>Forme et couleur du curseur en jeu.</span>
      <div class="crosshair-options" role="radiogroup" aria-label="Forme du viseur">${Object.entries(CROSSHAIR_SHAPES).map(([id, name]) => `<label class="crosshair-choice" title="${name}"><input type="radio" name="crosshairShape" value="${id}" ${settings.crosshairShape === id ? 'checked' : ''}><img src="${crosshairUrl(id, settings.crosshairColor)}" alt="${name}"></label>`).join('')}</div>
      <div class="crosshair-colors" role="radiogroup" aria-label="Couleur du viseur">${Object.entries(CROSSHAIR_COLORS).map(([id, c]) => `<label class="crosshair-color" title="${c.name}"><input type="radio" name="crosshairColor" value="${id}" aria-label="${c.name}" ${settings.crosshairColor === id ? 'checked' : ''}><i style="background:${c.hex}"></i></label>`).join('')}</div>
    </div><div class="crosshair-preview" aria-hidden="true"><img src="${crosshairUrl(settings.crosshairShape, settings.crosshairColor)}" alt=""></div></div>`;
}
$('home-settings').addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if(input.name==='renderMode'&&(input.value==='standard'||input.value==='compatible')){settings.renderMode=input.value;saveSettings();}
  if(input.name==='uiTheme'&&(input.value==='retro'||input.value==='underworld')){settings.uiTheme=input.value;saveSettings();}
  if (input.name === 'autoAttack' || input.name === 'smartCast' || input.name === 'showPerformance') { settings[input.name] = input.checked; saveSettings(); }
  if (input.name === 'crosshairShape' || input.name === 'crosshairColor') {
    settings[input.name] = input.value;
    saveSettings();
    applyCrosshair();
    renderSettings();
    $('home-settings').querySelector<HTMLInputElement>(`input[name="${input.name}"][value="${input.value}"]`)?.focus();
  }
  if (isVolume(input.name)) { saveSettings(); previewVolume(input.name); }
});
const isVolume = (name: string): name is VolumeKey => (VOLUMES as readonly string[]).includes(name);
// Le volume suit le curseur en direct ; il est mémorisé au relâchement (événement change).
$('home-settings').addEventListener('input', e => {
  const input = e.target as HTMLInputElement;
  if (!isVolume(input.name)) return;
  const volume = Number(input.value) / 100;
  // Musique et ambiance tournent déjà : leur volume change en direct. Les bruitages lisent le réglage à chaque son.
  if (input.name === 'musicVolume') music.setVolume(volume);
  else if (input.name === 'ambianceVolume') ambiance.setVolume(volume);
  else settings[input.name] = volume;
  $(`${input.name}-value`).textContent = `${input.value} %`;
});
function renderModes(): void {
  $('setup-modes').innerHTML = GAME_MODES.map((m,i) => `<button class="setup-mode${setupMode === m.id ? ' active' : ''}" data-setup-mode="${m.id}" aria-pressed="${setupMode === m.id}" title="${escapeHtml(m.description)}"><span>${['Facile','Normal','Difficile','Cauchemar'][i]}</span><b>${m.name}</b><small>${['Découvrez les champs','Avec une première tenue','Tenue de palier 80 conseillée','2 boss / 3 boss toutes les 3 zones'][i]}</small></button>`).join('');
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
  const name = (account.profile.name||pseudoInput.value.trim()).slice(0, NAME_MAX_LENGTH);
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
  let joined:Room|undefined;
  try {
    await cloud.ready;
    if(!cloud.session||!account.profile.complete){accountPage.open();return;}
    await cloud.flush();
    const room = await join();
    joined=room;
    await startGame(room);
  } catch (e) {
    if(joined){joined.reconnection.enabled=false;void joined.leave().catch(()=>{});}
    console.error(e);
    errorEl.textContent = explain(e);
  } finally {
    setBusy(false);
  }
}

const joinOptions = () => ({ name: pseudo(), classId, spells: account.loadout(classId), equipment: account.equipment,blessing:blessingId,accessToken:cloud.session?.access_token });
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
  // La réservation WebSocket peut précéder le premier snapshot Colyseus.
  // Attendre ses données avant de choisir les assets et de lancer la scène.
  if(!Number.isFinite(room.state?.stage)||!Number.isFinite(room.state?.seed)){
    await new Promise<void>((resolve,reject)=>{
      const receive=(state:{stage?:number;seed?:number})=>{if(!Number.isFinite(state.stage)||!Number.isFinite(state.seed))return;window.clearTimeout(timeout);room.onStateChange.remove(receive);resolve();};
      const timeout=window.setTimeout(()=>{room.onStateChange.remove(receive);reject(new Error('La partie ne répond pas. Réessayez.'));},10000);
      room.onStateChange(receive);
    });
  }
  if(room.state.protocolVersion!==GAME_PROTOCOL_VERSION)throw new Error('Le serveur de jeu utilise encore une ancienne version. Attendez la mise à jour du serveur Railway puis réessayez.');
  currentRoom = room;
  const sessionKey=`rod.partie.${cloud.session!.user.id}`;
  const remember=()=>sessionStorage.setItem(sessionKey,JSON.stringify({token:room.reconnectionToken,roomId:room.roomId,at:Date.now()}));
  remember();room.onReconnect(remember);
  let rememberedToken=room.reconnectionToken;
  room.onStateChange(()=>{if(room.reconnectionToken!==rememberedToken){rememberedToken=room.reconnectionToken;remember();}});
  const store = new AssetStore(await manifestPromise);

  /**
   * Retour à l'accueil, sans attendre le serveur : après une coupure, le SDK tente de se reconnecter
   * et `room.leave()` ne répondait qu'à la fin de ces tentatives — le bouton semblait ne rien faire.
   */
  let closed = false;
  const backToMenu = (error = ''): void => {
    if (closed) return;
    closed = true;
    sessionStorage.removeItem(sessionKey);
    if (currentRoom === room) currentRoom = null;
    // Plus aucun message du serveur ne doit atteindre la scène détruite.
    room.removeAllListeners();
    hud.hide();
    equipmentPage.close();
    encyclopedia.close();
    talents.close();
    // Détruit la scène : objets, minuteries, tweens, sons et écouteurs clavier/souris (événement SHUTDOWN).
    game?.destroy(true);
    game = null;
    menu.classList.remove('hidden');
    renderProfile();
    errorEl.textContent = error;
    music.play(MENU_TRACK);
    ambiance.play('');
  };
  const quit = (): void => {
    backToMenu();
    // Départ propre si le serveur répond ; sinon on coupe la connexion sans relancer de reconnexion.
    room.reconnection.enabled = false;
    const force = window.setTimeout(() => { try { room.connection.close(); } catch { /* Déjà fermée. */ } }, 1500);
    room.leave().then(() => window.clearTimeout(force), () => {});
  };

  const hud = new Hud(store, {
    onStart: () => { room.send('equipment', { equipment: account.equipment }); room.send('start'); },
    onRestart: () => room.send('restart'),
    onBlessing: id=>{room.send('blessing',{blessing:id});const blessing=getBlessing(id);if(blessing){blessingId=blessing.id;localStorage.setItem('rod.blessing',id);renderBlessings();}},
    onQuit: quit,
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
  room.onMessage('forgeGrant',(message:{player:string;grant:import('@rod/shared').ForgeGrant})=>{if(message.player===room.sessionId)account.claimFragments([message.grant]);});
  room.onMessage('runReward',(message:{player:string;reward:RunReward})=>{ if(message.player===room.sessionId) { account.creditRun(message.reward); renderProfile(); } });
  room.onMessage('scoreSaved',()=>hud.toast('Votre run est inscrite au classement.'));
  room.onMessage('scoreError',(message:{message:string})=>hud.toast(escapeHtml(message.message)));
  room.onMessage('cloudStatus',()=>{});
  menu.classList.add('hidden');
  hud.show(room.roomId);
  audioContext.resume().catch(() => {});

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a2611',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    // Plusieurs atlas par lot ; textureState restaure le cache avant le rendu.
    render: { antialias: true, roundPixels: false, maxTextures: settings.renderMode==='compatible'?1:8 },
    fps: { target: 60, limit: 60, smoothStep: false },
    audio: { context: audioContext },
    // La scène reçoit la salle, les assets et le HUD par son constructeur.
    scene: new GameScene({ room, store, hud }),
  });

  // Retour à l'accueil quand le serveur ferme la partie ou que la connexion tombe pour de bon.
  // 1000/4000 = départ volontaire ; tout autre code = coupure.
  room.onLeave((code) => backToMenu(code === 1000 || code === 4000 ? '' : 'Connexion au serveur perdue.'));
}

// sessionStorage conserve la partie de cet onglet et ne fusionne pas deux onglets multijoueur.
void cloud.ready.then(async()=>{
  if(!cloud.session||!account.profile.complete||currentRoom)return;
  const key=`rod.partie.${cloud.session.user.id}`;
  let saved:{token?:string;at?:number}|undefined;
  try{saved=JSON.parse(sessionStorage.getItem(key)??'null');}catch{sessionStorage.removeItem(key);return;}
  if(!saved?.token)return;
  setBusy(true);
  try{await startGame(await client.reconnect(saved.token));}
  catch{sessionStorage.removeItem(key);showView('solo');errorEl.textContent='La précédente partie n’est plus disponible. Vous pouvez en lancer une nouvelle.';}
  finally{setBusy(false);}
});
