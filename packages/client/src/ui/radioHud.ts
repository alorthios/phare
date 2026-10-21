import { RADIO } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";
import type { LinkStatus, Radio } from "../radio/radio.ts";
import { h } from "./dom.ts";

const LINK_LABELS: Record<LinkStatus, string> = {
  waiting: "En attente de la radio du coéquipier…",
  connecting: "Liaison en cours…",
  connected: "Liaison établie",
  lost: "Liaison perdue ✘",
};

/**
 * Petit poste radio affiché en surimpression pendant la partie (Capitaine et Gardien).
 * Push-to-Talk : maintenir [Espace] (ou le bouton). Renvoie l'élément et une fonction de nettoyage.
 */
export function createRadioHud(room: NightRoom, radio: Radio) {
  const led = h("span", { class: "led" });
  const ledLabel = h("span", { class: "led-label" });
  const linkLine = h("span", { class: "hud-small" });
  const meterFill = h("span", { class: "meter-fill" });

  const pttButton = h("button", { class: "ptt small" }, "Parler [Espace]");
  pttButton.addEventListener("pointerdown", (ev) => {
    pttButton.setPointerCapture(ev.pointerId);
    radio.press();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    pttButton.addEventListener(type, () => radio.release());
  }

  const qualityValue = h("span", { class: "quality-value" });
  const slider = h("input", {
    type: "range", min: String(RADIO.minQuality), max: "1", step: "0.01",
    "aria-label": "Qualité du signal (debug)",
  });
  slider.addEventListener("input", () => radio.setDebugQuality(Number(slider.value)));
  // Les flèches du clavier servent à piloter : le curseur ne doit pas les capter.
  slider.addEventListener("keydown", (ev) => ev.preventDefault());

  const element = h("div", { class: "hud-panel radio-hud" },
    h("div", { class: "led-row" }, led, ledLabel),
    linkLine,
    pttButton,
    h("div", { class: "meter", title: "Niveau de ton micro" },
      h("span", { class: "meter-label" }, "Micro"),
      h("span", { class: "meter-track" }, meterFill),
    ),
    h("details", { class: "debug" },
      h("summary", {}, "Debug · signal"),
      h("div", { class: "row" }, slider, qualityValue),
    ),
  );

  const update = () => {
    const state = room.state;
    let mode: "tx" | "rx" | "wait" | "idle" = "idle";
    let label = "Canal libre";
    if (radio.transmitting && radio.isPressed) {
      mode = "tx"; label = "EN ÉMISSION";
    } else if (radio.isPressed) {
      mode = "wait"; label = radio.incomingFrom ? "Canal occupé" : "Ouverture…";
    } else if (radio.incomingFrom) {
      const speaker = state.players.get(radio.incomingFrom)?.name ?? "Coéquipier";
      mode = "rx"; label = `${speaker} parle`;
    }
    led.className = `led ${mode}`;
    ledLabel.textContent = label;
    pttButton.classList.toggle("active", mode === "tx");

    linkLine.textContent = LINK_LABELS[radio.linkStatus];
    linkLine.className = `hud-small link-status ${radio.linkStatus}`;

    const q = state.signalQuality ?? 1;
    if (document.activeElement !== slider) slider.value = String(q);
    qualityValue.textContent = `${Math.round(q * 100)} %`;
  };
  radio.onChange = update;
  update();

  let frame = requestAnimationFrame(function loop() {
    meterFill.style.width = `${Math.round(radio.micLevel() * 100)}%`;
    frame = requestAnimationFrame(loop);
  });

  // Touche Espace = Push-to-Talk.
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code !== "Space" || ev.target instanceof HTMLInputElement) return;
    ev.preventDefault();
    if (!ev.repeat) radio.press();
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.code !== "Space") return;
    ev.preventDefault();
    radio.release();
  };
  const onBlur = () => radio.release();   // fenêtre quittée : on ne reste pas bloqué en émission
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  const dispose = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    radio.onChange = undefined;
  };

  return { element, dispose };
}
