import { defineConfig } from "vite";
import { SERVER_PORT } from "@phare/shared";

export default defineConfig({
  server: {
    port: 5173,
    // Les requêtes /api/... sont transmises au serveur de jeu.
    // Ainsi le navigateur ne parle qu'à une seule adresse (utile pour le HTTPS au jalon 1).
    proxy: {
      "/api": `http://localhost:${SERVER_PORT}`,
    },
  },
});
