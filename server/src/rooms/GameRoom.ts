// Salle de jeu : une partie = une salle, identifiée par un code court.
// La salle ne fait que relayer : toute la logique est dans game/Simulation.ts.
import { Room, type Client } from '@colyseus/core';
import { MAX_PLAYERS, NAME_MAX_LENGTH, PATCH_MS, ROOM_CODE_LENGTH, TICK_RATE, type CastMessage, type InputMessage } from '@rod/shared';
import { Simulation } from '../game/Simulation.ts';
import { GameState } from '../state.ts';
import {authenticate,recordScore,cloudScoresEnabled} from '../cloud.ts';
import type {RunReward} from '@rod/shared';

/** Codes des parties en cours, pour éviter les doublons. */
const activeCodes = new Set<string>();
// Pas de I ni de O : trop faciles à confondre avec 1 et 0.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!activeCodes.has(code)) return code;
  }
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return name || 'Aventurier';
}

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();
  private sim!: Simulation;
  private accounts=new Map<string,string>();
  private pausedForReconnect=false;
  async onAuth(_client:Client,options:{accessToken?:unknown}) {return await authenticate(options?.accessToken)??true;}

  onCreate(options?: { singlePlayer?: boolean }): void {
    if (options?.singlePlayer === true) { this.maxClients = 1; this.state.singlePlayer=true; }
    // Le code court sert directement d'identifiant de salle : le client rejoint avec joinById(code).
    this.roomId = generateCode();
    activeCodes.add(this.roomId);
    // Un client bavard (ou bogué) est déconnecté plutôt que de saturer la salle.
    this.maxMessagesPerSecond = 120;

    this.sim = new Simulation(this.state, (type, message) => {
      this.broadcast(type,message);
      if(type==='runReward'){
        const result=message as {player:string;reward:RunReward},userId=this.accounts.get(result.player),run=result.reward.summary;
        if(userId&&run)void this.saveScore(userId,result.player,run);
      }
    });
    this.setPatchRate(PATCH_MS);
    this.setSimulationInterval((deltaMs) => this.sim.update(deltaMs / 1000), 1000 / TICK_RATE);

    this.onMessage('ping',(client:Client,message:{sentAt?:unknown})=>{if(typeof message?.sentAt==='number'&&Number.isFinite(message.sentAt))client.send('pong',{sentAt:message.sentAt});});
    this.onMessage('routeChoice',(client:Client,message:{route?:unknown})=>this.sim.chooseRoute(client.sessionId,message?.route));
    this.onMessage('blessing',(client:Client,message:{blessing?:unknown})=>this.sim.setBlessing(client.sessionId,message?.blessing));
    this.onMessage('input', (client: Client, message: InputMessage) => this.sim.setInput(client.sessionId, message));
    this.onMessage('cast', (client: Client, message: CastMessage) => this.sim.playerCast(client.sessionId, message));
    this.onMessage('class', (client: Client, message: { classId?: string; spells?: string[] }) => this.sim.setClass(client.sessionId, message?.classId, message?.spells));
    this.onMessage('loadout', (client: Client, message: { spells?: string[] }) => this.sim.setLoadout(client.sessionId, message?.spells));
    this.onMessage('dash', (client: Client, message: { dx?: number; dy?: number }) => this.sim.playerDash(client.sessionId, message));
    this.onMessage('pause', (client: Client, message: { paused?: boolean }) => this.sim.setPaused(client.sessionId, message?.paused));
    this.onMessage('equipment', (client: Client, message: { equipment?: unknown }) => this.sim.setEquipment(client.sessionId, message?.equipment));
    this.onMessage('buy', (client: Client, message: { index?: number }) => this.sim.buy(client.sessionId, message?.index));
    this.onMessage('shopReroll',(client:Client)=>this.sim.rerollShop(client.sessionId));
    this.onMessage('shopReady',(client:Client)=>this.sim.shopReady(client.sessionId));
    this.onMessage('mode', (client: Client, message: { mode?: number }) => this.sim.setMode(client.sessionId, message?.mode));
    this.onMessage('interact', (client: Client) => this.sim.interact(client.sessionId));
    this.onMessage('boon',(client:Client,message:{choice?:unknown})=>this.sim.chooseBoon(client.sessionId,message?.choice));
    this.onMessage('classAction',(client:Client,message:{tx?:unknown;ty?:unknown;choice?:unknown})=>this.sim.classAction(client.sessionId,message));
    this.onMessage('start', (client: Client) => {
      if (client.sessionId === this.state.hostId) this.sim.start();
    });
    this.onMessage('restart', () => this.sim.restart());

    console.log(`[salle ${this.roomId}] créée`);
  }

  onJoin(client: Client, options?: { name?: string; classId?: string; spells?: string[]; equipment?: unknown; blessing?:unknown },auth?:{userId?:string}|boolean): void {
    if(auth&&typeof auth==='object'&&auth.userId)this.accounts.set(client.sessionId,auth.userId);
    client.send('cloudStatus',{ranked:this.accounts.has(client.sessionId)&&cloudScoresEnabled});
    const name = cleanName(auth&&typeof auth==='object'&&'name' in auth?auth.name:options?.name);
    this.sim.addPlayer(client.sessionId, name, typeof options?.classId === 'string' ? options.classId : undefined, options?.spells, options?.equipment, options?.blessing);
    this.sim.players.get(client.sessionId)!.state.rankStatus=this.accounts.has(client.sessionId)&&cloudScoresEnabled?'ready':'disabled';
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[salle ${this.roomId}] ${name} a rejoint (${this.state.players.size}/${this.maxClients})`);
  }

  private async saveScore(userId:string,playerId:string,run:import('@rod/shared').RunSummary):Promise<void>{
    const p=this.sim.players.get(playerId);if(p)p.state.rankStatus='pending';
    let error:unknown;
    for(let attempt=0;attempt<3;attempt++){
      try{await recordScore(userId,run);if(p)p.state.rankStatus='saved';this.clients.find(c=>c.sessionId===playerId)?.send('scoreSaved',{runId:run.runId});return;}
      catch(e){error=e;if(!cloudScoresEnabled)break;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
    }
    if(p)p.state.rankStatus='failed';
    console.error('[classement]',error instanceof Error?error.message:'Enregistrement impossible');
    this.clients.find(c=>c.sessionId===playerId)?.send('scoreError',{message:'Classement : le serveur n’a pas pu enregistrer votre score. Votre historique est conservé.'});
  }

  onDrop(client:Client):void {
    const p=this.sim.players.get(client.sessionId);
    if(p){p.state.connected=false;p.dx=p.dy=0;p.autoAttack=false;p.state.moving=false;p.pendingInputSeq=p.state.inputSeq;}
    if([...this.sim.players.values()].every(p=>!p.state.connected)&&!this.state.paused){this.state.paused=true;this.pausedForReconnect=true;}
    this.allowReconnection(client,120);
  }
  onReconnect(client:Client):void {
    const p=this.sim.players.get(client.sessionId);if(p)p.state.connected=true;
    if(this.pausedForReconnect){this.state.paused=false;this.pausedForReconnect=false;}
  }
  onLeave(client: Client): void {
    this.accounts.delete(client.sessionId);
    this.sim.removePlayer(client.sessionId);
    if(this.pausedForReconnect&&[...this.sim.players.values()].some(p=>p.state.connected)){this.state.paused=false;this.pausedForReconnect=false;}
    // Si l'hôte part, le plus ancien joueur restant prend le relais.
    if (this.state.hostId === client.sessionId) {
      this.state.hostId = this.state.players.keys().next().value ?? '';
    }
  }

  onDispose(): void {
    activeCodes.delete(this.roomId);
    console.log(`[salle ${this.roomId}] fermée`);
  }
}
