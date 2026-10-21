import { defineConfig } from "vite";
import { SERVER_PORT } from "@phare/shared";

// Adresse du serveur de jeu : "http://server:2567" dans Docker, localhost sinon.
const serverUrl = process.env.SERVER_URL ?? `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  server: {
    port: 5173,
    // Les requêtes /api/... sont transmises au serveur de jeu.
    // Ainsi le navigateur ne parle qu'à une seule adresse (utile pour le HTTPS au jalon 1).
    proxy: {
      "/api": serverUrl,
    },
  },
});
