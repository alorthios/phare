import type { BoatPhysicsState } from "@phare/shared";

interface Snapshot extends BoatPhysicsState {
  t: number;   // instant de réception (ms)
}

/**
 * Le serveur envoie la position du bateau ~20 fois par seconde, mais l'écran
 * s'affiche 60 fois par seconde. Pour un mouvement fluide, on affiche le bateau
 * avec un léger retard (100 ms) en interpolant entre les deux positions reçues
 * qui encadrent cet instant.
 */
export class BoatInterpolator {
  private snaps: Snapshot[] = [];

  constructor(private readonly delayMs = 100) {}

  /** À appeler à chaque mise à jour reçue du serveur. */
  push(b: BoatPhysicsState) {
    const last = this.snaps[this.snaps.length - 1];
    if (last && last.x === b.x && last.z === b.z && last.heading === b.heading
      && last.speed === b.speed && last.rudder === b.rudder) return;   // rien n'a bougé

    this.snaps.push({ t: performance.now(), x: b.x, z: b.z, heading: b.heading, speed: b.speed, rudder: b.rudder });
    if (this.snaps.length > 30) this.snaps.shift();
  }

  /** Position à afficher maintenant. */
  sample(now = performance.now()): BoatPhysicsState {
    const snaps = this.snaps;
    if (snaps.length === 0) return { x: 0, z: 0, heading: 0, speed: 0, rudder: 0 };

    const renderT = now - this.delayMs;
    if (renderT <= snaps[0].t) return snaps[0];
    const last = snaps[snaps.length - 1];
    if (renderT >= last.t) return last;

    let i = snaps.length - 2;
    while (i > 0 && snaps[i].t > renderT) i--;
    const a = snaps[i], b = snaps[i + 1];
    const k = (renderT - a.t) / (b.t - a.t);

    return {
      x: a.x + (b.x - a.x) * k,
      z: a.z + (b.z - a.z) * k,
      heading: lerpAngle(a.heading, b.heading, k),
      speed: a.speed + (b.speed - a.speed) * k,
      rudder: a.rudder + (b.rudder - a.rudder) * k,
    };
  }
}

/** Interpole un angle par le chemin le plus court (359° → 1° passe par 0°, pas par 180°). */
function lerpAngle(a: number, b: number, k: number): number {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * k;
}
