import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';
import {PHASE_PLAYING,type GameStateView} from '@rod/shared';
import type {Simulation} from '../server/src/game/Simulation.ts';
class XpRoom extends GameRoom{async onAuth(){return true;}}
let simRunId:()=>string=()=>'';
const until=async(fn:()=>boolean)=>{const end=Date.now()+5000;while(!fn()){assert.ok(Date.now()<end,'Patch XP attendu');await new Promise(r=>setTimeout(r,20));}};

test('XP WebSocket : état commun, collision simultanée, révision rejouée, choix indépendants et reconnexion',async()=>{
  const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('xp_audit',XpRoom);const rooms:Room[]=[];
  try{
    await server.listen(0,'127.0.0.1');const client=new Client(`ws://127.0.0.1:${(transport.server!.address() as {port:number}).port}`);
    const host=await client.create<GameStateView>('xp_audit',{name:'Hôte'}),guest=await client.joinById<GameStateView>(host.roomId,{name:'Invité'});rooms.push(host,guest);host.onMessage('*',()=>{});guest.onMessage('*',()=>{});await until(()=>host.state.players?.size===2);
    host.send('start');await until(()=>host.state.phase===PHASE_PLAYING&&guest.state.phase===PHASE_PLAYING);
    const sim=(matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation}).sim,p=sim.players.get(host.sessionId)!,q=sim.players.get(guest.sessionId)!;(sim as any).director.update=()=>{};for(const id of [...sim.monsters.keys()])sim.removeMonster(id);sim.map.obstacles.fill(0);
    q.state.x=p.state.x;q.state.y=p.state.y;sim.experience.drop(p.state.x,p.state.y,58);
    await until(()=>host.state.runLevel===4&&guest.state.runLevel===4&&host.state.totalXp===58&&guest.state.totalXp===58);
    assert.equal(host.state.runXp,guest.state.runXp);assert.equal(host.state.xpToNext,guest.state.xpToNext);assert.equal(host.state.xpOrbs.size,0);
    simRunId=()=>host.state.runId;
    const my=()=>host.state.players.get(host.sessionId)!,their=()=>host.state.players.get(guest.sessionId)!;await until(()=>my().pendingLevels===3&&their().pendingLevels===3);
    const revision=my().choiceRevision,guestChoice=their().boonChoices;host.send('boon',{runId:simRunId(),choice:0,revision});host.send('boon',{runId:simRunId(),choice:1,revision});await until(()=>my().pendingLevels===2);await new Promise(r=>setTimeout(r,120));host.send('boon',{runId:simRunId(),choice:2,revision});await new Promise(r=>setTimeout(r,100));assert.equal(my().pendingLevels,2);assert.equal(their().boonChoices,guestChoice);assert.equal(their().pendingLevels,3);
    host.send('input',{dx:0,dy:0,dir:0,totalXp:1e9,runLevel:999} as any);await new Promise(r=>setTimeout(r,80));assert.equal(host.state.totalXp,58);assert.equal(guest.state.runLevel,4);
    const token=guest.reconnectionToken,id=guest.sessionId;guest.reconnection.enabled=false;guest.connection.close();await until(()=>!q.state.connected);assert.equal(sim.state.paused,false);
    const resumed=await client.reconnect<GameStateView>(token);rooms.push(resumed);resumed.onMessage('*',()=>{});await until(()=>!!resumed.state.players?.get(id)?.connected);
    assert.equal(resumed.state.runLevel,host.state.runLevel);assert.equal(resumed.state.totalXp,58);assert.equal(resumed.state.players.get(id)!.boonChoices,guestChoice);assert.equal(resumed.state.players.get(id)!.pendingLevels,3);
    resumed.send('boon',{runId:simRunId(),choice:1,revision:resumed.state.players.get(id)!.choiceRevision});await until(()=>resumed.state.players.get(id)!.pendingLevels===2);assert.equal(my().pendingLevels,2);
    sim.experience.drop(2,2,33);sim.experience.drop(93,93,17);sim.experience.sweep();await until(()=>host.state.totalXp===108&&resumed.state.totalXp===108&&host.state.xpOrbs.size===0);assert.equal(host.state.runLevel,resumed.state.runLevel);assert.equal(host.state.runXp,resumed.state.runXp);
  }finally{for(const room of rooms)if(room.connection.isOpen)await room.leave();await server.gracefullyShutdown(false);}
});
