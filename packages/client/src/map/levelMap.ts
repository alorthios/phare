import { columnLabel, type Level } from "@phare/shared";

export const MAP_COLORS = {
  background: "#0b1630",
  deep: [15, 35, 64],
  shallow: [26, 61, 102],
  sand: [120, 108, 80],
  grass: [46, 70, 56],
  hill: [36, 52, 44],
  grid: "rgba(255, 217, 138, 0.18)",
  gridLabel: "rgba(255, 217, 138, 0.75)",
  solution: "rgba(255, 122, 89, 0.85)",
  nav: "rgba(155, 227, 165, 0.25)",
  marker: "#ffd98a",
} as const;

/**
 * Dessine le champ « eau / terre » dans une petite image (1 pixel = 1 case de fieldRes mètres).
 * On la calcule une seule fois, puis on l'agrandit à chaque affichage.
 */
export function renderLevelImage(level: Level, showNav = false): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = level.fieldCols;
  canvas.height = level.fieldRows;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(level.fieldCols, level.fieldRows);

  for (let k = 0; k < level.field.length; k++) {
    const w = level.field[k];
    let c: readonly number[];
    if (w > 0.62) c = MAP_COLORS.deep;
    else if (w > 0.5) c = MAP_COLORS.shallow;
    else if (w > 0.44) c = MAP_COLORS.sand;
    else if (w > 0.2) c = MAP_COLORS.grass;
    else c = MAP_COLORS.hill;

    let [r, g, b] = c;
    if (showNav && level.nav[k]) { r += 20; g += 50; b += 25; }   // zone navigable en vert (debug)
    img.data.set([r, g, b, 255], k * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Comment la carte est posée à l'écran : px = ox + (x - originX) * scale. */
export interface MapView {
  scale: number;   // pixels par mètre
  ox: number;
  oy: number;
}

/** Cadre la carte entière dans un rectangle (en pixels), en laissant `pad` pixels de marge. */
export function fitView(level: Level, x: number, y: number, width: number, height: number, pad = 0): MapView {
  const scale = Math.min((width - 2 * pad) / level.sizeX, (height - 2 * pad) / level.sizeZ);
  return {
    scale,
    ox: x + (width - level.sizeX * scale) / 2,
    oy: y + (height - level.sizeZ * scale) / 2,
  };
}

export const toPx = (level: Level, v: MapView, x: number, z: number): [number, number] =>
  [v.ox + (x - level.originX) * v.scale, v.oy + (z - level.originZ) * v.scale];

export interface MapOptions {
  grid?: boolean;
  solution?: boolean;
  markers?: boolean;
}

/** Dessine la carte : terrain, grille de repérage A–F / 1–6, entrée et port. */
export function drawLevelMap(
  ctx: CanvasRenderingContext2D, level: Level, image: HTMLCanvasElement, v: MapView, opts: MapOptions = {},
) {
  const { grid = true, solution = false, markers = true } = opts;
  const dpr = ctx.canvas.width / ctx.canvas.clientWidth || 1;

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, v.ox, v.oy, level.sizeX * v.scale, level.sizeZ * v.scale);

  if (grid) {
    const g = level.grid;
    const [gx, gy] = toPx(level, v, g.originX, g.originZ);
    const step = g.sectorSize * v.scale;
    ctx.strokeStyle = MAP_COLORS.grid;
    ctx.lineWidth = 1 * dpr;
    for (let c = 0; c <= g.cols; c++) {
      ctx.beginPath(); ctx.moveTo(gx + c * step, gy); ctx.lineTo(gx + c * step, gy + g.rows * step); ctx.stroke();
    }
    for (let r = 0; r <= g.rows; r++) {
      ctx.beginPath(); ctx.moveTo(gx, gy + r * step); ctx.lineTo(gx + g.cols * step, gy + r * step); ctx.stroke();
    }
    ctx.fillStyle = MAP_COLORS.gridLabel;
    ctx.font = `${Math.round(13 * dpr)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c < g.cols; c++) ctx.fillText(columnLabel(c), gx + (c + 0.5) * step, gy - 12 * dpr);
    for (let r = 0; r < g.rows; r++) ctx.fillText(String(r + 1), gx - 12 * dpr, gy + (r + 0.5) * step);
  }

  if (solution) {
    ctx.strokeStyle = MAP_COLORS.solution;
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.beginPath();
    level.solution.forEach((p, i) => {
      const [x, y] = toPx(level, v, p.x, p.z);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (markers) {
    ctx.fillStyle = MAP_COLORS.marker;
    ctx.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    const [ex, ey] = toPx(level, v, level.spawn.x, level.spawn.z);
    ctx.fillText("▲ Entrée", ex, ey - 14 * dpr);
    const [px, py] = toPx(level, v, level.port.x, level.port.z);
    ctx.font = `${Math.round(18 * dpr)}px system-ui, sans-serif`;
    ctx.fillText("⚓", px, py);
    ctx.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
    ctx.fillText("Port", px, py + 16 * dpr);
  }
}
