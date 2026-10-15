import {runBonusText} from '@rod/shared';
// Scène principale : affiche l'état reçu du serveur, envoie les entrées du joueur.
// Aucune règle de jeu ici : le client ne décide ni des dégâts ni des temps de recharge.
import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import {
  INTERACT_RANGE,
  PHASE_LOBBY,
  PHASE_LOST,
  PHASE_PLAYING,
  PLAYER_RADIUS,
  MSTATE_WINDUP,
  ZAAP_CHARGING,
  ZAAP_IDLE,
  ZAAP_RANGE,
  ZAAP_READY,
  dirFromVector,
  generateMap,
  zoneForStage,
  getClass,
  getRunBonus,
  RARITY_NAMES,
  getMonster,
  getSpell,
  leveledSpell,
  parseSpellLevels,
  blessingSpell,parseBlessings,
  screenToWorld,
  stepMovement,
  worldToScreen,
  type AttackEvent,
  type CastEvent,
  type ChestView,
  type DamageEvent,
  type BuffEvent,
  type DeathEvent,
  type GroundView,
  type TelegraphEvent,
  type ExplodeEvent,
  type GameMap,
  type GameStateView,
  type HealEvent,
  type StatGainEvent,
  type MonsterView,
  type PlayerView,
  type PotionView,
  type ProjEndEvent,
} from '@rod/shared';
import type { AssetStore } from '../assets/store.ts';
import { ambiance, music, MENU_TRACK, zoneTrack } from '../music.ts';
import { PLAYER_COLORS } from '../assets/placeholders.ts';
import type { Hud } from '../ui/Hud.ts';
import { Minimap } from '../ui/Minimap.ts';
import { Details } from '../ui/Details.ts';
import { gameSettings } from '../ui/GameSettings.ts';
import { SpellPreview } from './SpellPreview.ts';
import { ShopPanel } from '../ui/Shop.ts';
import { settings } from '../settings.ts';
import { Controls } from './Controls.ts';
import {MechanicHud} from '../ui/MechanicHud.ts';
import {MovementPrediction} from './Prediction.ts';
import { Effects } from './Effects.ts';
import {installTextureStateRefresh} from './textureState.ts';
import { EntityView } from './EntityView.ts';
import { MapView } from './MapView.ts';

/** Contexte passé à la scène au démarrage. */
export interface GameContext {
  room: Room;
  store: AssetStore;
  hud: Hud;
}

/** Surface de monde visible maximale (px) : au-delà on zoome, pour que les monstres apparaissent hors écran. */
const VIEW_W = 1100;
const VIEW_H = 600;
/** Décalage vertical de la visée : on vise le corps des monstres, pas leurs pieds. */
const AIM_OFFSET_Y = 10;

