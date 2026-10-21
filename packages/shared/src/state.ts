import { schema, t, type SchemaType } from "@colyseus/schema";

// État synchronisé automatiquement par Colyseus : le serveur le modifie,
// les clients reçoivent les changements.
// Les nombres sont transmis en précision réduite : 0.6 arrive en 0.6000000238 (sans importance ici).

export const Player = schema({
  name: t.string(),
  role: t.string(),         // "" (pas encore choisi) | "captain" | "keeper"
  radioReady: t.boolean(),  // micro autorisé et radio allumée
}, "Player");
export type Player = SchemaType<typeof Player>;

/** Le navire, simulé par le serveur (voir boat.ts pour le repère et les unités). */
export const Boat = schema({
  x: t.number(),
  z: t.number(),
  heading: t.number(),
  speed: t.number(),
  rudder: t.number(),
  /** Ordre du télégraphe (index dans THROTTLE_LEVELS). */
  throttle: t.number(),
}, "Boat");
export type Boat = SchemaType<typeof Boat>;

export const NightState = schema({
  /** Joueurs de la salle, indexés par leur sessionId. */
  players: t.map(Player),
  /** sessionId du joueur qui a la parole, "" = canal libre. */
  floorHolder: t.string(),
  /** Qualité du signal radio, de RADIO.minQuality (brouillé) à 1 (clair). */
  signalQuality: t.number(),
  /** Seed de la nuit : même nombre → même monde chez tout le monde.
   *  Entier 32 bits EXACT (t.number() arrondirait un grand nombre → un autre monde !). */
  seed: t.uint32(),
  boat: Boat,
}, "NightState");
export type NightState = SchemaType<typeof NightState>;
