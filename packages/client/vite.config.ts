import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { SERVER_PORT } from "@phare/shared";

// Adresse du serveur de jeu : "http://server:2567" dans Docker, localhost sinon.
const serverUrl = process.env.SERVER_URL ?? `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  // HTTPS avec un certificat auto-signé : indispensable pour que le navigateur
  // du second PC accepte d'utiliser le micro (jalon 2).
  plugins: [basicSsl()],
  server: {
    port: 5173,
    // Le navigateur ne parle qu'à Vite, qui transmet au serveur de jeu :
    //  - /api/...      → requêtes HTTP simples
    //  - /colyseus/... → matchmaking + WebSocket Colyseus (préfixe retiré)
    proxy: {
      "/api": serverUrl,
      "/colyseus": {
        target: serverUrl,
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ""),
      },
    },
  },
});
