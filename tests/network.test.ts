import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';
import type {Simulation} from '../server/src/game/Simulation.ts';
import {createEquipment,getClass,equippedStats,PHASE_PLAYING,PHASE_LOST,PHASE_LOBBY,ZAAP_READY,type GameStateView,type RunReward} from '@rod/shared';

let simRunId:()=>string=()=>'';
const until=async (predicate:()=>boolean)=>{
  const deadline=Date.now()+5000;
  while(!predicate()) { assert.ok(Date.now()<deadline,'État réseau non reçu'); await new Promise(r=>setTimeout(r,20)); }
};
class NetworkTestRoom extends GameRoom {async onAuth(){return true;}}
test('WebSocket : solo fermé aux invités, salon à deux, récompenses fiables et retour au salon',async()=>{
  const transport=new WebSocketTransport();
  const server=new Server({transport,greet:false,gracefullyShutdown:false});
  server.define('audit_game',NetworkTestRoom);
  const joined:Room[]=[];
  try {
    await server.listen(0,'127.0.0.1');
    const address=transport.server!.address() as {port:number};
    const client=new Client(`ws://127.0.0.1:${address.port}`);
    const solo=await client.create<GameStateView>('audit_game',{singlePlayer:true,name:'Solo'}); joined.push(solo);solo.onMessage('*',()=>{});
    await assert.rejects(()=>client.joinById(solo.roomId,{name:'Intrus'}));
    await solo.leave();joined.pop();
    const host=await client.create<GameStateView>('audit_game',{name:'Hôte',blessing:'storm',equipment:{coiffe:createEquipment('coiffe_bouftou','legendaire')}});joined.push(host);host.onMessage('*',()=>{});
    const guest=await client.joinById<GameStateView>(host.roomId,{name:'Invité'});joined.push(guest);guest.onMessage('*',()=>{});
    await until(()=>host.state.players.size===2 && guest.state.players.size===2);
    assert.equal(host.state.players.get(host.sessionId)!.blessing,'');
    assert.equal(host.state.players.get(host.sessionId)!.blessings,'{}');
    const rewards:RunReward[]=[];
    host.onMessage('runReward',(e:{player:string;reward:RunReward})=>{if(e.player===host.sessionId) rewards.push(e.reward);});
    host.send('start');await until(()=>host.state.phase===PHASE_PLAYING);
    const room=matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation};
    const p=room.sim.players.get(host.sessionId)!;simRunId=()=>host.state.runId;
    assert.equal(p.state.maxHp,getClass('cra').maxHp+equippedStats({coiffe:createEquipment('coiffe_bouftou','legendaire')}).maxHp); // Crâ + coiffe parfaite.
    host.send('equipment',{equipment:{}});
    await new Promise(r=>setTimeout(r,60));assert.equal(p.state.maxHp,getClass('cra').maxHp+equippedStats({coiffe:createEquipment('coiffe_bouftou','legendaire')}).maxHp);
    host.send('input',{seq:7,dx:0,dy:0,dir:0});await until(()=>host.state.players.get(host.sessionId)!.inputSeq===7);
    host.send('classAction',{tx:p.state.x+2,ty:p.state.y,choice:0});
    await until(()=>JSON.parse(host.state.players.get(host.sessionId)!.mechanic).status==='Visée active');
    assert.equal(JSON.parse(host.state.players.get(host.sessionId)!.mechanic).name,'Visée tendue');
    const elite=room.sim.spawnMonster((await import('@rod/shared')).getMonster('boufton'),p.state.x+2,p.state.y,1,1,1);elite.state.elite=true;room.sim.damageMonster(elite,1e6,p.id);await until(()=>JSON.parse(host.state.players.get(host.sessionId)!.boonChoices).length===3&&JSON.parse(guest.state.players.get(guest.sessionId)!.boonChoices).length===3);const guestChoices=guest.state.players.get(guest.sessionId)!.boonChoices;host.send('boon',{runId:simRunId(),choice:0,revision:host.state.players.get(host.sessionId)!.choiceRevision});await until(()=>host.state.players.get(host.sessionId)!.boonChoices==='[]');assert.equal(guest.state.players.get(guest.sessionId)!.boonChoices,guestChoices);guest.send('boon',{runId:simRunId(),choice:1,revision:guest.state.players.get(guest.sessionId)!.choiceRevision});await until(()=>guest.state.players.get(guest.sessionId)!.boonChoices==='[]');assert.equal(Object.keys(JSON.parse(host.state.players.get(host.sessionId)!.blessings)).length,1);assert.equal(Object.keys(JSON.parse(guest.state.players.get(guest.sessionId)!.blessings)).length,1);
    room.sim.state.time=59.99;await until(()=>JSON.parse(host.state.players.get(host.sessionId)!.forgeGrants).length===1);
    const boss=room.sim.spawnMonster((await import('@rod/shared')).getMonster('bouftou_royal'),p.state.x+2,p.state.y,1,1,1);
    room.sim.damageMonster(boss,1e6,p.id);
    await until(()=>JSON.parse(host.state.players.get(host.sessionId)!.boonChoices).length===3);
    while(host.state.players.get(host.sessionId)!.boonChoices!=='[]'){const revision=host.state.players.get(host.sessionId)!.choiceRevision;host.send('boon',{runId:simRunId(),choice:0,revision});await until(()=>host.state.players.get(host.sessionId)!.choiceRevision!==revision||host.state.players.get(host.sessionId)!.boonChoices==='[]');}
    room.sim.state.zaapState=ZAAP_READY;p.state.x=room.sim.state.zaapX;p.state.y=room.sim.state.zaapY;host.send('interact');
    await until(()=>host.state.intermission&&guest.state.intermission);
    assert.equal(host.state.monsters.size,0);assert.equal(host.state.challenges.size,0);assert.equal(host.state.xpOrbs.size,0);
    host.send('routeChoice',{route:'ordeal'});guest.send('routeChoice',{route:'ordeal'});
    await until(()=>host.state.players.get(host.sessionId)!.routeChoice==='ordeal'&&guest.state.players.get(guest.sessionId)!.routeChoice==='ordeal');
    let pinged=false;host.onMessage('pong',()=>pinged=true);host.send('ping',{sentAt:performance.now()});await until(()=>pinged);
    host.send('restReady');await until(()=>guest.state.players.get(host.sessionId)!.restReady);assert.equal(host.state.intermission,true);
    guest.send('restReady');await until(()=>!host.state.intermission&&host.state.stage===2&&!guest.state.intermission);
    assert.equal(host.state.stageRoute,'ordeal');assert.equal(guest.state.stageRoute,'ordeal');
    for(const player of room.sim.players.values()) room.sim.damagePlayer(player,1e6);
    await until(()=>rewards.length===1 && guest.state.phase===PHASE_LOST);
    assert.ok(rewards[0].gear.length>=1);assert.equal(rewards[0].runId,host.state.runId);
    assert.equal(rewards[0].forgeGrants!.length,2);
    host.send('restart');await until(()=>host.state.phase===PHASE_LOBBY && guest.state.phase===PHASE_LOBBY);
    assert.equal(rewards.length,1);
    assert.equal(host.state.players.get(host.sessionId)!.rewards,'');
  } finally { for(const room of joined) {try{await room.leave();}catch{}} await server.gracefullyShutdown(false); }
});
