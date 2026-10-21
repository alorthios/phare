# 03 · Génération procédurale

**Objectif :** à partir d'un **seul nombre** (le seed), générer une nuit complète : labyrinthe, côtes, récifs, courants, hauts-fonds, balises, ciel. Le serveur et les deux clients exécutent **le même code** (`packages/shared/src/levelgen/`) avec le même seed, et obtiennent donc exactement le même monde.

## Vue d'ensemble du pipeline

```
seed
 │
 ├─1─► Labyrinthe sur grille (backtracker + boucles)
 ├─2─► Entrée de la baie & Port (le plus loin possible)
 ├─3─► Champ « eau / terre » lissé + bruit → côtes naturelles
 ├─4─► Vérification de navigabilité (flood fill). Échec → seed+1, on recommence
 ├─5─► Habillage : récifs, hauts-fonds, courants, phare
 ├─6─► Balises sonores
 └─7─► Ciel (constellations liées aux colonnes, voir doc 02)
```

## 0. Le hasard reproductible (`rng.ts`)

`Math.random()` est **interdit** dans `levelgen` : il donne un résultat différent sur chaque machine. On utilise un petit générateur à seed :

```ts
// mulberry32 : rapide, simple, largement suffisant pour un jeu
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
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    shuffle: <T>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
export type Rng = ReturnType<typeof createRng>;
```

