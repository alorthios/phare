import { createRng } from "../rng.ts";
import { braid, carveMaze, cellBfs, setTile, tileAt, type TileGrid } from "./maze.ts";
import { createNoise2D } from "./noise.ts";

// ⚠️ Tout ce fichier doit donner un résultat IDENTIQUE au bit près sur le serveur et
// dans chaque navigateur : uniquement de l'arithmétique simple et le rng à seed.
// Pas de Math.random, ni de Math.sin / cos / exp / hypot (leurs derniers chiffres
// peuvent varier d'un moteur JavaScript à l'autre).

export const DEFAULT_LEVEL_PARAMS = {
  mazeW: 8,              // cellules du labyrinthe en largeur
  mazeH: 8,              // … et en hauteur
  tileSize: 20,          // mètres par tuile (un couloir fait ~1 tuile de large)
  marginTiles: 2,        // bande de terre autour du labyrinthe
  braidRatio: 0.12,      // part des murs ouverts pour créer des boucles
  warpAmplitude: 0.5,    // déformation lente de la grille (en tuiles) : couloirs sinueux
  coastAmplitude: 0.3,   // bruit fin sur les côtes : rivages découpés
  fieldRes: 2,           // mètres par case du champ « eau / terre » et de la grille de collision
  boatRadius: 3,         // le bateau a besoin de ce dégagement autour de son centre
  gridCols: 6,           // grille de repérage A–F …
  gridRows: 6,           // … et 1–6
};
export type LevelParams = typeof DEFAULT_LEVEL_PARAMS;

export interface Point { x: number; z: number; }

/** Grille de repérage (secteurs A-1 … F-6) posée sur la zone du labyrinthe. */
export interface SectorGrid {
  cols: number;
  rows: number;
  originX: number;   // coin nord-ouest
  originZ: number;
  sectorSize: number;
}

export interface Level {
  /** Seed effectivement utilisé (seed demandé + nombre de nouvelles tentatives). */
  seed: number;
  attempts: number;
  params: LevelParams;
  tiles: TileGrid;
  /** Coin nord-ouest de la carte et taille, en mètres. Le centre de la carte est (0, 0). */
  originX: number;
  originZ: number;
  sizeX: number;
  sizeZ: number;
  /** Champ « eau » échantillonné tous les fieldRes mètres : > 0.5 = eau, < 0.5 = terre. */
  field: Float32Array;
  fieldCols: number;
  fieldRows: number;
  /** Grille de collision (même résolution) : 1 = le bateau peut s'y trouver. */
  nav: Uint8Array;
  /** Point de départ du bateau, à l'entrée de la baie, cap au nord. */
  spawn: Point & { heading: number };
  entry: Point;
  port: Point;
  /** Chemin le plus court (centres des cellules), de l'entrée au port. */
  solution: Point[];
  grid: SectorGrid;
}

/**
 * Génère le niveau d'une nuit. Si le bruit a refermé un passage (rare),
 * on recommence avec seed + 1, puis seed + 2… Le résultat reste déterministe.
 */
export function generateLevel(seed: number, params: LevelParams = DEFAULT_LEVEL_PARAMS): Level {
  for (let attempt = 0; attempt < 30; attempt++) {
    const level = tryGenerate((seed + attempt) >>> 0, params);
    if (level) {
      level.attempts = attempt + 1;
      return level;
    }
  }
  throw new Error(`Impossible de générer un niveau navigable (seed ${seed})`);
}

