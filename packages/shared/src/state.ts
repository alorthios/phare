import { schema, t, type SchemaType } from "@colyseus/schema";

// État synchronisé automatiquement par Colyseus : le serveur le modifie,
// les clients reçoivent les changements.

export const Player = schema({
  name: t.string(),
  role: t.string(),   // "" (pas encore choisi) | "captain" | "keeper"
}, "Player");
export type Player = SchemaType<typeof Player>;

export const NightState = schema({
  /** Joueurs de la salle, indexés par leur sessionId. */
  players: t.map(Player),
}, "NightState");
export type NightState = SchemaType<typeof NightState>;
