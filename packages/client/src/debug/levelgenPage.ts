import { generateLevel, type Level } from "@phare/shared";
import { h } from "../ui/dom.ts";
import { drawLevelMap, fitView, renderLevelImage } from "../map/levelMap.ts";

/**
 * Page /debug/levelgen : feuilleter les archipels générés, sans lancer de partie.
 * Pratique pour régler les paramètres de génération (packages/shared/src/levelgen/level.ts).
 */
export function showLevelgenPage() {
  document.body.classList.add("in-game");

  const canvas = h("canvas");
  const ctx = canvas.getContext("2d")!;
  const seedInput = h("input", { type: "number", min: "0", "aria-label": "Seed" });
  const showSolution = h("input", { type: "checkbox", id: "dbg-sol" });
  const showNav = h("input", { type: "checkbox", id: "dbg-nav" });
  const stats = h("p", { class: "hud-small" });

  const initialSeed = Number(new URLSearchParams(location.search).get("seed")) || 42;
  seedInput.value = String(initialSeed);

  let level: Level;
  let image: HTMLCanvasElement;

  const regenerate = () => {
    const seed = Math.max(0, Math.floor(Number(seedInput.value) || 0));
    seedInput.value = String(seed);
    history.replaceState(null, "", `?seed=${seed}`);
    const started = performance.now();
    level = generateLevel(seed);
    const ms = performance.now() - started;
    image = renderLevelImage(level, showNav.checked);
    stats.textContent = `${Math.round(ms)} ms · ${level.attempts} essai(s) · seed utilisé ${level.seed} · `
      + `chemin : ${level.solution.length - 1} cellules · carte ${level.sizeX} × ${level.sizeZ} m`;
    draw();
  };

  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.fillStyle = "#0b1630";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = fitView(level, 0, 0, canvas.width, canvas.height, 40 * dpr);
    drawLevelMap(ctx, level, image, view, { solution: showSolution.checked });
  };

  const step = (delta: number) => {
    seedInput.value = String(Math.max(0, Number(seedInput.value) + delta));
    regenerate();
  };

  seedInput.addEventListener("change", regenerate);
  showSolution.addEventListener("change", draw);
  showNav.addEventListener("change", regenerate);
  window.addEventListener("resize", draw);
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement) return;
    if (ev.key === "ArrowRight") step(1);
    if (ev.key === "ArrowLeft") step(-1);
  });

  const root = h("div", { id: "game" },
    canvas,
    h("div", { class: "hud" },
      h("div", { class: "hud-bottom-left" },
        h("div", { class: "hud-panel debug-panel" },
          h("p", { class: "hud-title" }, "Debug · générateur d'archipel"),
          h("div", { class: "row" },
            h("button", { onclick: () => step(-1) }, "←"),
            seedInput,
            h("button", { onclick: () => step(1) }, "→"),
            h("button", { onclick: () => { seedInput.value = String(Math.floor(Math.random() * 2 ** 31)); regenerate(); } }, "🎲"),
          ),
          h("label", { class: "check" }, showSolution, "Chemin le plus court"),
          h("label", { class: "check" }, showNav, "Zone navigable (vert)"),
          stats,
          h("p", { class: "hud-small" }, "Flèches ← → : seed précédent / suivant"),
        ),
      ),
    ),
  );
  document.body.append(root);
  regenerate();
}
