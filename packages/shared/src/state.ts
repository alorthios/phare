import { schema, t, type SchemaType } from "@colyseus/schema";

// État synchronisé automatiquement par Colyseus : le serveur le modifie,
// les clients reçoivent les changements.

export const Player = schema({
  name: t.string(),
  role: t.string(),         // "" (pas encore choisi) | "captain" | "keeper"
  radioReady: t.boolean(),  // micro autorisé et radio allumée
}, "Player");
export type Player = SchemaType<typeof Player>;

export const NightState = schema({
  /** Joueurs de la salle, indexés par leur sessionId. */
  players: t.map(Player),
  /** sessionId du joueur qui a la parole, "" = canal libre. */
  floorHolder: t.string(),
  /** Qualité du signal radio, de RADIO.minQuality (brouillé) à 1 (clair).
   *  Transmis en précision réduite : 0.6 arrive en 0.6000000238 (sans importance pour le son). */
  signalQuality: t.number(),
}, "NightState");
export type NightState = SchemaType<typeof NightState>;
