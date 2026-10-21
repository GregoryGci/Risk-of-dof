import {test} from 'node:test';import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';import type {Simulation} from '../server/src/game/Simulation.ts';
import {masteryLevelXp,PHASE_PLAYING,type GameStateView} from '@rod/shared';
class MasteryRoom extends GameRoom {async onAuth(){return {name:'Maître',mastery:{sram:masteryLevelXp(30),cra:masteryLevelXp(20)},selectedVariants:['sp.piege_sournois','sp.fleche_magique','sp.pression'],disabledMasteryAuras:[],skinBook:{sram:'sram__mastery'},spellLevels:{},unlockedMode:1};}}
const until=async(fn:()=>boolean)=>{const end=Date.now()+6000;while(!fn()){assert.ok(Date.now()<end,'État maîtrise attendu');await new Promise(r=>setTimeout(r,20));}};
test('Maîtrise WebSocket : profil authentifié, aura et skin, variantes globales et reconnexion',async()=>{
 const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('mastery_audit',MasteryRoom);let room:Room<GameStateView>|undefined;
 try{
  await server.listen(0,'127.0.0.1');const client=new Client('ws://127.0.0.1:'+(transport.server!.address()as{port:number}).port);
  room=await client.create<GameStateView>('mastery_audit',{classId:'sram',mastery:{iop:999999},selectedVariants:['sp.pression']});room.onMessage('*',()=>{});const r=room;
  await until(()=>!!r.state.players?.get(r.sessionId));const p=()=>r.state.players.get(r.sessionId)!;
  assert.equal(p().masteryLevel,30);assert.equal(p().masteryAura,'sram');assert.equal(p().skin,'sram__mastery');
  assert.deepEqual(JSON.parse(p().build).variants,['sp.fleche_magique','sp.piege_sournois']);
  r.send('class',{classId:'iop'});await until(()=>p().classId==='iop');assert.equal(p().masteryAura,'');assert.equal(p().masteryLevel,1);assert.deepEqual(JSON.parse(p().build).variants,['sp.fleche_magique','sp.piege_sournois']);
  r.send('class',{classId:'sram'});await until(()=>p().classId==='sram');r.send('start');await until(()=>r.state.phase===PHASE_PLAYING);
  const before=p().build;r.send('refreshProgression',{mastery:{iop:999999},selectedVariants:['sp.pression']});await new Promise(r=>setTimeout(r,70));assert.equal(p().build,before);
  assert.equal(JSON.parse(p().abilities)[0].parameters.variant,1);
  const sim=(matchMaker.getLocalRoomById(r.roomId)as unknown as{sim:Simulation}).sim,token=r.reconnectionToken,id=r.sessionId;
  r.reconnection.enabled=false;r.connection.close();await until(()=>!sim.players.get(id)!.state.connected);room=await client.reconnect<GameStateView>(token);room.onMessage('*',()=>{});const resumed=room;
  await until(()=>!!resumed.state.players?.get(id)?.connected);assert.equal(resumed.state.players.get(id)!.masteryAura,'sram');assert.equal(resumed.state.players.get(id)!.skin,'sram__mastery');assert.deepEqual(JSON.parse(resumed.state.players.get(id)!.build).variants,['sp.fleche_magique','sp.piege_sournois']);
 }finally{if(room?.connection.isOpen)await room.leave();await server.gracefullyShutdown(false);}
});
