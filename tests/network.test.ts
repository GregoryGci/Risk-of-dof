import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';
import type {Simulation} from '../server/src/game/Simulation.ts';
import {createEquipment,PHASE_PLAYING,PHASE_LOST,PHASE_LOBBY,type GameStateView,type RunReward} from '@rod/shared';

const until=async (predicate:()=>boolean)=>{
  const deadline=Date.now()+5000;
  while(!predicate()) { assert.ok(Date.now()<deadline,'État réseau non reçu'); await new Promise(r=>setTimeout(r,20)); }
};
test('WebSocket : solo fermé aux invités, salon à deux, récompenses fiables et retour au salon',async()=>{
  const transport=new WebSocketTransport();
  const server=new Server({transport,greet:false,gracefullyShutdown:false});
  server.define('audit_game',GameRoom);
  const joined:Room[]=[];
  try {
    await server.listen(0,'127.0.0.1');
    const address=transport.server!.address() as {port:number};
    const client=new Client(`ws://127.0.0.1:${address.port}`);
    const solo=await client.create<GameStateView>('audit_game',{singlePlayer:true,name:'Solo'}); joined.push(solo);solo.onMessage('*',()=>{});
    await assert.rejects(()=>client.joinById(solo.roomId,{name:'Intrus'}));
    await solo.leave();joined.pop();
    const host=await client.create<GameStateView>('audit_game',{name:'Hôte',equipment:{coiffe:createEquipment('coiffe_bouftou','legendaire')}});joined.push(host);host.onMessage('*',()=>{});
    const guest=await client.joinById<GameStateView>(host.roomId,{name:'Invité'});joined.push(guest);guest.onMessage('*',()=>{});
    await until(()=>host.state.players.size===2 && guest.state.players.size===2);
    const rewards:RunReward[]=[];
    host.onMessage('runReward',(e:{player:string;reward:RunReward})=>{if(e.player===host.sessionId) rewards.push(e.reward);});
    host.send('start');await until(()=>host.state.phase===PHASE_PLAYING);
    const room=matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation};
    const p=room.sim.players.get(host.sessionId)!;
    assert.equal(p.state.maxHp,138); // Crâ + coiffe parfaite.
    host.send('equipment',{equipment:{}});
    await new Promise(r=>setTimeout(r,60));assert.equal(p.state.maxHp,138);
    for(const player of room.sim.players.values()) room.sim.damagePlayer(player,1e6);
    await until(()=>rewards.length===1 && guest.state.phase===PHASE_LOST);
    assert.ok(rewards[0].gear.length>=1);assert.equal(rewards[0].runId,host.state.runId);
    host.send('restart');await until(()=>host.state.phase===PHASE_LOBBY && guest.state.phase===PHASE_LOBBY);
    assert.equal(rewards.length,1);
    assert.equal(host.state.players.get(host.sessionId)!.rewards,'');
  } finally { for(const room of joined) {try{await room.leave();}catch{}} await server.gracefullyShutdown(false); }
});
