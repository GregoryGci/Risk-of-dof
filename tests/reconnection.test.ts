import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Server,matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Client,type Room} from '@colyseus/sdk';
import {GameRoom} from '../server/src/rooms/GameRoom.ts';
import {PHASE_PLAYING,type GameStateView} from '@rod/shared';
import type {Simulation} from '../server/src/game/Simulation.ts';
class ReconnectionTestRoom extends GameRoom{async onAuth(){return true;}}
const until=async(check:()=>boolean)=>{const end=Date.now()+5000;while(!check()){assert.ok(Date.now()<end,'Reconnexion non reçue');await new Promise(r=>setTimeout(r,20));}};
test('rechargement : même partie, PV/XP conservés, solo en pause et multi actif',async()=>{
  const transport=new WebSocketTransport(),server=new Server({transport,greet:false,gracefullyShutdown:false});server.define('reconnect_test',ReconnectionTestRoom);
  const connected:Room[]=[];
  try{
    await server.listen(0,'127.0.0.1');const address=transport.server!.address() as {port:number};const client=new Client(`ws://127.0.0.1:${address.port}`);
    for(const solo of [true,false]){
      const host=await client.create<GameStateView>('reconnect_test',{singlePlayer:solo,name:'Test'});host.onMessage('*',()=>{});
      const room=matchMaker.getLocalRoomById(host.roomId) as unknown as {sim:Simulation};
      let guest:Room|undefined;if(!solo){guest=await client.joinById(host.roomId,{name:'Invité'});guest.onMessage('*',()=>{});connected.push(guest);}
      host.send('start');await until(()=>host.state.phase===PHASE_PLAYING);
      host.send('input',{seq:20,dx:0,dy:0,dir:1});await until(()=>host.state.players.get(host.sessionId)!.inputSeq===20);
      const p=room.sim.players.get(host.sessionId)!;room.sim.state.runXp=7;room.sim.state.totalXp=151;p.state.hp-=30;
      const token=host.reconnectionToken,id=host.sessionId,roomId=host.roomId,hp=p.state.hp;
      host.reconnection.enabled=false;host.connection.close();
      await until(()=>!p.state.connected);assert.equal(room.sim.players.get(id),p);assert.equal(room.sim.state.paused,solo);
      const resumed=await client.reconnect<GameStateView>(token);resumed.onMessage('*',()=>{});connected.push(resumed);
      await until(()=>resumed.state.players?.get(id)?.connected===true);
      assert.equal(resumed.sessionId,id);assert.equal(resumed.roomId,roomId);assert.equal(resumed.state.totalXp,151);assert.ok(Math.abs(resumed.state.players.get(id)!.hp-hp)<1);assert.equal(room.sim.state.paused,false);
      resumed.send('input',{seq:21,dx:1,dy:0,dir:1});await until(()=>resumed.state.players.get(id)!.inputSeq===21);
      await resumed.leave();connected.splice(connected.indexOf(resumed),1);if(guest){await guest.leave();connected.splice(connected.indexOf(guest),1);}
    }
  }finally{for(const room of connected)await room.leave();await server.gracefullyShutdown(false);}
});