Pour le bruit des côtes : le paquet npm [`simplex-noise`](https://www.npmjs.com/package/simplex-noise) accepte une fonction aléatoire, à qui on passe `rng.next`.

## 1. Le labyrinthe sur grille

On utilise la technique classique du **backtracker récursif** (parcours en profondeur), qui donne un labyrinthe « parfait » : un seul chemin entre deux points.

```
Grille de cellules 8×8  →  grille de tuiles (2·8+1)×(2·8+1) = 17×17
Tuile impaire/impaire = cellule (eau) · tuile entre deux cellules = mur ou passage
```

```ts
export function carveMaze(w: number, h: number, rng: Rng): boolean[][] {
  const W = 2 * w + 1, H = 2 * h + 1;
  const water = Array.from({ length: H }, () => Array(W).fill(false));
  const visited = Array.from({ length: h }, () => Array(w).fill(false));
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  water[1][1] = true;

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !visited[ny][nx]);

    if (!neighbors.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = neighbors[0];
    visited[ny][nx] = true;
    water[2 * cy + 1 + dy][2 * cx + 1 + dx] = true;   // on casse le mur entre les deux
    water[2 * ny + 1][2 * nx + 1] = true;
    stack.push([nx, ny]);
  }
  return water;   // water[ty][tx] : true = eau navigable
}
```

**Ajouter des boucles (« braiding »).** Un labyrinthe parfait est frustrant à l'aveugle. On casse ensuite aléatoirement environ **12 %** des murs internes restants. Le résultat offre plusieurs routes, des raccourcis risqués, et de petites zones plus ouvertes, des « baies ».

**Tailles de départ :** 8×8 cellules, tuiles de 20 m, soit une carte d'environ 340 m de côté. C'est lisible sur la table du Gardien et assez grand pour se perdre.

## 2. Entrée et Port

1. **Entrée de la baie :** une cellule tirée au hasard sur le **bord sud**. On ouvre le mur extérieur vers la mer.
2. **Port :** on lance un **BFS** (parcours en largeur) depuis l'entrée et on choisit la cellule **la plus éloignée** en nombre de pas. Cela garantit un trajet long et intéressant.
3. Le BFS donne aussi le **chemin solution**, que l'on garde en mémoire pour la suite (récifs, balises, difficulté).

## 3. Des côtes naturelles : champ lissé + bruit

La grille de tuiles donne des murs en escalier. Pour obtenir des côtes organiques, on calcule une valeur continue d'« eau » en tout point (x, z) :

```ts
/** > 0.5 = eau, < 0.5 = terre. */
export function waterness(x: number, z: number, tiles: boolean[][], noise2D: (x: number, z: number) => number) {
  const base = bilinearSample(tiles, x / TILE, z / TILE);       // 0 ou 1, interpolé entre tuiles
  const smooth = blur3x3(base);                                 // adoucit les angles
  const n = 0.6 * noise2D(x * 0.02, z * 0.02)                   // grandes ondulations
          + 0.4 * noise2D(x * 0.08, z * 0.08);                  // petits détails
  return smooth + n * 0.18;                                     // 0.18 = « amplitude de côte »
}
```

- **Mesh du terrain :** une grille `PlaneGeometry` (par exemple 256×256 segments) dont la hauteur vaut `(0.5 - waterness) * 25`. La terre sort de l'eau, et la mer est un plan simple à `y = 0`.
- **Style low-poly :** `flatShading: true` et un `MeshToonMaterial`, avec une couleur selon la hauteur (sable, herbe sombre, roche).
- **Hauts-fonds :** les zones où `waterness` est entre `0.5` et `0.58` sont de l'eau **trop peu profonde**. Le bateau y ralentit fortement. On les révèle au filtre **bleu**.

## 4. Garantir que c'est navigable

Le bruit pourrait refermer un passage étroit. On vérifie donc :

1. On échantillonne `waterness` sur une **grille de collision** fine (cases de 2 m).
2. Une case est **navigable** si elle est de l'eau et si toutes ses voisines dans un rayon de 3 m (le rayon du bateau) le sont aussi.
3. On fait un **flood fill** (BFS) depuis l'entrée. Si le Port n'est pas atteint, on recommence toute la génération avec `seed + 1`.

```ts
export function generateLevel(seed: number, params = DEFAULT_PARAMS): LevelData {
  for (let attempt = 0; attempt < 20; attempt++) {
    const level = tryGenerate(seed + attempt, params);
    if (isNavigable(level)) return level;
  }
  throw new Error("Impossible de générer un niveau navigable");  // en pratique, n'arrive pas
}
```

Cette grille de collision sert **aussi au serveur** pour la physique du bateau : on teste la case sous la proue. Si elle n'est pas navigable, le bateau s'arrête avec un petit rebond et un son de coque qui frotte. On ne fait aucun dégât, c'est un jeu cozy.

## 5. Habillage

| Élément | Règle de placement | Effet |
|---|---|---|
| **Récifs** (rochers isolés) | dans les **culs-de-sac** et les couloirs **hors chemin solution**, en laissant toujours un passage de 6 m minimum | obstacle, révélé par la lumière blanche |
| **Courants** | 2 à 4 couloirs, dont au moins un **sur** le chemin solution. Direction = le long du couloir, dans un sens aléatoire | poussent le bateau (aide ou gêne), visibles au filtre **rouge** |
| **Hauts-fonds** | issus du champ `waterness` (voir 3.) | ralentissement, visibles au filtre **bleu** |
| **Phare** | sur une grande zone de terre près du **centre** de la carte, avec une portée réglée pour couvrir toute la carte | source du faisceau |
| **Port** | au bout du chemin, avec un ponton et des lanternes | fin de la nuit |

## 6. Balises sonores

```ts
export type BeaconPattern = "bell4" | "horn2" | "whistle3" | "gong6";

export interface Beacon {
  id: string;
  pattern: BeaconPattern;   // « cloche toutes les 4 s », etc.
  x: number; z: number;
  sector: Sector;
  audibleRadius: number;    // ~60 m, au-delà on n'entend rien
}
```

**Règles :**
- 4 balises par nuit, chacune avec un **motif différent** ;
- dans des **secteurs différents**, éloignés d'au moins 2 secteurs les uns des autres ;
- de préférence **à moins de 2 cellules du chemin solution**, pour qu'elles soient réellement utiles.

Côté client, le son est **spatialisé** (`PannerNode` de Web Audio, ou `PositionalAudio` de Three.js) : le Capitaine entend d'où il vient et à quelle distance environ.

## 7. Paramètres de difficulté

Toutes les valeurs ci-dessus sont regroupées dans un seul objet, pour régler la difficulté d'une nuit :

```ts
export const DEFAULT_PARAMS = {
  mazeW: 8, mazeH: 8,
  tileSize: 20,
  braidRatio: 0.12,
  coastAmplitude: 0.18,
  reefCount: 10,
  currentCount: 3,
  beaconCount: 4,
  gridCols: 6, gridRows: 6,       // grille de repérage A–F / 1–6
};
```

Idée de progression : nuit 1 = 6×6 cellules, sans courants. Ensuite, on agrandit et on ajoute des mécaniques au fil des nuits.

## Tester la génération sans jouer

Premier outil à coder (jalon 4) : une page **`/debug/levelgen`** qui dessine la carte vue de dessus dans un `<canvas>` 2D, avec un champ « seed » et un bouton « Suivant ». On y voit en un coup d'œil si les niveaux sont beaux et jouables. On réutilisera ensuite ce dessin comme **base de la carte du Gardien**.
