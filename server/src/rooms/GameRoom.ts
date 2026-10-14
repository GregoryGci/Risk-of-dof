// Salle de jeu : une partie = une salle, identifiée par un code court.
// La salle ne fait que relayer : toute la logique est dans game/Simulation.ts.
import { Room, type Client } from '@colyseus/core';
import { MAX_PLAYERS, NAME_MAX_LENGTH, PATCH_MS, ROOM_CODE_LENGTH, TICK_RATE, type CastMessage, type InputMessage } from '@rod/shared';
import { Simulation } from '../game/Simulation.ts';
import { GameState } from '../state.ts';

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

  onCreate(): void {
    // Le code court sert directement d'identifiant de salle : le client rejoint avec joinById(code).
    this.roomId = generateCode();
    activeCodes.add(this.roomId);
    // Un client bavard (ou bogué) est déconnecté plutôt que de saturer la salle.
    this.maxMessagesPerSecond = 120;

    this.sim = new Simulation(this.state, (type, message) => this.broadcast(type, message));
    this.setPatchRate(PATCH_MS);
    this.setSimulationInterval((deltaMs) => this.sim.update(deltaMs / 1000), 1000 / TICK_RATE);

    this.onMessage('input', (client: Client, message: InputMessage) => this.sim.setInput(client.sessionId, message));
    this.onMessage('cast', (client: Client, message: CastMessage) => this.sim.playerCast(client.sessionId, message));
    this.onMessage('class', (client: Client, message: { classId?: string }) => this.sim.setClass(client.sessionId, message?.classId));
    this.onMessage('pause', (client: Client, message: { paused?: boolean }) => this.sim.setPaused(client.sessionId, message?.paused));
    this.onMessage('interact', (client: Client) => this.sim.interact(client.sessionId));
    this.onMessage('start', (client: Client) => {
      if (client.sessionId === this.state.hostId) this.sim.start();
    });
    this.onMessage('restart', () => this.sim.restart());

    console.log(`[salle ${this.roomId}] créée`);
  }

  onJoin(client: Client, options?: { name?: string; classId?: string }): void {
    const name = cleanName(options?.name);
    this.sim.addPlayer(client.sessionId, name, typeof options?.classId === 'string' ? options.classId : undefined);
    if (!this.state.hostId) this.state.hostId = client.sessionId;
    console.log(`[salle ${this.roomId}] ${name} a rejoint (${this.state.players.size}/${MAX_PLAYERS})`);
  }

  onLeave(client: Client): void {
    this.sim.removePlayer(client.sessionId);
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
