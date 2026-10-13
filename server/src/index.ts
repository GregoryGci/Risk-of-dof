// Point d'entrée du serveur : Colyseus (WebSocket) + Express.
// En production, Express sert aussi le client compilé (client/dist) : un seul port.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { ROOM_NAME, SERVER_PORT } from '@rod/shared';
import { GameRoom } from './rooms/GameRoom.ts';

const port = Number(process.env.PORT) || SERVER_PORT;
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

const server = new Server({
  transport: new WebSocketTransport(),
  greet: false,
  express: (app) => {
    app.get('/sante', (_req, res) => {
      res.json({ ok: true });
    });
    if (existsSync(clientDist)) app.use(express.static(clientDist));
  },
});

server.define(ROOM_NAME, GameRoom);

server.listen(port).then(() => {
  console.log(`[serveur] Risk of Dof en écoute sur le port ${port}`);
});
