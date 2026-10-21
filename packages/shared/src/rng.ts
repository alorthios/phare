/**
 * Générateur aléatoire reproductible (mulberry32) : même seed → mêmes nombres,
 * sur le serveur comme sur les deux clients. Math.random() est interdit pour
 * tout ce qui doit être identique chez les deux joueurs.
 */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // [0, 1[
  };
  return {
    next,
    /** Nombre décimal dans [min, max[. */
    range: (min: number, max: number) => min + next() * (max - min),
    /** Entier dans [min, max] (bornes incluses). */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    shuffle: <T>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
export type Rng = ReturnType<typeof createRng>;
