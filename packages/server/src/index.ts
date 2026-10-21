import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME_TITLE, ROOM_NAME, SERVER_PORT } from "@phare/shared";
import { NightRoom } from "./rooms/NightRoom.ts";

const server = new Server({
  transport: new WebSocketTransport(),
  greet: false,
  express: (app) => {
    // Petit point de contrôle utilisé par la page d'accueil.
    app.get("/api/health", (_req, res) => {
      res.json({ ok: true, game: GAME_TITLE });
    });
  },
});

server.define(ROOM_NAME, NightRoom);

await server.listen(SERVER_PORT);
console.log(`⚓ Serveur ${GAME_TITLE} prêt sur le port ${SERVER_PORT}`);