function tryGenerate(seed: number, p: LevelParams): Level | null {
  const rng = createRng(seed);

  // 1. Labyrinthe + boucles
  const maze = carveMaze(p.mazeW, p.mazeH, rng);
  braid(maze, p.braidRatio, rng);

  // 2. Entrée (bord sud) et Port (la cellule la plus éloignée de l'entrée)
  const entryCell: [number, number] = [rng.int(0, p.mazeW - 1), p.mazeH - 1];
  const bfs = cellBfs(maze, p.mazeW, p.mazeH, entryCell);
  let portId = 0;
  for (let i = 1; i < bfs.dist.length; i++) if (bfs.dist[i] > bfs.dist[portId]) portId = i;
  const portCell: [number, number] = [portId % p.mazeW, Math.floor(portId / p.mazeW)];

  // 3. On entoure le labyrinthe d'une bande de terre, et on creuse le chenal d'entrée jusqu'au bord sud.
  const m = p.marginTiles;
  const tiles: TileGrid = { cols: maze.cols + 2 * m, rows: maze.rows + 2 * m, data: new Uint8Array(0) };
  tiles.data = new Uint8Array(tiles.cols * tiles.rows);
  for (let ty = 0; ty < maze.rows; ty++) {
    for (let tx = 0; tx < maze.cols; tx++) setTile(tiles, tx + m, ty + m, tileAt(maze, tx, ty));
  }
  const entryTx = m + 2 * entryCell[0] + 1;
  for (let ty = m + maze.rows - 1; ty < tiles.rows; ty++) setTile(tiles, entryTx, ty, 1);

  const sizeX = tiles.cols * p.tileSize;
  const sizeZ = tiles.rows * p.tileSize;
  const originX = -sizeX / 2;
  const originZ = -sizeZ / 2;
  const cellCenter = ([cx, cy]: [number, number]): Point => ({
    x: originX + (m + 2 * cx + 1.5) * p.tileSize,
    z: originZ + (m + 2 * cy + 1.5) * p.tileSize,
  });

  // 4. Champ « eau » : tuiles lissées + bruit → côtes naturelles.
  //    a) Déformation du domaine : on lit la grille de tuiles à une position légèrement décalée
  //       par un bruit lent. Les couloirs ondulent, mais restent d'un seul tenant.
  //    b) Un bruit plus fin découpe les rivages.
  const noise = createNoise2D(rng);
  const fieldCols = Math.round(sizeX / p.fieldRes);
  const fieldRows = Math.round(sizeZ / p.fieldRes);
  const field = new Float32Array(fieldCols * fieldRows);
  for (let j = 0; j < fieldRows; j++) {
    for (let i = 0; i < fieldCols; i++) {
      const x = originX + (i + 0.5) * p.fieldRes;
      const z = originZ + (j + 0.5) * p.fieldRes;
      const warpU = p.warpAmplitude * noise(x * 0.012 + 101.3, z * 0.012 + 7.1);
      const warpV = p.warpAmplitude * noise(x * 0.012 - 55.9, z * 0.012 + 203.7);
      const coast = 0.6 * noise(x * 0.05, z * 0.05) + 0.4 * noise(x * 0.13 + 31.7, z * 0.13 - 12.3);
      field[j * fieldCols + i] = smoothTileSample(
        tiles,
        (x - originX) / p.tileSize + warpU,
        (z - originZ) / p.tileSize + warpV,
      ) + p.coastAmplitude * coast;
    }
  }

  const spawn = {
    x: originX + (entryTx + 0.5) * p.tileSize,
    z: originZ + (tiles.rows - 0.5) * p.tileSize,   // au centre de la dernière tuile du chenal, au bord sud
    heading: 0,
  };
  const entry = cellCenter(entryCell);
  const port = cellCenter(portCell);

  // 5. Chenal d'entrée bien droit : la déformation pourrait le tordre au point de bloquer le départ.
  //    On creuse un couloir rectiligne du bord sud jusqu'à la cellule d'entrée, qui se fond dans le labyrinthe.
  const mazeBottom = originZ + (m + maze.rows) * p.tileSize;
  for (let j = 0; j < fieldRows; j++) {
    const z = originZ + (j + 0.5) * p.fieldRes;
    const fade = Math.min(1, Math.max(0, (z - (mazeBottom - 1.5 * p.tileSize)) / p.tileSize));
    if (fade === 0) continue;
    for (let i = 0; i < fieldCols; i++) {
      const x = originX + (i + 0.5) * p.fieldRes;
      const channel = (1.2 - (1.4 * Math.abs(x - spawn.x)) / p.tileSize) * fade;
      const k = j * fieldCols + i;
      if (channel > field[k]) field[k] = channel;
    }
  }

  // 6. Grille de collision : eau, avec assez de dégagement pour la coque du bateau.
  const nav = buildNavGrid(field, fieldCols, fieldRows, p.boatRadius / p.fieldRes);

  // 7. Vérifications, sinon on recommence avec le seed suivant :
  //    a) depuis le départ, on peut avancer tout droit (proue comprise) jusqu'à la cellule d'entrée ;
  //    b) le Port est atteignable.
  const toFieldIndex = (pt: Point) => {
    const i = Math.floor((pt.x - originX) / p.fieldRes);
    const j = Math.floor((pt.z - originZ) / p.fieldRes);
    return j * fieldCols + i;
  };
  for (let z = spawn.z; z >= entry.z - 6; z -= p.fieldRes) {
    if (!nav[toFieldIndex({ x: spawn.x, z })]) return null;
  }
  if (!reachable(nav, fieldCols, fieldRows, toFieldIndex(spawn), toFieldIndex(port))) return null;

  const mazeSize = maze.cols * p.tileSize;
  return {
    seed,
    attempts: 1,
    params: p,
    tiles,
    originX, originZ, sizeX, sizeZ,
    field, fieldCols, fieldRows,
    nav,
    spawn,
    entry,
    port,
    solution: [spawn, ...bfs.pathTo(portCell).map(cellCenter)],
    grid: {
      cols: p.gridCols,
      rows: p.gridRows,
      originX: originX + m * p.tileSize,
      originZ: originZ + m * p.tileSize,
      sectorSize: mazeSize / p.gridCols,
    },
  };
}

