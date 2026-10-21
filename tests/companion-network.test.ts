import {test} from 'node:test';import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from '@colyseus/sdk';
import {createEquipment,getMonster,PHASE_PLAYING,type GameStateView,type CompanionActionEvent,type CastEvent} from '@rod/shared';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';import type {Simulation} from '../server/src/game/Simulation.ts';
class CompanionRoom extends GameRoom{async onAuth(){return true;}}
const until=async(fn:()=>boolean)=>{const end=Date.now()+6000;while(!fn()){assert.ok(Date.now()<end,'État ou action du compagnon attendu');await new Promise(r=>setTimeout(r,20));}};
test('Compagnons WebSocket : chaque client voit les deux familiers et leurs actions, y compris après reconnexion',async()=>{
 const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('companion_audit',CompanionRoom);const rooms:Room[]=[];
 try{
  await server.listen(0,'127.0.0.1');const client=new Client(`ws://127.0.0.1:${(transport.server!.address() as {port:number}).port}`);
  const host=await client.create<GameStateView>('companion_audit',{equipment:{familier:createEquipment('familier_chacha','normal'),petAttack:'crachat'}}),guest=await client.joinById<GameStateView>(host.roomId,{equipment:{familier:createEquipment('familier_bwak','normal'),petAttack:'morsure'}});rooms.push(host,guest);
  const actions=[[],[]] as CompanionActionEvent[][],casts:CastEvent[]=[];
  for(const [i,room]of [host,guest].entries()){room.onMessage('*',()=>{});room.onMessage('companionAction',(e:CompanionActionEvent)=>actions[i].push(e));room.onMessage('cast',(e:CastEvent)=>casts.push(e));}
  await until(()=>host.state.players?.size===2);host.send('start');await until(()=>host.state.phase===PHASE_PLAYING);
  const sim=(matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation}).sim;(sim as any).director.update=()=>{};sim.roguelite.update=()=>{};sim.map.obstacles.fill(0);for(const id of [...sim.monsters.keys()])sim.removeMonster(id);
  const after=sim.now+.15;
  for(const [i,p]of [...sim.players.values()].entries()){p.state.x=40;p.state.y=40+i;p.petAttackAt=after;}
  const enemy=sim.spawnMonster({...getMonster('epouvantail'),speed:0,hp:1e6},43,40,1,1,1);enemy.meleeReadyAt=enemy.enemyReadyAt=enemy.specialReadyAt=Infinity;
  await until(()=>actions.every(a=>new Set(a.filter(e=>e.at>=after).map(e=>e.owner)).size===2));for(const p of sim.players.values())p.petAttackAt=Infinity;
  for(const received of actions){const list=received.filter(e=>e.at>=after);assert.equal(list.length,2);assert.equal(list.find(e=>e.owner===host.sessionId)!.attackId,'crachat');assert.equal(list.find(e=>e.owner===guest.sessionId)!.attackId,'morsure');}
  assert.ok(casts.some(e=>e.companionOwner===host.sessionId&&e.spell==='pet_crachat'));assert.ok(casts.some(e=>e.companionOwner===guest.sessionId&&e.spell==='pet_morsure'));
  const token=guest.reconnectionToken,id=guest.sessionId;guest.reconnection.enabled=false;guest.connection.close();await until(()=>!sim.players.get(id)!.state.connected);
  const resumed=await client.reconnect<GameStateView>(token);rooms.push(resumed);resumed.onMessage('*',()=>{});const next:CompanionActionEvent[]=[];resumed.onMessage('companionAction',(e:CompanionActionEvent)=>next.push(e));
  await until(()=>resumed.state.players?.get(id)?.connected===true);
  assert.equal(JSON.parse(resumed.state.players.get(host.sessionId)!.equipment).familier.base,'familier_chacha');assert.equal(JSON.parse(resumed.state.players.get(id)!.equipment).familier.base,'familier_bwak');
  sim.players.get(id)!.petAttackAt=0;await until(()=>next.some(e=>e.owner===id));assert.equal(next[0].base,'familier_bwak');assert.equal(next[0].runId,sim.state.runId);
 }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.gracefullyShutdown(false);}
});
