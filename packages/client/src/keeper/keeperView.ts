import { headingLabel, sectorAt, sectorLabel, type Level } from "@phare/shared";
import { BoatInterpolator } from "../net/boatInterpolator.ts";
import type { NightRoom } from "../net/connection.ts";
import { drawLevelMap, fitView, renderLevelImage, toPx } from "../map/levelMap.ts";
import { h } from "../ui/dom.ts";

/**
 * Vue PROVISOIRE du Gardien : la carte de l'archipel (grille A–F / 1–6), où l'on voit le bateau.
 * Au jalon 5, le bateau n'y apparaîtra plus : il faudra le trouver avec le projecteur.
 * Renvoie une fonction de nettoyage.
 */
export function startKeeperView(room: NightRoom, level: Level, root: HTMLElement, overlay: HTMLElement): () => void {
  const canvas = h("canvas", { class: "keeper-map" });
  root.prepend(canvas);
  const ctx = canvas.getContext("2d")!;
  const image = renderLevelImage(level);

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

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = root.clientWidth * dpr;
    canvas.height = root.clientHeight * dpr;
    canvas.style.width = `${root.clientWidth}px`;
    canvas.style.height = `${root.clientHeight}px`;
  };
  window.addEventListener("resize", resize);
  resize();

  let frame = requestAnimationFrame(function draw(now) {
    const dpr = canvas.width / canvas.clientWidth || 1;
    const b = interpolator.sample(now);

    ctx.fillStyle = "#0b1630";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // On laisse de la place en haut pour le titre.
    const top = 64 * dpr;
    const view = fitView(level, 0, top, canvas.width, canvas.height - top, 28 * dpr);
    drawLevelMap(ctx, level, image, view);

    // Sillage : un point toutes les 0,5 s
    if (now - lastTrailTime > 500) {
      trail.push({ x: b.x, z: b.z });
      if (trail.length > 160) trail.shift();
      lastTrailTime = now;
    }
    ctx.fillStyle = "rgba(255, 217, 138, 0.4)";
    for (const p of trail) {
      const [x, y] = toPx(level, view, p.x, p.z);
      ctx.fillRect(x - dpr, y - dpr, 2 * dpr, 2 * dpr);
    }

    // Le bateau : un triangle pointé vers son cap (le nord est en haut)
    const [bx, by] = toPx(level, view, b.x, b.z);
    const size = Math.max(7 * dpr, 6 * view.scale);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(b.heading);
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.55, size * 0.7);
    ctx.lineTo(-size * 0.55, size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const sector = sectorAt(level.grid, b.x, b.z);
    info.textContent = `Bateau : secteur ${sector ? sectorLabel(sector) : "hors grille"} · cap ${headingLabel(b.heading)} · `
      + `${(Math.abs(b.speed) * 1.944).toFixed(1)} nœuds`;
    frame = requestAnimationFrame(draw);
  });

  return () => {
    cancelAnimationFrame(frame);
    room.onStateChange.remove(onState);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
}
