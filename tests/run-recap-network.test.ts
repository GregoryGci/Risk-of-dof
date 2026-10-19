import {test} from 'node:test';import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';import {WebSocketTransport} from '@colyseus/ws-transport';import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';import type {Simulation} from '../server/src/game/Simulation.ts';
import {PHASE_PLAYING,PHASE_FINISHED,getMonster,type GameStateView,type RunSummary} from '@rod/shared';
class RecapRoom extends GameRoom {async onAuth(){return true;}}
const until=async(fn:()=>boolean)=>{const end=Date.now()+5000;while(!fn()){assert.ok(Date.now()<end,'Patch du bilan attendu');await new Promise(r=>setTimeout(r,20));}};
test('Bilan WebSocket : dégâts et sorts individuels, mort pendant le spectateur, reconnexion après fin',async()=>{
  const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('recap_audit',RecapRoom);const rooms:Room[]=[];
  try{
    await server.listen(0,'127.0.0.1');const client=new Client(`ws://127.0.0.1:${(transport.server!.address() as {port:number}).port}`);
    const a=await client.create<GameStateView>('recap_audit',{name:'A',classId:'cra'});rooms.push(a);a.onMessage('*',()=>{});
    const b=await client.joinById<GameStateView>(a.roomId,{name:'B',classId:'iop'});rooms.push(b);b.onMessage('*',()=>{});await until(()=>a.state.players?.size===2);
    a.send('start');await until(()=>a.state.phase===PHASE_PLAYING);
    const sim=(matchMaker.getLocalRoomById(a.roomId) as unknown as {sim:Simulation}).sim,p=sim.players.get(a.sessionId)!,q=sim.players.get(b.sessionId)!;
    (sim as any).director.update=()=>{};sim.roguelite.update=()=>{};sim.map.obstacles.fill(0);
    const m=sim.spawnMonster(getMonster('bouftou'),10,10,100,1,1);
    sim.damageMonster(m,12,p.id,false,{sourceId:p.spells[0]});sim.damageMonster(m,25,q.id,false,{sourceId:q.spells[0]});
    sim.damagePlayer(p,1e6,'Archer · Salve');await until(()=>!a.state.players.get(a.sessionId)!.alive);assert.equal(a.state.phase,PHASE_PLAYING);
    sim.now+=15;sim.damagePlayer(q,1e6,'Boss · Fracture');await until(()=>a.state.phase===PHASE_FINISHED&&!!b.state.players.get(b.sessionId)!.rewards);
    const summary=(r:Room<GameStateView>)=>JSON.parse(r.state.players.get(r.sessionId)!.rewards).summary as RunSummary;
    const ar=summary(a),br=summary(b);assert.equal(ar.damageSources![0].damage,12);assert.equal(br.damageSources![0].damage,25);assert.equal(ar.build!.spells[0]!.spellId,'sp.fleche_magique');assert.notEqual(ar.build!.spells[0]!.spellId,br.build!.spells[0]!.spellId);
    assert.equal(ar.build!.level,br.build!.level);assert.equal(ar.deathRecap!.events.at(-1)!.source,'Archer · Salve');assert.ok(br.deathRecap!.at-ar.deathRecap!.at>=15);
    const token=b.reconnectionToken,id=b.sessionId;b.reconnection.enabled=false;b.connection.close();await until(()=>!q.state.connected);
    const resumed=await client.reconnect<GameStateView>(token);rooms.push(resumed);resumed.onMessage('*',()=>{});await until(()=>!!resumed.state.players?.get(id)?.connected);
    assert.deepEqual(summary(resumed),br);
  }finally{for(const r of rooms)if(r.connection.isOpen)await r.leave();await server.gracefullyShutdown(false);}
});
