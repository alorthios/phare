/**
 * Physique du bateau, exécutée par le SERVEUR (20 fois par seconde).
 *
 * Repère du monde (vu du dessus, comme sur la carte du Gardien) :
 *   +X = est, -Z = nord, +Z = sud. Le nord est donc « en haut » de la carte.
 *   cap (heading) en radians, mesuré dans le sens horaire depuis le nord :
 *   0 = nord, π/2 = est, π = sud, 3π/2 = ouest.
 */

export const BOAT = {
  maxSpeed: 6,          // m/s en avant toute (~12 nœuds)
  maxReverse: 2,        // m/s en arrière
  speedInertia: 3,      // secondes pour atteindre ~63 % de la vitesse visée
  maxTurnRate: 0.35,    // rad/s, barre à fond et à bonne vitesse
  rudderRate: 1.6,      // vitesse de rotation de la barre (unités/s)
  bowOffset: 4,         // la proue est à 4 m devant le centre : on teste aussi ce point
  bounce: 0.3,          // part de la vitesse renvoyée en arrière quand on touche la côte
} as const;

/** Ce que la physique doit savoir du monde : où le bateau a le droit d'être. */
export type NavigableFn = (x: number, z: number) => boolean;

/** Positions du télégraphe de la machine, de « arrière » à « en avant toute ». */
export const THROTTLE_LEVELS = [-1, 0, 1 / 3, 2 / 3, 1] as const;
export const THROTTLE_LABELS = ["Arrière", "Stop", "En avant lente", "En avant demie", "En avant toute"];
export const THROTTLE_STOP = 1;   // index de « Stop »

/** Ce que le Capitaine envoie : ses intentions, jamais une position. */
export interface HelmInput {
  /** -1 = barre à gauche (bâbord), 0 = au centre, 1 = à droite (tribord). */
  rudder: number;
  /** Index dans THROTTLE_LEVELS. */
  throttle: number;
}

export interface BoatPhysicsState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Position réelle de la barre (suit l'ordre du Capitaine avec un léger retard). */
  rudder: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const TWO_PI = Math.PI * 2;

export function isValidHelm(input: unknown): input is HelmInput {
  if (typeof input !== "object" || input === null) return false;
  const { rudder, throttle } = input as Record<string, unknown>;
  return [-1, 0, 1].includes(rudder as number)
    && Number.isInteger(throttle) && (throttle as number) >= 0 && (throttle as number) < THROTTLE_LEVELS.length;
}

/**
 * Fait avancer le bateau de dt secondes. Modifie `boat` directement.
 * Renvoie true si le bateau a heurté la côte pendant ce pas.
 */
export function stepBoat(boat: BoatPhysicsState, helm: HelmInput, dt: number, isNavigable: NavigableFn): boolean {
  // 1. La barre tourne progressivement vers la position demandée.
  const rudderStep = BOAT.rudderRate * dt;
  boat.rudder += clamp(helm.rudder - boat.rudder, -rudderStep, rudderStep);

  // 2. Inertie : la vitesse rejoint doucement la vitesse visée.
  const level = THROTTLE_LEVELS[helm.throttle];
  const targetSpeed = level >= 0 ? level * BOAT.maxSpeed : level * BOAT.maxReverse;
  boat.speed += (targetSpeed - boat.speed) * (1 - Math.exp(-dt / BOAT.speedInertia));

  // 3. On ne tourne que si l'on avance (un bateau à l'arrêt ne pivote pas).
  const grip = clamp(Math.abs(boat.speed) / (BOAT.maxSpeed * 0.4), 0, 1);
  const turnRate = boat.rudder * BOAT.maxTurnRate * grip * Math.sign(boat.speed);
  boat.heading = (((boat.heading + turnRate * dt) % TWO_PI) + TWO_PI) % TWO_PI;

  // 4. Déplacement selon le cap.
  const fx = Math.sin(boat.heading), fz = -Math.cos(boat.heading);
  const nx = boat.x + fx * boat.speed * dt;
  const nz = boat.z + fz * boat.speed * dt;

  // 5. Collision : le centre ET la proue doivent rester en eau navigable.
  //    Sinon le bateau reste sur place et rebondit doucement (pas de dégâts : jeu cozy).
  const bowX = nx + fx * BOAT.bowOffset * Math.sign(boat.speed || 1);
  const bowZ = nz + fz * BOAT.bowOffset * Math.sign(boat.speed || 1);
  if (isNavigable(nx, nz) && isNavigable(bowX, bowZ)) {
    boat.x = nx;
    boat.z = nz;
    return false;
  }
  boat.speed *= -BOAT.bounce;
  return true;
}

/** Cap en degrés (0-359) et point cardinal, pour l'affichage. */
export function headingLabel(heading: number): string {
  const deg = Math.round((heading * 180) / Math.PI) % 360;
  const points = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return `${String(deg).padStart(3, "0")}° ${points[Math.round(deg / 45) % 8]}`;
}
