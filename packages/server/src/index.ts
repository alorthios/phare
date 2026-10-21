import { createServer } from "node:http";
import { GAME_TITLE, SERVER_PORT } from "@phare/shared";

// Jalon 0 : un simple serveur HTTP qui répond "ok" sur /api/health.
// Au jalon 1, il sera remplacé par Colyseus (salles multijoueur).
const server = createServer((req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, game: GAME_TITLE }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(SERVER_PORT, () => {
  console.log(`⚓ Serveur ${GAME_TITLE} prêt sur http://localhost:${SERVER_PORT}`);
});
