import { THROTTLE_LABELS, headingLabel, type BoatPhysicsState } from "@phare/shared";
import { h } from "../ui/dom.ts";

const MS_TO_KNOTS = 1.944;

/** Instruments du Capitaine en surimpression : cap, télégraphe, barre, vitesse. */
export function createCaptainHud() {
  const heading = h("div", { class: "hud-heading" });
  const speed = h("span", { class: "hud-small" });
  const telegraphItems = THROTTLE_LABELS.map((label) => h("li", {}, label)).reverse();
  const rudderMarker = h("span", { class: "rudder-marker" });

  const instruments = h("div", { class: "hud-panel instruments" },
    h("p", { class: "hud-title" }, "Télégraphe"),
    h("ol", { class: "telegraph" }, ...telegraphItems),
    speed,
    h("p", { class: "hud-title" }, "Barre"),
    h("div", { class: "rudder-track" }, h("span", { class: "rudder-center" }), rudderMarker),
    h("p", { class: "hud-keys" }, "Z/S : machine · Q/D : barre (ou flèches)"),
  );

  const lockHint = h("div", { class: "lock-hint" },
    h("strong", {}, "Clique pour prendre la barre"),
    h("span", {}, "La souris regarde autour de toi · Échap pour libérer la souris"),
  );

  function update(boat: BoatPhysicsState, throttle: number, pointerLocked: boolean) {
    heading.textContent = `Cap ${headingLabel(boat.heading)}`;
    speed.textContent = `Vitesse : ${(Math.abs(boat.speed) * MS_TO_KNOTS).toFixed(1)} nœuds${boat.speed < -0.05 ? " (arrière)" : ""}`;
    telegraphItems.forEach((li, i) => {
      li.classList.toggle("current", THROTTLE_LABELS.length - 1 - i === throttle);
    });
    rudderMarker.style.left = `${50 + boat.rudder * 45}%`;
    lockHint.hidden = pointerLocked;
  }

  return { heading, instruments, lockHint, update };
}
