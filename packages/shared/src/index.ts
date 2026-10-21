// Code partagé entre le client et le serveur.
// Tout ce qui doit donner le même résultat sur les deux machines vit ici.

export * from "./roles.ts";
export * from "./state.ts";
export * from "./radio.ts";

export const GAME_TITLE = "Phare & Constel";

/** Port sur lequel écoute le serveur de jeu. */
export const SERVER_PORT = 2567;

/** Nom du type de salle Colyseus (une salle = une partie à 2). */
export const ROOM_NAME = "nuit";

/** Noms des messages échangés entre client et serveur. */
export const MSG = {
  // client → serveur
  chooseRole: "choose_role",
  radioReady: "radio_ready",
  pttRequest: "ptt_request",
  pttRelease: "ptt_release",
  debugSignal: "debug_signal",
  // serveur → client
  radioLink: "radio_link",
  pttDenied: "ptt_denied",
  // dans les deux sens (relayé par le serveur vers l'autre joueur)
  rtc: "rtc",
} as const;

/** Codes de partie : 4 lettres, sans I ni O (trop proches de 1 et 0). */
export const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LENGTH);
}

export const MAX_NAME_LENGTH = 20;

export function cleanName(input: unknown): string {
  const name = typeof input === "string" ? input.trim().slice(0, MAX_NAME_LENGTH) : "";
  return name || "Matelot";
}
