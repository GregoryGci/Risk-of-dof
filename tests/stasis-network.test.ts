import {test} from 'node:test';import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';import type {Simulation} from '../server/src/game/Simulation.ts';
import {GAME_MODES,PHASE_PLAYING,PHASE_FINISHED,type GameStateView} from '@rod/shared';
class StasisRoom extends GameRoom{async onAuth(){return {unlockedMode:9,spellLevels:{}};}}
const until=async(fn:()=>boolean)=>{const end=Date.now()+6000;while(!fn()){assert.ok(Date.now()<end,'Patch Stasis attendu');await new Promise(r=>setTimeout(r,20));}};
test('Stasis WebSocket : sélection autoritaire des dix paliers, borne 10 et victoire finale synchronisée',async()=>{
  const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('stasis_audit',StasisRoom);const rooms:Room[]=[];
  try{
    await server.listen(0,'127.0.0.1');const client=new Client(`ws://127.0.0.1:${(transport.server!.address() as {port:number}).port}`);
    const host=await client.create<GameStateView>('stasis_audit'),guest=await client.joinById<GameStateView>(host.roomId);rooms.push(host,guest);host.onMessage('*',()=>{});guest.onMessage('*',()=>{});await until(()=>host.state.players?.size===2);
    for(const mode of GAME_MODES){host.send('mode',{mode:mode.id});await until(()=>host.state.mode===mode.id&&guest.state.mode===mode.id);}
    host.send('mode',{mode:10});guest.send('mode',{mode:0});await new Promise(r=>setTimeout(r,80));assert.equal(host.state.mode,9);
    host.send('start');await until(()=>host.state.phase===PHASE_PLAYING);assert.equal(host.state.stage,1);assert.equal(host.state.zoneOrder.split(',').length,12);
    const sim=(matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation}).sim;sim.state.stage=12;sim.map.obstacles.fill(0);(sim as any).director.update=()=>{};(sim as any).activateZaap();
    await until(()=>[...sim.monsters.values()].filter(m=>m.def.boss).length===3);
    for(const boss of [...sim.monsters.values()].filter(m=>m.def.boss))sim.damageMonster(boss,1e9,host.sessionId);
    await until(()=>host.state.phase===PHASE_FINISHED&&guest.state.phase===PHASE_FINISHED);
    for(const room of[host,guest]){const p=room.state.players.get(room.sessionId)!;const summary=JSON.parse(p.rewards).summary;assert.equal(summary.mode,9);assert.equal(summary.difficultyVersion,2);assert.equal(summary.outcome,'victory');assert.equal(summary.runZones,12);assert.equal(summary.zone,12);assert.equal(p.unlockedMode,9);}
  }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.gracefullyShutdown(false);}
});
