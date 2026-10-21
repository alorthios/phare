import { BOAT } from "./boat.ts";
import { createRng } from "./rng.ts";

/**
 * Monde de test du jalon 3 : quelques bouées et rochers pour sentir le mouvement.
 * Généré à partir du seed, il est identique chez le Capitaine et le Gardien.
 * Il sera remplacé par le vrai labyrinthe au jalon 4 (pas encore de collisions).
 */
export interface TestWorld {
  buoys: { x: number; z: number; color: "red" | "green" }[];
  rocks: { x: number; z: number; size: number }[];
}

export function generateTestWorld(seed: number): TestWorld {
  const rng = createRng(seed);
  const half = BOAT.worldHalfSize;
  // On laisse libre la zone de départ (autour de x=0, z=150).
  const farFromStart = (x: number, z: number) => Math.hypot(x, z - 150) > 25;

  const randomPoint = () => {
    let x: number, z: number;
    do {
      x = rng.range(-half, half);
      z = rng.range(-half, half);
    } while (!farFromStart(x, z));
    return { x, z };
  };

  return {
    buoys: Array.from({ length: 30 }, (_, i) => ({ ...randomPoint(), color: i % 2 ? "red" : "green" })),
    rocks: Array.from({ length: 40 }, () => ({ ...randomPoint(), size: rng.range(1.5, 6) })),
  };
}
