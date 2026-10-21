import type { Rng } from "../rng.ts";

// Directions de gradient : valeurs fixes (pas de Math.cos) pour un résultat identique
// au bit près sur le serveur et dans tous les navigateurs.
const GRADS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.70710678, 0.70710678], [-0.70710678, 0.70710678],
  [0.70710678, -0.70710678], [-0.70710678, -0.70710678],
];

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Bruit de Perlin 2D à seed : une « texture » aléatoire mais continue, qui varie
 * doucement d'un point à l'autre. Parfait pour des côtes naturelles.
 * Renvoie une fonction (x, y) → valeur d'environ -1 à 1.
 */
export function createNoise2D(rng: Rng) {
  const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad = (hash: number, x: number, y: number) => {
    const g = GRADS[hash & 7];
    return g[0] * x + g[1] * y;
  };

  return (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;

    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);

    const top = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const bottom = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(top, bottom, v) * 1.41;
  };
}
