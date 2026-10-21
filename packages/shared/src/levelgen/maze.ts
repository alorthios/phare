import type { Rng } from "../rng.ts";

/**
 * Grille de tuiles : 1 = eau, 0 = terre. Stockée « à plat » ligne par ligne.
 * Une cellule du labyrinthe (cx, cy) correspond à la tuile (2cx+1, 2cy+1) ;
 * les tuiles entre deux cellules sont des murs (terre) ou des passages (eau).
 */
export interface TileGrid {
  cols: number;
  rows: number;
  data: Uint8Array;
}

export const tileAt = (g: TileGrid, tx: number, ty: number) => g.data[ty * g.cols + tx];
export const setTile = (g: TileGrid, tx: number, ty: number, v: number) => { g.data[ty * g.cols + tx] = v; };

/** Labyrinthe « parfait » (un seul chemin entre deux cellules) par backtracker récursif. */
export function carveMaze(w: number, h: number, rng: Rng): TileGrid {
  const grid: TileGrid = { cols: 2 * w + 1, rows: 2 * h + 1, data: new Uint8Array((2 * w + 1) * (2 * h + 1)) };
  const visited = new Uint8Array(w * h);
  const stack: [number, number][] = [[0, 0]];
  visited[0] = 1;
  setTile(grid, 1, 1, 1);

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !visited[ny * w + nx]);

    if (options.length === 0) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = options[0];
    visited[ny * w + nx] = 1;
    setTile(grid, 2 * cx + 1 + dx, 2 * cy + 1 + dy, 1);   // on casse le mur entre les deux cellules
    setTile(grid, 2 * nx + 1, 2 * ny + 1, 1);
    stack.push([nx, ny]);
  }
  return grid;
}

/**
 * « Tressage » : on ouvre une partie des murs restants pour créer des boucles.
 * À l'aveugle, un labyrinthe parfait est frustrant ; avec des boucles, il y a plusieurs routes.
 */
export function braid(grid: TileGrid, ratio: number, rng: Rng) {
  const walls: [number, number][] = [];
  for (let ty = 1; ty < grid.rows - 1; ty++) {
    for (let tx = 1; tx < grid.cols - 1; tx++) {
      const isWallBetweenCells = (tx % 2 === 1) !== (ty % 2 === 1);   // ni cellule, ni pilier d'angle
      if (isWallBetweenCells && tileAt(grid, tx, ty) === 0) walls.push([tx, ty]);
    }
  }
  rng.shuffle(walls);
  const count = Math.floor(walls.length * ratio);
  for (let i = 0; i < count; i++) setTile(grid, walls[i][0], walls[i][1], 1);
}

/** Parcours en largeur entre cellules : distance (en cellules) et chemin depuis `start`. */
export function cellBfs(grid: TileGrid, w: number, h: number, start: [number, number]) {
  const dist = new Int32Array(w * h).fill(-1);
  const parent = new Int32Array(w * h).fill(-1);
  const queue = [start[1] * w + start[0]];
  dist[queue[0]] = 0;

  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    const cx = id % w, cy = (id - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (tileAt(grid, 2 * cx + 1 + dx, 2 * cy + 1 + dy) === 0) continue;   // mur
      const nid = ny * w + nx;
      if (dist[nid] !== -1) continue;
      dist[nid] = dist[id] + 1;
      parent[nid] = id;
      queue.push(nid);
    }
  }

  const pathTo = (target: [number, number]): [number, number][] => {
    const path: [number, number][] = [];
    for (let id = target[1] * w + target[0]; id !== -1; id = parent[id]) path.push([id % w, Math.floor(id / w)]);
    return path.reverse();
  };
  return { dist, pathTo };
}
