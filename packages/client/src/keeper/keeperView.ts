import { BOAT, generateTestWorld, headingLabel } from "@phare/shared";
import { BoatInterpolator } from "../net/boatInterpolator.ts";
import type { NightRoom } from "../net/connection.ts";
import { h } from "../ui/dom.ts";

const MAP = {
  sea: "#0f2340",
  grid: "rgba(159, 176, 208, 0.12)",
  gridLabel: "rgba(159, 176, 208, 0.45)",
  border: "rgba(255, 217, 138, 0.5)",
  rock: "#56647e",
  red: "#c8463c",
  green: "#3c9a5a",
  boat: "#ffd98a",
  trail: "rgba(255, 217, 138, 0.35)",
};
const GRID_STEP = 50;   // un carreau = 50 m

/**
 * Vue PROVISOIRE du Gardien (jalon 3) : une carte vue de dessus où l'on voit le bateau bouger.
 * Au jalon 5, le bateau n'y apparaîtra plus : il faudra le trouver avec le projecteur.
 * Renvoie une fonction de nettoyage.
 */
export function startKeeperView(room: NightRoom, root: HTMLElement, overlay: HTMLElement): () => void {
  const canvas = h("canvas", { class: "keeper-map" });
  root.prepend(canvas);
  const ctx = canvas.getContext("2d")!;
  const world = generateTestWorld(room.state.seed ?? 1);

  const info = h("span", { class: "hud-small" });
  overlay.append(
    h("div", { class: "hud-top" },
      h("div", { class: "hud-heading" }, "Table des cartes"),
    ),
    h("div", { class: "hud-bottom-left" },
      h("div", { class: "hud-panel" },
        h("p", { class: "hud-title" }, "Vue provisoire"),
        h("p", { class: "hud-small" }, "Pour tester, le bateau est visible. Au jalon 5, il faudra le trouver avec le projecteur."),
        info,
      ),
    ),
  );

  const interpolator = new BoatInterpolator();
  const onState = () => { if (room.state.boat) interpolator.push(room.state.boat); };
  room.onStateChange(onState);
  onState();

  const trail: { x: number; z: number }[] = [];
  let lastTrailTime = 0;

  // Conversion mètres → pixels : la zone de test entière tient dans l'écran.
  let scale = 1, cx = 0, cy = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = root.clientWidth * dpr;
    canvas.height = root.clientHeight * dpr;
    canvas.style.width = `${root.clientWidth}px`;
    canvas.style.height = `${root.clientHeight}px`;
    // On laisse de la place en haut pour le titre « Table des cartes ».
    const top = 70 * dpr;
    scale = (Math.min(canvas.width, canvas.height - top) * 0.92) / (BOAT.worldHalfSize * 2);
    cx = canvas.width / 2;
    cy = top + (canvas.height - top) / 2;
  };
  window.addEventListener("resize", resize);
  resize();

  // Le nord (-Z) est en haut : x → droite, z → bas, comme le repère du monde.
  const px = (x: number) => cx + x * scale;
  const py = (z: number) => cy + z * scale;

  let frame = requestAnimationFrame(function draw(now) {
    const b = interpolator.sample(now);
    const half = BOAT.worldHalfSize;

    ctx.fillStyle = MAP.sea;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Quadrillage
    ctx.strokeStyle = MAP.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = MAP.gridLabel;
    ctx.font = `${Math.max(10, 11 * scale)}px system-ui, sans-serif`;
    for (let v = -half; v <= half; v += GRID_STEP) {
      ctx.beginPath(); ctx.moveTo(px(v), py(-half)); ctx.lineTo(px(v), py(half)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(-half), py(v)); ctx.lineTo(px(half), py(v)); ctx.stroke();
    }
    ctx.strokeStyle = MAP.border;
    ctx.strokeRect(px(-half), py(-half), half * 2 * scale, half * 2 * scale);
    ctx.fillText("N ↑", px(-half) + 6, py(-half) + 16);

    // Rochers et bouées
    ctx.fillStyle = MAP.rock;
    for (const r of world.rocks) {
      ctx.beginPath(); ctx.arc(px(r.x), py(r.z), Math.max(2, r.size * scale), 0, Math.PI * 2); ctx.fill();
    }
    for (const buoy of world.buoys) {
      ctx.fillStyle = MAP[buoy.color];
      ctx.beginPath(); ctx.arc(px(buoy.x), py(buoy.z), Math.max(2, 1.2 * scale), 0, Math.PI * 2); ctx.fill();
    }

    // Sillage : un point toutes les 0,5 s
    if (now - lastTrailTime > 500) {
      trail.push({ x: b.x, z: b.z });
      if (trail.length > 120) trail.shift();
      lastTrailTime = now;
    }
    ctx.fillStyle = MAP.trail;
    for (const p of trail) ctx.fillRect(px(p.x) - 1, py(p.z) - 1, 2, 2);

    // Le bateau : un triangle pointé vers son cap
    const size = Math.max(8, 6 * scale);
    ctx.save();
    ctx.translate(px(b.x), py(b.z));
    ctx.rotate(b.heading);
    ctx.fillStyle = MAP.boat;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.55, size * 0.7);
    ctx.lineTo(-size * 0.55, size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    info.textContent = `Bateau : cap ${headingLabel(b.heading)} · ${(Math.abs(b.speed) * 1.944).toFixed(1)} nœuds`;
    frame = requestAnimationFrame(draw);
  });

  return () => {
    cancelAnimationFrame(frame);
    room.onStateChange.remove(onState);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
}