/** Coiffe et cape équipées d'un joueur (JSON de son état), mémorisées par chaîne. */
const wornCache = new Map<string, [string | undefined, string | undefined, string | undefined]>();
function wornGear(raw: string): [string | undefined, string | undefined, string | undefined] {
  let worn = wornCache.get(raw);
  if (!worn) {
    try { const e = JSON.parse(raw || '{}') as Record<string, { base?: string } | undefined>; worn = [e.coiffe?.base, e.cape?.base, e.familier?.base]; } catch { worn = [undefined, undefined, undefined]; }
    if (wornCache.size > 64) wornCache.clear();
    wornCache.set(raw, worn);
  }
  return worn;
}

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private store!: AssetStore;
  private hud!: Hud;
  private controls!: Controls;
  private effects!: Effects;
  private minimap = new Minimap();
  private details!: Details;
  private shop!: ShopPanel;
  private merchant?: EntityView;
  private preview!: SpellPreview;
  /** Sort dont la zone est affichée (survol de son icône), ou null. */
  private previewSlot: number | null = null;
  /** Dernière direction de visée (normalisée), pour orienter l'aperçu. */
  private aimDir = { x: 1, y: 0 };
  /** Orientation du personnage : sens de déplacement, ou direction du dernier sort pendant un court instant. */
  private facing = 1;
  private castFacingUntil = 0;
  /** Smart cast désactivé : sort en cours de ciblage (zone affichée, en attente du clic) et point visé. */
  private targeting: number | null = null;
  private aimPos = { x: 0, y: 0 };
  /** Après un clic de confirmation, ce bouton ne relance rien tant qu'il n'est pas relâché. */
  private suppressHeld = [false, false, false, false];
  private lastFrameTime = 0;

  private map!: GameMap;
  private mapView?: MapView;
  private players = new Map<string, EntityView>();
  /** Classe affichée par joueur : la vue est recréée si elle change (salon). */
  private playerClass = new Map<string, string>();
  private myClass = '';
  private monsters = new Map<string, EntityView>();
  /** Pièges et glyphes posés au sol. */
  private grounds = new Map<string, { marker: ReturnType<Effects['groundMarker']> }>();
  /** Sorts équipés (tels que synchronisés par le serveur). */
  private mySpells: string[] = [];
  private mySpellsKey = '';
  private myLevelsKey = '';
  private myLevels:Record<string,number> = {};
  private dashCdEnd = 0;
  private chests = new Map<string, { image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite; opened: boolean }>();
  private potions = new Map<string, Phaser.GameObjects.Image>();
  private ogrineViews=new Map<string,Phaser.GameObjects.Text>();
  private cursedZaap?:{image:Phaser.GameObjects.Image;glow:Phaser.GameObjects.Image};
  private zaap?: { image: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image };

  /** Position prédite du joueur local (cases). */
  private me = { x: 0, y: 0 };
  private meReady = false;
  /** Pendant un bond imposé par le serveur, on suit sa position au lieu de prédire. */
  private followServerUntil = 0;

  private lastInput = { dx: 0, dy: 0, dir: -1, autoAttack: false };
  private lastInputAt = 0;
  private cdEnd = [0, 0, 0, 0];
  private cdTotal = [1, 1, 1, 1];
  private lastCastSent = [0, 0, 0, 0];

  private spectating: string | null = null;
  private cam = { x: 0, y: 0, ready: false };
  private mechanicHud!:MechanicHud;
  private prediction=new MovementPrediction();
  private inputSeq=0;
  private dangerWarnings=new Set<Phaser.GameObjects.Graphics>();
  private warningPriority=new WeakSet<Phaser.GameObjects.Graphics>();
  private lastIntermission=false;
  private lastCooldownState='';
  private nextMusicCheck=0;
  private nextAssetCheck=0;
  private nextHudUpdate=0;
  private fpsFrames=0;
  private fpsAt=0;
  private fps=0;
  private ping=-1;
  private nextPing=0;

  constructor(private ctx: GameContext) {
    super('game');
  }

  private get state(): GameStateView {
    return this.room.state as unknown as GameStateView;
  }

  preload(): void {
    this.room = this.ctx.room;
    this.store = this.ctx.store;
    this.hud = this.ctx.hud;
    this.inputSeq=this.state.players.get(this.room.sessionId)?.inputSeq??0;
    const zone=zoneForStage(this.state.stage??1);
    const characters:string[]=[];this.state.players.forEach(p=>characters.push(p.classId));
    this.store.preload(this,[...zone.monsters,zone.boss,'epouvantail','marchand','coffre','coffre_anime','osa_tofu','osa_bouftou','poupee_folle','poupee_bloqueuse','poupee_gonflable'],characters);

    // Écran de chargement : les spritesheets Dofus pèsent quelques Mo.
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, 'Chargement… 0 %', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffb04a', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setScrollFactor(0);
    const progress=(p:number)=>label.setText(`Chargement… ${Math.round(p*100)} %`);
    this.load.on(Phaser.Loader.Events.PROGRESS,progress);
    this.load.once(Phaser.Loader.Events.COMPLETE,()=>{this.load.off(Phaser.Loader.Events.PROGRESS,progress);label.destroy();});
  }

  create(): void {
    this.mechanicHud=new MechanicHud(choice=>{
      const state=this.state,p=state.players.get(this.room.sessionId);
      if(!p?.alive||state.paused||state.phase===PHASE_LOST)return;
      const aim=this.aimPoint();this.room.send('classAction',{tx:aim.x,ty:aim.y,choice});
    },choice=>this.room.send('boon',{choice}));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.mechanicHud.destroy());
    this.store.finalize(this);
    this.cameras.main.setBackgroundColor(0x1a2611);
    this.controls = new Controls(this.game.canvas);
    this.effects = new Effects(this, this.store);
    installTextureStateRefresh(this);
    this.preview = new SpellPreview(this);
    // Accès console en développement (débogage).
    if (import.meta.env.DEV||settings.showPerformance) (window as unknown as { __scene: GameScene }).__scene = this;
    this.details = new Details(
      this.store,
      (slot) => (this.previewSlot = slot),
      (open) => {
        // Le panneau libère la souris : on arrête de bouger et de tirer, et on demande la pause (effective en solo).
        this.controls.releaseAll();
        this.room.send('pause', { paused: open });
      },
    );
    // Réglages en partie : même pause que le panneau de détails (effective en solo seulement).
    const menu = gameSettings();
    menu.onToggle = (open) => { this.controls.releaseAll(); this.room.send('pause', { paused: open }); };
    document.getElementById('details-settings')!.onclick = () => { this.details.toggle(false); menu.toggle(true); };
    this.hud.setSpellHover((slot) => (this.previewSlot = slot));
    this.shop = new ShopPanel(this.store, (index) => this.room.send('buy', { index }),()=>this.room.send('shopReroll'),()=>{this.controls.releaseAll();this.room.send('shopReady');},route=>this.room.send('routeChoice',{route}));

    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.applyZoom();

    // Événements ponctuels envoyés par le serveur.
    this.room.onMessage('pong',(e:{sentAt:number})=>{this.ping=Math.max(0,Math.round(performance.now()-e.sentAt));});
    this.room.onMessage('cast', (e: CastEvent) => this.onCast(e));
    this.room.onMessage('momentum',(e:{player:string;x:number;y:number})=>{if(!document.hidden)this.effects.blessingBurst(e.x,e.y,1,0xffd58a);});
    this.room.onMessage('projEnd', (e: ProjEndEvent) => this.effects.endProjectile(e.id, e.x, e.y));
    this.room.onMessage('explode', (e: ExplodeEvent) => this.onExplode(e));
    this.room.onMessage('spellImpact',(e:{spell:string;x:number;y:number;dx:number;dy:number})=>{if(!document.hidden)this.effects.playSpellFx(e.spell,e.x,e.y,e.dx,e.dy);});
    this.room.onMessage('bounce',(e:{spell:string;x:number;y:number;tx:number;ty:number})=>{if(!document.hidden)this.effects.dashTrail(e.x,e.y,e.tx,e.ty,getSpell(e.spell).color);});
    this.room.onMessage('zoneVictory',(e:{stage:number;revived:string[]})=>{
      this.hud.toast(`<b>Zone ${e.stage} remportée !</b><small>${e.revived.length ? 'Toute l’équipe est de retour. ' : ''}Le Zaap est ouvert.</small>`);
      this.store.playSound(this,'stage');
    });
    this.room.onMessage('runVictory',()=>{this.store.playSound(this,'stage');this.controls.releaseAll();});
    this.room.onMessage('bossWarning',(e:{x:number;y:number;radius:number;duration:number;color:number;kind:string})=>{
      if(document.hidden)return;
      this.effects.telegraph(e.x,e.y,e.radius,e.duration,e.color);
      if(e.kind==='meteor')this.effects.meteor(e.x,e.y,e.duration,e.color);
    });
    this.room.onMessage('bossImpact',(e:{x:number;y:number;radius:number;color:number})=>{
      if(!document.hidden)this.effects.explosion(e.x,e.y,e.radius,e.color);
    });
    this.room.onMessage('merchant',()=>this.hud.toast('<b>Halte marchande</b> — prenez le temps de choisir vos bonus'));
    this.room.onMessage('dmg', (e: DamageEvent) => this.onDamage(e));
    this.room.onMessage('death', (e: DeathEvent) => this.onDeath(e));
    this.room.onMessage('boss', (e: { name: string; challenge?:boolean;rogue?:boolean;cursed?:boolean }) => {
      if(e.cursed){this.hud.toast(`<b style="color:#ff84ad">GARDIEN MAUDIT · ${e.name}</b><small>PV ×2,5 · dégâts ×1,8 · chance de Dofus ×3</small>`);this.store.playSound(this,'boss');return;}
      if(e.rogue){this.hud.toast(`<b style="color:#dfadff">Gardien surprise : ${e.name}</b> — puissance accrue, chances de butin ×3 !`);this.store.playSound(this,'boss');return;}
      this.hud.toast(`<b style="color:#ff6a5a">${e.name}</b> ${e.challenge ? '— défi activé !' : 'garde le Zaap !'}`);
      this.store.playSound(this, 'boss');
    });
    this.room.onMessage('stage', (e: { stage: number }) => {
      this.hud.toast(`<b>Zone ${e.stage} — ${zoneForStage(e.stage).name}</b>`);
      this.store.playSound(this, 'stage');
    });
    this.room.onMessage('heal', (e: HealEvent) => {
      if (!document.hidden) this.effects.floatText(e.x, e.y, `+${e.amount}`, '#6ee67a', 15);
    });
    this.room.onMessage('telegraph', (e: TelegraphEvent) => {
      if (!document.hidden) this.effects.telegraph(e.x, e.y, e.radius, e.duration, getSpell(e.spell).color);
    });
    this.room.onMessage('buff', (e: BuffEvent) => {
      const view = this.players.get(e.target);
      if (view && !document.hidden) this.effects.floatText(view.wx, view.wy - 0.6, e.label, '#ffd84a', 15, 50);
    });
    this.room.onMessage('dash', (e: { id: string; x: number; y: number; tx: number; ty: number; cooldown: number }) => {
      if (!document.hidden) this.effects.dashTrail(e.x, e.y, e.tx, e.ty, 0xffffff);
      if (e.id !== this.room.sessionId) return;
      this.dashCdEnd = this.time.now + e.cooldown;
      this.followServerUntil = this.time.now + 300;
    });
    this.room.onMessage('item', (e: StatGainEvent) => this.onItem(e));
    // Lancer de Pièces (Enutrof) : kamas tombés d'une cible.
    this.room.onMessage('kamas', (e: { amount: number; x: number; y: number }) => {
      if (!document.hidden) this.effects.floatText(e.x, e.y + 0.6, `+${e.amount} K`, '#ffd84a', 12, 22);
    });
    this.room.onMessage('atk', (e: AttackEvent) => this.monsters.get(e.id)?.attack());
    this.room.onMessage('mechanicFx',(e:{player:string;kind:string;x:number;y:number;r:number;tx?:number;ty?:number;color:number})=>{
      if(document.hidden)return;
      if(e.kind==='line'&&e.tx!==undefined&&e.ty!==undefined)this.effects.dashTrail(e.x,e.y,e.tx,e.ty,e.color);
      else if(e.kind==='burst')this.effects.explosion(e.x,e.y,e.r,e.color);
      else this.effects.poof(e.x,e.y,e.color);
    });
    this.room.onMessage('blessingFx',(e:{player:string;kind:string;x:number;y:number;r:number;duration?:number;tx?:number;ty?:number;color:number})=>{
      if(document.hidden)return;
      if(e.kind==='warning')this.effects.telegraph(e.x,e.y,e.r,e.duration??.45,e.color);
      else if(e.kind==='chain'&&e.tx!==undefined&&e.ty!==undefined)this.effects.blessingBolt(e.x,e.y,e.tx,e.ty,e.color);
      else this.effects.blessingBurst(e.x,e.y,e.r,e.color);
    });
    this.room.onMessage('attackWarning',(e:{x:number;y:number;tx:number;ty:number;width:number;duration:number;color:number;priority?:boolean})=>{
      if(document.hidden)return;
      if(this.dangerWarnings.size>=8){const ordinary=[...this.dangerWarnings].find(m=>!this.warningPriority.has(m));if(!ordinary&&!e.priority)return;const oldest=ordinary??this.dangerWarnings.values().next().value!;oldest.destroy();this.dangerWarnings.delete(oldest);}
      const d=Math.hypot(e.tx-e.x,e.ty-e.y)||1,nx=-(e.ty-e.y)/d*(e.width+.2),ny=(e.tx-e.x)/d*(e.width+.2);
      const points=[[e.x+nx,e.y+ny],[e.tx+nx,e.ty+ny],[e.tx-nx,e.ty-ny],[e.x-nx,e.y-ny]].map(([x,y])=>worldToScreen(x,y));
      const marker=this.add.graphics().setDepth(-900000);marker.fillStyle(e.color,.2).lineStyle(2,e.color,.75).fillPoints(points,true).strokePoints(points,true);
      this.dangerWarnings.add(marker);this.time.delayedCall(e.duration*1000,()=>{this.dangerWarnings.delete(marker);marker.destroy();});
      if(e.priority)this.warningPriority.add(marker);
    });

    // Mort : un clic change de joueur observé.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.cycleSpectate());

    const clean=()=>{const menu=gameSettings();menu.onToggle=()=>{};menu.toggle(false);this.effects.clear();this.controls.destroy();this.details.destroy();this.shop.destroy();const debug=window as unknown as {__scene?:GameScene};if(debug.__scene===this)delete debug.__scene;};
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, clean);
    this.events.once(Phaser.Scenes.Events.DESTROY, clean);
  }

  private applyZoom(): void {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.max(width / VIEW_W, height / VIEW_H));
  }

  // -------------------------------------------------------------------------
  // Boucle
  // -------------------------------------------------------------------------

  update(time: number, deltaMs: number): void {
    const state = this.state;
    if (!state || !state.players) return;
    const dt = state.paused ? 0 : Math.min(deltaMs / 1000, 0.1);
    this.tweens.timeScale=state.paused?0:1;
    const wallNow=performance.now();this.fpsFrames++;
    if(!this.fpsAt)this.fpsAt=wallNow;
    if(wallNow-this.fpsAt>=1000){this.fps=Math.round(this.fpsFrames*1000/(wallNow-this.fpsAt));this.fpsFrames=0;this.fpsAt=wallNow;}
    if(settings.showPerformance&&wallNow>=this.nextPing){this.nextPing=wallNow+2000;this.room.send('ping',{sentAt:wallNow});}
    this.hud.performance(this.fps,this.ping,state.monsters.size,settings.showPerformance);

    // La carte est régénérée à partir de la graine (et à chaque nouvelle partie).
    if (!this.mapView || this.map.seed !== state.seed || this.map.zoneId !== zoneForStage(state.stage).id) this.rebuildMap(state.seed);

    this.syncOgrines(state);
    const myState = state.players.get(this.room.sessionId);
    if(time>=this.nextAssetCheck){
    this.nextAssetCheck=time+150;
    const monsterIds:string[]=[];state.monsters.forEach(m=>monsterIds.push(m.type));
    if(state.intermission){const next=zoneForStage(state.stage+1);monsterIds.push(...next.monsters,next.boss);}
    this.store.loadMonsters(this,monsterIds);
    const skins:string[]=[],characters:string[]=[];state.players.forEach(p=>{skins.push(p.skin);characters.push(p.classId);});this.store.loadSkins(this,skins);this.store.loadCharacters(this,characters);
    }
    if(state.intermission!==this.lastIntermission){this.lastIntermission=state.intermission;this.shop.toggle(state.intermission);this.controls.releaseAll();this.targeting=null;}
    if(myState&&myState.cooldowns!==this.lastCooldownState){this.lastCooldownState=myState.cooldowns;try{const cds:number[]=JSON.parse(myState.cooldowns);for(let i=0;i<4;i++)this.cdEnd[i]=i===1&&myState.secondaryMax>1&&myState.secondaryCharges>0?0:time+(cds[i]??0)*1000;this.dashCdEnd=time+(cds[4]??0)*1000;}catch{/* Attend le patch. */}}
    const progressionOpen = ['equipment','talents','encyclopedia'].some(id => !document.getElementById(id)!.classList.contains('hidden'));
    // Tab (ou Échap pour fermer) : panneau de détails.
    if (this.controls.consumePress('Tab') && !progressionOpen) this.details.toggle();
    if (this.controls.consumePress('Escape')) {
      // Échap annule d'abord un ciblage en cours, puis ferme le panneau.
      if (progressionOpen) {
        const top = ['encyclopedia','equipment','talents'].find(id => !document.getElementById(id)!.classList.contains('hidden'));
        if (top) document.getElementById(top)!.classList.add('hidden');
      } else if (this.targeting !== null) this.targeting = null;
      else if (this.shop.isOpen) this.shop.toggle(false);
      else if (this.details.isOpen) this.details.toggle(false);
      // Rien à fermer : Échap ouvre les réglages (la partie se met en pause en solo).
      else gameSettings().toggle(true);
    }
    if (progressionOpen) this.controls.releaseAll();
    // Pendant une pause, les temps de recharge affichés sont figés eux aussi.
    if (state.paused && this.lastFrameTime > 0) for (let i = 0; i < 4; i++) this.cdEnd[i] += time - this.lastFrameTime;
    this.lastFrameTime = time;
    const canAct = !!myState && myState.alive && state.phase !== PHASE_LOST && !progressionOpen && !this.details.isOpen && !gameSettings().isOpen && !this.shop.isOpen && !state.paused && !document.hidden && document.hasFocus();

    if (myState && (myState.classId !== this.myClass || myState.spells !== this.mySpellsKey || myState.spellLevels !== this.myLevelsKey)) {
      // Première frame, changement de classe ou de sorts équipés : la barre de sorts suit.
      this.myClass = myState.classId;
      this.mySpellsKey = myState.spells;
      this.mySpells = myState.spells ? myState.spells.split(',') : getClass(myState.classId).spells;
      this.myLevelsKey=myState.spellLevels;this.myLevels=parseSpellLevels(myState.spellLevels);
      this.hud.setSpells(this.mySpells,this.myLevels);
      this.cdEnd = [0, 0, 0, 0];
    }
    if (myState) this.updateLocalPlayer(time, dt, myState, canAct);
    this.syncPlayers(state, dt);
    this.syncMonsters(state, dt);
    this.syncGrounds(state, time);
    this.syncPotions(state, time);
    const prompt = this.syncZaap(state, canAct) || this.syncMerchant(state, canAct, dt) || this.syncChests(state, myState, canAct);
    this.shop.update(state, this.room.sessionId);
    this.effects.update(dt);
    this.updateCamera(state, myState, dt);
    const watched=myState?.alive ? this.me : state.players.get(this.spectating??'');
    if(watched) this.mapView?.revealPlayer(watched.x,watched.y,dt);

    this.minimap.draw(state, this.room.sessionId);
    this.details.update(state, this.room.sessionId, time);
    // Aperçu de la zone d'effet du sort survolé, depuis la position du joueur dans la direction visée.
    const hovered = this.previewSlot !== null && myState ? this.mySpells[this.previewSlot] : undefined;
    const targeted = this.targeting !== null && myState ? this.mySpells[this.targeting] : undefined;
    if (hovered) this.preview.draw(blessingSpell(leveledSpell(hovered,this.myLevels[hovered]),parseBlessings(myState?.blessings)), this.me.x, this.me.y, this.aimDir.x, this.aimDir.y,undefined,this.hud.playerStats.range);
    else if (targeted) this.preview.draw(blessingSpell(leveledSpell(targeted,this.myLevels[targeted]),parseBlessings(myState?.blessings)), this.me.x, this.me.y, this.aimDir.x, this.aimDir.y, Math.hypot(this.aimPos.x - this.me.x, this.aimPos.y - this.me.y),this.hud.playerStats.range);
    else this.preview.hide();
    this.hud.updateCooldowns(time, this.cdEnd, this.cdTotal);
    if(myState)this.hud.updateCharges(myState.secondaryCharges,myState.secondaryMax);
    this.hud.updateDash(time, this.dashCdEnd);
    if(time>=this.nextHudUpdate){
      this.nextHudUpdate=time+100;
      this.hud.update(state, this.room.sessionId, myState && !myState.alive ? this.spectating : null, prompt);
      this.mechanicHud.update(state,this.room.sessionId);
    }
    this.updateMusic(state, time);
  }

  /**
   * Musique de la zone en cours, celle de combat tant que son gardien est en vie, celle du menu au salon.
   * L'ambiance (bruits de la zone) ne joue que pendant la partie.
   */
  private updateMusic(state: GameStateView, time: number): void {
    if (time < this.nextMusicCheck) return;
    this.nextMusicCheck = time + 500;
    if (state.phase === PHASE_LOBBY || state.phase === PHASE_LOST) { music.play(MENU_TRACK); ambiance.play(''); return; }
    const zone = zoneForStage(state.stage).id;
    ambiance.play(zoneForStage(state.stage).ambiance??zone);
    let bossFight = false;
    state.monsters.forEach((m: MonsterView) => { if (!m.ally && getMonster(m.type).boss) bossFight = true; });
    music.play(zoneTrack(zone, bossFight));
  }

  private rebuildMap(seed: number): void {
    for(const view of this.monsters.values())view.destroy();this.monsters.clear();
    const zone=zoneForStage(this.state.intermission?this.state.stage+1:this.state.stage),keep=[...zone.monsters,zone.boss,'epouvantail','marchand','coffre','coffre_anime','osa_tofu','osa_bouftou','poupee_folle','poupee_bloqueuse','poupee_gonflable'];
    this.state.monsters.forEach(m=>keep.push(m.type));this.store.releaseMonsters(this,keep);this.store.loadMonsters(this,keep);
    this.mapView?.destroy();
    this.map = generateMap(seed,undefined,this.state.stage);
    this.mapView = new MapView(this, this.store, this.map,this.state.cursed);
    this.minimap.setMap(this.map);
    this.effects.clear();
    // Nouvelle partie : on repart de la position serveur et les sorts sont de nouveau prêts.
    this.meReady = false;
    this.cam.ready = false;
    this.cdEnd = [0, 0, 0, 0];
    this.dashCdEnd=0;
    this.prediction.reset();
    this.lastCooldownState='';
  }

  /** Point visé par la souris, en coordonnées monde. */
  private aimPoint(): { x: number; y: number } {
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    return screenToWorld(pointer.worldX, pointer.worldY + AIM_OFFSET_Y);
  }

  private updateLocalPlayer(time: number, dt: number, s: PlayerView, canAct: boolean): void {
    if(this.prediction.acknowledge(s.inputSeq,s.positionTime,s.motionEpoch))this.meReady=false;
    if (!this.meReady) {
      this.me.x = s.x;
      this.me.y = s.y;
      this.meReady = true;
    }
    const move = canAct ? this.controls.moveDir() : { x: 0, y: 0 };
    const aim = this.aimPoint();
    this.aimPos = aim;
    // La visée n'est mise à jour que si la souris est sur le jeu (pas sur le HUD).
    const overCanvas = (this.input.activePointer.event?.target as HTMLElement | undefined)?.tagName === 'CANVAS';
    const aimLen = Math.hypot(aim.x - this.me.x, aim.y - this.me.y);
    if (overCanvas && aimLen > 0.2) this.aimDir = { x: (aim.x - this.me.x) / aimLen, y: (aim.y - this.me.y) / aimLen };

    // Orientation : le personnage regarde où il marche ; seul un sort le tourne (brièvement) vers la visée.
    const moving = move.x !== 0 || move.y !== 0;
    if (time >= this.castFacingUntil && moving) this.facing = dirFromVector(move.x, move.y);
    const dir = this.facing;

    // Envoi des entrées : seulement quand elles changent, plus un rappel périodique.
    const autoAttack = canAct && !this.state.intermission && settings.autoAttack && this.targeting === null && !this.controls.isHeld(0) && !this.suppressHeld[0];
    const changed = move.x !== this.lastInput.dx || move.y !== this.lastInput.dy || dir !== this.lastInput.dir || autoAttack !== this.lastInput.autoAttack;
    if ((changed && time - this.lastInputAt > 16) || (moving && time-this.lastInputAt>33) || time - this.lastInputAt > 500) {
      this.lastInput = { dx: move.x, dy: move.y, dir, autoAttack };
      this.lastInputAt = time;
      this.room.send('input', {...this.lastInput,seq:++this.inputSeq});
    }

    // Prédiction : on applique tout de suite le même déplacement que le serveur...
    const predicting=canAct&&!s.forcedMotion&&time>=this.followServerUntil;
    if(predicting){stepMovement(this.map,this.me,move.x,move.y,s.speed,dt,PLAYER_RADIUS);this.prediction.add(this.inputSeq,move.x,move.y,s.speed,dt);}
    const target=predicting?this.prediction.replay(this.map,{x:s.x,y:s.y}):{x:s.x,y:s.y};
    // ...puis on corrige en douceur vers la position qui fait autorité.
    const ex = target.x - this.me.x;
    const ey = target.y - this.me.y;
    const err = Math.hypot(ex, ey);
    if (err > 3 || !canAct) {
      this.me.x = s.x;
      this.me.y = s.y;
    } else if (err > 0.001) {
      const rate = time < this.followServerUntil ? 25 : moving ? 3 : 10;
      const k = 1 - Math.exp(-rate * dt);
      this.me.x += ex * k;
      this.me.y += ey * k;
    }

    if (!canAct) {
      this.targeting = null;
      this.controls.releaseAll();
      return;
    }
    if(this.state.intermission){this.targeting=null;return;}
    if(this.controls.consumePress('KeyF'))this.room.send('classAction',{tx:aim.x,ty:aim.y,choice:0});

    // Dash (Maj), commun à toutes les classes.
    if ((this.controls.consumePress('ShiftLeft') || this.controls.consumePress('ShiftRight')) && time >= this.dashCdEnd) {
      const d = moving ? move : this.aimDir;
      this.room.send('dash', { dx: d.x, dy: d.y });
    }

    // Smart cast désactivé : la touche d'un sort ouvre le ciblage, le clic gauche confirme, le clic droit annule.
    if (!settings.smartCast) {
      for (const slot of [2, 3]) {
        if (!this.controls.consumeKeySlot(slot)) continue;
        this.targeting = this.targeting === slot ? null : slot;
      }
      if (this.targeting !== null) {
        if (this.controls.consumeMouse(0)) {
          if (time >= this.cdEnd[this.targeting]) this.castSlot(time, this.targeting, aim);
          this.targeting = null;
          this.suppressHeld[0] = true;
        } else if (this.controls.consumeMouse(2)) {
          this.targeting = null;
          this.suppressHeld[1] = true;
        }
      }
    }
    this.controls.consumeMouse(0);
    this.controls.consumeMouse(2);
    for (let slot = 0; slot < 2; slot++) if (!this.controls.isHeld(slot)) this.suppressHeld[slot] = false;

    // Sorts : une touche maintenue relance dès que le sort est prêt.
    for (let slot = 0; slot < 4; slot++) {
      if (!this.controls.isHeld(slot) || this.suppressHeld[slot]) continue;
      if (!settings.smartCast && this.controls.isKeyboardSlot(slot)) continue;
      if (this.targeting !== null && slot < 2) continue;
      if ((time < this.cdEnd[slot] && !(slot===1&&s.secondaryMax>1&&s.secondaryCharges>0)) || time - this.lastCastSent[slot] < 120) continue;
      this.castSlot(time, slot, aim);
    }
    if (settings.smartCast) for (const slot of [2, 3]) this.controls.consumeKeySlot(slot);
  }

  /** Envoie un sort au serveur et tourne le personnage vers la cible le temps de l'animation. */
  private castSlot(time: number, slot: number, target: { x: number; y: number }): void {
    this.lastCastSent[slot] = time;
    this.room.send('cast', { slot, tx: target.x, ty: target.y });
    this.facing = dirFromVector(target.x - this.me.x, target.y - this.me.y);
    this.castFacingUntil = time + 400;
  }

  private syncPlayers(state: GameStateView, dt: number): void {
    const myId = this.room.sessionId;
    state.players.forEach((p: PlayerView, id: string) => {
      let view = this.players.get(id);
      if (view && (this.playerClass.get(id) !== p.classId||view.assetKey!==this.store.character(this,p.classId,p.slot,p.skin).key)) {
        view.destroy();
        view = undefined;
      }
      if (!view) {
        this.playerClass.set(id, p.classId);
        const color = PLAYER_COLORS[p.slot % PLAYER_COLORS.length];
        view = new EntityView(this, this.store, this.store.character(this, p.classId, p.slot,p.skin), p.x, p.y, {
          label: p.name,
          labelColor: id === myId ? '#ffe9a8' : '#ffffff',
          barWidth: 34,
          barColor: color,
          barAlways: true,
        });
        this.players.set(id, view);
      }
      if (id === myId) {
        view.setPosition(this.me.x, this.me.y);
        view.moving = p.alive && (this.lastInput.dx !== 0 || this.lastInput.dy !== 0);
        // Le joueur local regarde toujours sa souris, sans attendre le serveur.
        view.dir = p.alive ? this.facing : p.dir;
      } else {
        view.setTarget(p.x, p.y);
        view.moving = p.moving;
        view.dir = p.dir;
      }
      view.setHp(p.hp, p.maxHp);
      view.setShield(p.shield, p.maxHp);
      view.setDead(!p.alive);
      view.setInvisible(p.invisible);
      // Apparence : la coiffe et la cape équipées sont portées en jeu, synchronisées par l'état du joueur.
      const [head, back, pet] = wornGear(p.equipment);
      view.setGear(head, back);
      view.setPet(this.petTexture(pet));
      view.update(dt);
    });
    for (const [id, view] of this.players) {
      if (state.players.get(id)) continue;
      view.destroy();
      this.players.delete(id);
    }
  }

  private syncMonsters(state: GameStateView, dt: number): void {
    const hero=worldToScreen(this.me.x,this.me.y),alive=state.players.get(this.room.sessionId)?.alive;
    state.monsters.forEach((m: MonsterView, id: string) => {
      let view = this.monsters.get(id);
      if(view&&view.assetKey!==this.store.monster(this,m.type).key){view.destroy();this.monsters.delete(id);view=undefined;}
      if (!view) {
        const visual = this.store.monster(this, m.type);
        if (m.elite) visual.scale *= 1.6;
        if(m.cursed)visual.scale*=1.3;
        view = new EntityView(this, this.store, visual, m.x, m.y, {
          barWidth: getMonster(m.type).boss || m.elite ? 70 : 30,
          barColor: m.ally ? 0x4ad04a : m.elite ? 0xf0b030 : 0xd83a2a,
          barAlways: m.ally || m.elite,
          label: m.elite ? `${getMonster(m.type).name} d'élite` : undefined,
          labelColor: '#ffcf6e',
        });
        this.monsters.set(id, view);
      }
      // Sens du déplacement déduit de la position visée (pas de champ « moving » synchronisé).
      view.moving = Math.hypot(m.x - view.wx, m.y - view.wy) > 0.02;
      view.setTarget(m.x, m.y);
      view.dir = m.dir;
      if(m.carried)view.setPosition(m.x,m.y-.7);
      view.setHp(m.hp, m.maxHp);
      view.setRogue(m.rogue,m.cursed);
      view.setWarning(m.state === MSTATE_WINDUP);
      view.update(dt);
      view.revealPlayer(hero.x,hero.y,!!alive&&!m.ally);
    });
    for (const [id, view] of this.monsters) {
      if (state.monsters.get(id)) continue;
      view.destroy();
      this.monsters.delete(id);
    }
  }

  /** Pièges et glyphes : un marqueur au sol par objet synchronisé. */
  private syncGrounds(state: GameStateView, time: number): void {
    state.grounds.forEach((g: GroundView, id: string) => {
      let view = this.grounds.get(id);
      if (!view) {
        view = { marker: this.effects.groundMarker(g.x, g.y, g.radius, getSpell(g.spell).color, g.kind) };
        this.grounds.set(id, view);
      }
      view.marker.setArmed(g.armed);
      view.marker.update(time);
    });
    for (const [id, view] of this.grounds) {
      if (state.grounds.get(id)) continue;
      view.marker.destroy();
      this.grounds.delete(id);
    }
  }

  /** Potions synchronisées : icône officielle de soin Retro flottant au-dessus du sol. */
  private syncPotions(state: GameStateView, time: number): void {
    state.potions.forEach((potion: PotionView, id: string) => {
      let image = this.potions.get(id);
      if (!image) {
        const v = this.store.potionVisual(this);
        image = this.add.image(0, 0, v.key).setOrigin(0.5, 1).setScale(24 / this.textures.get(v.key).getSourceImage().height);
        this.potions.set(id, image);
      }
      const p = worldToScreen(potion.x, potion.y);
      image.setPosition(p.x, p.y - 3 - Math.sin(time / 220) * 2).setDepth(p.y + 0.1);
    });
    for (const [id, image] of this.potions) {
      if (state.potions.get(id)) continue;
      image.destroy();
      this.potions.delete(id);
    }
  }

  /** Affiche le Zaap de la zone ; retourne le texte d'aide si le joueur est à portée. */
  private syncOgrines(state:GameStateView):void {
    state.ogrines.forEach((drop,id)=>{if(drop.owner!==this.room.sessionId)return;let text=this.ogrineViews.get(id);if(!text){text=this.add.text(0,0,'1 Ogrine',{fontFamily:'Georgia',fontSize:'13px',color:'#ffe2a8',stroke:'#27141d',strokeThickness:4}).setOrigin(.5,1);this.ogrineViews.set(id,text);}const p=worldToScreen(drop.x,drop.y);text.setPosition(p.x,p.y-15).setDepth(p.y+2);});
    for(const[id,text]of this.ogrineViews)if(!state.ogrines.get(id)){text.destroy();this.ogrineViews.delete(id);}
  }

  private syncZaap(state: GameStateView, canAct: boolean): string {
    const red=state.phase===PHASE_PLAYING&&!state.intermission&&state.hasCursedZaap;
    if(red&&!this.cursedZaap){const v=this.store.objectVisual('zaap',0);this.cursedZaap={image:this.add.image(0,0,v.key).setOrigin(v.origin[0],v.origin[1]).setScale(v.scale).setTint(0xff557b),glow:this.add.image(0,0,'ph_glow').setTint(0xff184c).setBlendMode(Phaser.BlendModes.ADD)};}
    this.cursedZaap?.image.setVisible(red);this.cursedZaap?.glow.setVisible(red);
    if(red&&this.cursedZaap){const p=worldToScreen(state.cursedZaapX,state.cursedZaapY);this.cursedZaap.image.setPosition(p.x,p.y).setDepth(p.y);this.cursedZaap.glow.setPosition(p.x,p.y-50).setDepth(p.y+1).setScale(3+Math.sin(this.time.now/200)*.3).setAlpha(.8);
      if(canAct&&Math.hypot(state.cursedZaapX-this.me.x,state.cursedZaapY-this.me.y)<=ZAAP_RANGE){if(this.controls.consumePress('KeyE'))this.room.send('interact');return '<b>E</b> — Zaap maudit : gardiens renforcés, chance de Dofus ×3 · emmène toute l’équipe';}
    }
    if(state.intermission){this.zaap?.image.setVisible(false);this.zaap?.glow.setVisible(false);return '';}
    const visible = state.phase === PHASE_PLAYING;
    if (!visible) {
      this.zaap?.image.setVisible(false);
      this.zaap?.glow.setVisible(false);
      return '';
    }
    if (!this.zaap) {
      const v = this.store.objectVisual('zaap', 0);
      const image = this.add.image(0, 0, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale);
      const glow = this.add.image(0, 0, 'ph_glow').setTint(0x4aa8ff).setBlendMode(Phaser.BlendModes.ADD);
      this.zaap = { image, glow };
    }
    const p = worldToScreen(state.zaapX, state.zaapY);
    const { image, glow } = this.zaap;
    image.setVisible(true).setPosition(p.x, p.y).setDepth(p.y);
    // Éteint tant qu'il n'est pas activé, puis de plus en plus lumineux.
    image.setTint(state.zaapState === ZAAP_IDLE ? 0x8a8a9a : 0xffffff);
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.12;
    const power = state.zaapState === ZAAP_READY ? 1.3 : state.zaapCharge;
    glow.setVisible(state.zaapState !== ZAAP_IDLE).setPosition(p.x, p.y - 50).setDepth(p.y + 1).setScale((1.5 + power * 3) * pulse).setAlpha(0.5 + power * 0.4);

    const near = Math.hypot(state.zaapX - this.me.x, state.zaapY - this.me.y) <= ZAAP_RANGE;
    if (!canAct || !near) return '';
    if (state.zaapState === ZAAP_CHARGING) return '';
    // La touche est consommée ici : un coffre voisin ne s'ouvrira pas par erreur.
    if (this.controls.consumePress('KeyE')) this.room.send('interact');
    return state.zaapState === ZAAP_IDLE ? '<b>E</b> — Activer le Zaap (son gardien apparaîtra)' : '<b>E</b> — Partir pour la zone suivante';
  }

  /**
   * Affiche les coffres et gère l'interaction (touche E).
   * Retourne le texte d'aide à afficher si un coffre est à portée.
   */
  private syncChests(state: GameStateView, myState: PlayerView | undefined, canAct: boolean): string {
    let nearestChest = Infinity;
    let nearestChallenge = Infinity;
    const chestSprite = this.store.chestSprite(this);
    state.chests.forEach((c: ChestView, id: string) => {
      let view = this.chests.get(id);
      const challenge = c.kind === 'challenge';
      if (!challenge && chestSprite && (!view || view.opened !== c.opened)) {
        // Coffre animé : on garde le même sprite, l'ouverture joue l'animation de « mort » (il crache ses pièces).
        if (!view) {
          const p = worldToScreen(c.x, c.y);
          const sprite = this.add.sprite(p.x, p.y, chestSprite.key).setOrigin(chestSprite.origin[0], chestSprite.origin[1]).setScale(chestSprite.scale).setDepth(p.y);
          view = { image: sprite, opened: false };
          this.chests.set(id, view);
        }
        const anim = this.store.resolveAnim(this, chestSprite, c.opened ? 'death' : 'idle', 1);
        if (anim) (view.image as Phaser.GameObjects.Sprite).setFlipX(anim.flipX).play(anim.key);
        view.opened = c.opened;
      } else if (!view || view.opened !== c.opened) {
        view?.image.destroy();
        const v = this.store.objectVisual(challenge ? 'balise_defi' : c.opened ? 'coffre_ouvert' : 'coffre', 0);
        const p = worldToScreen(c.x, c.y);
        const image = this.add.image(p.x, p.y, v.key).setOrigin(v.origin[0], v.origin[1]).setScale(v.scale).setDepth(p.y);
        if(challenge) image.setTint(0xffd9ab);
        if (c.opened) image.setAlpha(challenge ? 0.3 : 0.75);
        view = { image, opened: c.opened };
        this.chests.set(id, view);
      }
      if (c.opened) return;
      const d = Math.hypot(c.x - this.me.x, c.y - this.me.y);
      if (challenge) nearestChallenge = Math.min(nearestChallenge, d);
      else nearestChest = Math.min(nearestChest, d);
    });
    for (const [id, view] of this.chests) {
      if (state.chests.get(id)) continue;
      view.image.destroy();
      this.chests.delete(id);
    }

    const pressed = this.controls.consumePress('KeyE');
    if (!canAct || !myState || state.phase !== PHASE_PLAYING) return '';
    if (nearestChallenge <= INTERACT_RANGE && nearestChallenge <= nearestChest) {
      if (pressed) this.room.send('interact');
      return `<b>E</b> — Balise de défi : vaincre un élite pour choisir une bénédiction parmi trois`;
    }
    if (nearestChest > INTERACT_RANGE) return '';
    const affordable = myState.kamas >= state.chestCost;
    if (pressed && affordable) this.room.send('interact');
    return affordable
      ? `<b>E</b> — Ouvrir le coffre (${state.chestCost} K)`
      : `Coffre : ${state.chestCost} K <span class="missing">(il vous manque ${state.chestCost - myState.kamas} K)</span>`;
  }

  /** Marchand de la zone : PNJ immobile ; E ouvre sa boutique. */
  private syncMerchant(state: GameStateView, canAct: boolean, dt: number): string {
    const present = state.phase === PHASE_PLAYING && state.merchantX > 0 && !!state.shop;
    if (!present) {
      this.merchant?.destroy();
      this.merchant = undefined;
      if (this.shop.isOpen) this.shop.toggle(false);
      return '';
    }
    if (!this.merchant) {
      this.merchant = new EntityView(this, this.store, this.store.monster(this, 'marchand'), state.merchantX, state.merchantY, {
        label: 'Marchand',
        labelColor: '#ffcf6e',
        barWidth: 0,
        barColor: 0,
        barAlways: false,
      });
    }
    this.merchant.setPosition(state.merchantX, state.merchantY);
    this.merchant.update(dt);
    const near = state.intermission || Math.hypot(state.merchantX - this.me.x, state.merchantY - this.me.y) <= 2.5;
    if (!near) {
      if (this.shop.isOpen) this.shop.toggle(false);
      return '';
    }
    if (canAct && this.controls.consumePress('KeyE')) {
      this.controls.releaseAll();
      this.shop.toggle(true);
    }
    return '<b>E</b> — Parler au marchand';
  }

  // -------------------------------------------------------------------------
  // Caméra et mode spectateur
  // -------------------------------------------------------------------------

  private cycleSpectate(): void {
    const state = this.state;
    const me = state?.players?.get(this.room.sessionId);
    if (!me || me.alive) return;
    const alive: string[] = [];
    state.players.forEach((p: PlayerView, id: string) => {
      if (p.alive) alive.push(id);
    });
    if (alive.length === 0) return;
    const i = this.spectating ? alive.indexOf(this.spectating) : -1;
    this.spectating = alive[(i + 1) % alive.length];
  }

  private updateCamera(state: GameStateView, myState: PlayerView | undefined, dt: number): void {
    let target = { x: this.me.x, y: this.me.y };
    if (myState && !myState.alive) {
      // Mort : la caméra suit un coéquipier vivant.
      const current = this.spectating ? state.players.get(this.spectating) : undefined;
      if (!current || !current.alive) {
        this.spectating = null;
        this.cycleSpectate();
      }
      const view = this.spectating ? this.players.get(this.spectating) : undefined;
      if (view) target = { x: view.wx, y: view.wy };
    } else {
      this.spectating = null;
    }

    const p = worldToScreen(target.x, target.y);
    p.y -= 20;
    if (!this.cam.ready) {
      this.cam.x = p.x;
      this.cam.y = p.y;
      this.cam.ready = true;
    } else {
      const k = 1 - Math.exp(-10 * dt);
      this.cam.x += (p.x - this.cam.x) * k;
      this.cam.y += (p.y - this.cam.y) * k;
    }
    this.cameras.main.centerOn(this.cam.x, this.cam.y);
  }

  // -------------------------------------------------------------------------
  // Événements serveur
  // -------------------------------------------------------------------------

  private onCast(e: CastEvent): void {
    // Onglet en arrière-plan : la boucle de rendu est en pause, on n'empile pas d'effets.
    if (!document.hidden) this.effects.spawnProjectile(e);
    const spell = leveledSpell(e.spell,e.level);
    // Animation officielle Dofus : sur le lanceur pour les bonus (type 10), au point visé sinon.
    // Les projectiles l'ont déjà en vol (clip « move ») ; les zones à retardement la jouent à l'impact.
    // Pièges : l'animation joue quand ils se déclenchent (événement « explode »), pas à la pose.
    if (!document.hidden && !spell.projectile && !spell.delay && spell.ground?.kind !== 'trap') {
      const onCaster = this.store.spellFx(this, spell.id)?.type === 10 || !!spell.buff || !!spell.shield || !!spell.melee;
      this.effects.playSpellFx(spell.id, onCaster ? e.x : e.tx, onCaster ? e.y : e.ty, e.tx - e.x, e.ty - e.y);
    }
    // Bond : traînée le long du trajet (vu par tout le monde).
    const dash = spell.effects?.find((f) => f.type === 'dash');
    if (dash && dash.type === 'dash' && !document.hidden) {
      const len = Math.hypot(e.tx - e.x, e.ty - e.y) || 1;
      const sign = dash.direction === 'back' ? -1 : 1;
      this.effects.dashTrail(e.x, e.y, e.x + ((e.tx - e.x) / len) * dash.distance * sign, e.y + ((e.ty - e.y) / len) * dash.distance * sign, spell.color);
    }
    (this.players.get(e.caster) ?? this.monsters.get(e.caster))?.attack(this.store.spellFx(this,spell.id)?.casterAnim??0);
    // Téléportation : traînée entre le départ et l'arrivée ; invocation : petit nuage.
    if (spell.teleport && !document.hidden) this.effects.dashTrail(e.x, e.y, e.tx, e.ty, spell.color);
    if (spell.summon && !document.hidden) this.effects.poof(e.tx, e.ty, spell.color);
    if (spell.teleport && e.caster === this.room.sessionId) this.followServerUntil = this.time.now + 300;

    if (e.caster !== this.room.sessionId || e.slot === undefined) return;
    // Le serveur confirme notre sort : le temps de recharge démarre.
    const now = this.time.now;
    if (Math.hypot(e.tx - e.x, e.ty - e.y) > 0.001) this.facing = dirFromVector(e.tx - e.x, e.ty - e.y);
    this.castFacingUntil = now + 400;
    this.cdTotal[e.slot] = e.cooldown ?? spell.cooldown;
    this.cdEnd[e.slot] = now + this.cdTotal[e.slot];
    if (dash && dash.type === 'dash') this.followServerUntil = now + dash.duration * 1000 + 180;
  }

  private onExplode(e: ExplodeEvent): void {
    if (document.hidden) return;
    if(e.spell==='impulsion_classe')return; // L'effet de classe fournit sa propre couleur.
    const spell = getSpell(e.spell);
    const original=!!this.store.spellFx(this,spell.id)?.main;
    if(!original)this.effects.explosion(e.x, e.y, e.radius, spell.color);
    // Zones à retardement et impacts de projectiles explosifs : l'animation officielle joue à l'impact.
    if (spell.delay || spell.projectile || spell.ground?.kind === 'trap') this.effects.playSpellFx(spell.id, e.x, e.y);
    if (spell.heal) {
      this.effects.healBurst(e.x, e.y, e.radius);
      return;
    }
    // Pas de colonne de lumière ni de secousse pour les petites zones répétées (attaque de base du Sacrieur...).
    const big = e.radius >= 2.5 && spell.cooldown >= 3000;
    if (spell.zone && big && !original) this.effects.beam(e.x, e.y, spell.color);
    // Secousse légère, seulement pour les grosses explosions proches.
    const d = Math.hypot(e.x - this.me.x, e.y - this.me.y);
    if (big && d < 10) this.shake(140, 0.0035 * (1 - d / 10));
  }

  /**
   * Compagnon : l'icône du familier équipé flotte à côté du joueur. Chargée à la demande ;
   * renvoie la clé de texture une fois prête.
   */
  private petTexture(base?: string): string | undefined {
    if (!base) return;
    const key = `pet_${base}`;
    if (this.textures.exists(key)) return key;
    const url = this.store.itemIconUrl(base);
    if (url && !this.load.textureManager.exists(key) && !this.load.isLoading()) { this.load.image(key, url); this.load.start(); }
    return;
  }
  private shakeUntil = 0;
  /**
   * Secousse de caméra selon le réglage. Une seule à la fois, et un temps mort après chacune :
   * sous une pluie de coups, l'écran ne tremble plus en continu.
   */
  private shake(duration: number, intensity: number): void {
    const factor = { off: 0, light: 0.5, normal: 1 }[settings.screenShake];
    if (!factor || this.time.now < this.shakeUntil) return;
    this.shakeUntil = this.time.now + duration + 350;
    this.cameras.main.shake(duration, intensity * factor);
  }

  private onDamage(e: DamageEvent): void {
    if (document.hidden) return;
    if (e.player) {
      if (e.absorbed) this.effects.floatText(e.x, e.y, `-${e.absorbed} bouclier`, '#69cfff', 13, 50,e.target===this.room.sessionId);
      if (e.amount <= 0) return;
      this.players.get(e.target)?.flash();
      this.effects.floatText(e.x, e.y, `-${e.amount}`, '#ff5040', 15,34,e.target===this.room.sessionId);
      if (e.target === this.room.sessionId) {
        this.hud.hitFlash();
        this.shake(70, 0.0007);
        this.store.playSound(this, 'player_hit');
        // Un coup ordinaire garde la prediction. Les reculs sont signales par forcedMotion/motionEpoch.
      }
    } else {
      this.monsters.get(e.target)?.flash();
      if (e.crit) {
        this.effects.floatText(e.x, e.y, `${e.amount} !`, '#ffb020', 19, 44);
        this.store.playSound(this, 'crit', 0.4);
      }
      else this.effects.floatText(e.x, e.y, String(e.amount), '#ffffff', 13);
      this.store.playSound(this, 'hit', 0.3);
    }
  }

  private onItem(e: StatGainEvent): void {
    const item = getRunBonus(e.item);
    if (!item || document.hidden) return;
    const mine = e.player === this.room.sessionId;
    const color = `#${item.color.toString(16).padStart(6, '0')}`;
    const label = runBonusText(item,{stage:this.state.stage,zoneWave:this.state.zoneWave,mode:this.state.mode});
    this.effects.floatText(e.x, e.y, label, color, mine ? 16 : 12, 60);
    this.effects.spark(worldToScreen(e.x, e.y).x, worldToScreen(e.x, e.y).y - 20, item.color);
    if (mine) {
      this.hud.toast(`<b>Bonus de run</b><small>${label} · ${RARITY_NAMES[item.rarity]}</small>`);
      this.store.playSound(this, 'item');
    }
  }

  private onDeath(e: DeathEvent): void {
    if (document.hidden) return;
    if (e.player) {
      this.effects.poof(e.x, e.y, 0xffffff);
      return;
    }
    const m = this.state.monsters.get(e.id);
    this.effects.poof(e.x, e.y, m ? getMonster(m.type).color : 0xffffff);
    if (e.kamas) this.effects.floatText(e.x, e.y + 0.6, `+${e.kamas} K`, '#ffd84a', 12, 22);
  }
}