/** Valeur des tuiles (0 ou 1) interpolée en douceur entre leurs centres. u, v en unités de tuile. */
function smoothTileSample(tiles: TileGrid, u: number, v: number): number {
  const fu = u - 0.5, fv = v - 0.5;
  const i0 = Math.floor(fu), j0 = Math.floor(fv);
  const s = smooth(fu - i0), t = smooth(fv - j0);
  const at = (i: number, j: number) => tileAt(
    tiles,
    Math.min(tiles.cols - 1, Math.max(0, i)),   // hors carte : on prolonge le bord (le chenal reste ouvert)
    Math.min(tiles.rows - 1, Math.max(0, j)),
  );
  const top = at(i0, j0) + (at(i0 + 1, j0) - at(i0, j0)) * s;
  const bottom = at(i0, j0 + 1) + (at(i0 + 1, j0 + 1) - at(i0, j0 + 1)) * s;
  return top + (bottom - top) * t;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Une case est navigable si toutes les cases dans le rayon du bateau sont de l'eau. */
function buildNavGrid(field: Float32Array, cols: number, rows: number, radiusCells: number): Uint8Array {
  const r = Math.ceil(radiusCells);
  const r2 = radiusCells * radiusCells;
  const offsets: [number, number][] = [];
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (di * di + dj * dj <= r2) offsets.push([di, dj]);

  const nav = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let ok = 1;
      for (const [di, dj] of offsets) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows || field[jj * cols + ii] <= 0.5) { ok = 0; break; }
      }
      nav[j * cols + i] = ok;
    }
  }
  return nav;
}

/** Remplissage (flood fill) depuis `from` : peut-on atteindre `to` ? */
function reachable(nav: Uint8Array, cols: number, rows: number, from: number, to: number): boolean {
  if (!nav[from] || !nav[to]) return false;
  const seen = new Uint8Array(nav.length);
  const queue = [from];
  seen[from] = 1;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    if (id === to) return true;
    const i = id % cols, j = (id - i) / cols;
    if (i > 0) visit(id - 1);
    if (i < cols - 1) visit(id + 1);
    if (j > 0) visit(id - cols);
    if (j < rows - 1) visit(id + cols);
  }
  return false;

  function visit(n: number) {
    if (nav[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
  }
}

// --- Questions posées au niveau (serveur et clients) ---------------------------

/** Le bateau peut-il se trouver en (x, z) ? (hors carte = non) */
export function isNavigable(level: Level, x: number, z: number): boolean {
  const i = Math.floor((x - level.originX) / level.params.fieldRes);
  const j = Math.floor((z - level.originZ) / level.params.fieldRes);
  if (i < 0 || j < 0 || i >= level.fieldCols || j >= level.fieldRows) return false;
  return level.nav[j * level.fieldCols + i] === 1;
}

export interface Sector { col: number; row: number; }

export function sectorAt(grid: SectorGrid, x: number, z: number): Sector | null {
  const col = Math.floor((x - grid.originX) / grid.sectorSize);
  const row = Math.floor((z - grid.originZ) / grid.sectorSize);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  return { col, row };
}

export const columnLabel = (col: number) => "ABCDEFGHIJ"[col];
export const sectorLabel = (s: Sector) => `${columnLabel(s.col)}-${s.row + 1}`;
