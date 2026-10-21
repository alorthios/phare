import { RADIO, ROLE_INFO, isRole } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";
import type { LinkStatus, Radio } from "../radio/radio.ts";
import { h, showScreen } from "./dom.ts";

const LINK_LABELS: Record<LinkStatus, string> = {
  waiting: "En attente de la radio du coéquipier…",
  connecting: "Liaison en cours…",
  connected: "Liaison établie ✔",
  lost: "Liaison perdue ✘ (vérifiez le réseau)",
};

/**
 * Le poste radio (jalon 2). Plus tard, il deviendra un objet dans la scène 3D
 * du Capitaine et du Gardien ; pour l'instant c'est un écran de test.
 * Renvoie une fonction de nettoyage.
 */
export function showRadioScreen(room: NightRoom, radio: Radio): () => void {
  const me = room.state.players.get(room.sessionId);
  const myRole = me && isRole(me.role) ? ROLE_INFO[me.role].title : "";

  const mateLine = h("p", { class: "hint" });
  const led = h("span", { class: "led" });
  const ledLabel = h("span", { class: "led-label" });
  const linkLine = h("p", { class: "link-status" });
  const meterFill = h("span", { class: "meter-fill" });

  const pttButton = h("button", { class: "ptt" }, "Maintenir pour parler");
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

  showScreen(
    h("div", { class: "card radio" },
      h("p", { class: "code-label" }, `Poste radio · ${myRole}`),
      mateLine,
      h("div", { class: "led-panel" }, led, ledLabel),
      linkLine,
      pttButton,
      h("p", { class: "hint" }, "Ou maintiens la touche [Espace]. Utilise un casque pour éviter l'écho."),
      h("div", { class: "meter", title: "Niveau de ton micro" },
        h("span", { class: "meter-label" }, "Micro"),
        h("span", { class: "meter-track" }, meterFill),
      ),
      h("details", { class: "debug", open: true },
        h("summary", {}, "Debug · qualité du signal"),
        h("div", { class: "row" }, slider, qualityValue),
        h("p", { class: "hint" },
          "Simule la distance au faisceau du phare. Les deux joueurs entendent le même effet."),
      ),
      h("button", { class: "link", onclick: () => { room.leave(); } }, "Quitter la partie"),
    ),
  );

  const update = () => {
    const state = room.state;
    const mate = [...state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
    mateLine.textContent = mate
      ? `En liaison avec ${mate.name}${mate.radioReady ? "" : " (radio éteinte)"}`
      : "Ton coéquipier a quitté la partie.";

    let mode: "tx" | "rx" | "wait" | "idle" = "idle";
    let label = "Canal libre";
    if (radio.transmitting && radio.isPressed) {
      mode = "tx"; label = "EN ÉMISSION";
    } else if (radio.isPressed) {
      mode = "wait"; label = radio.incomingFrom ? "Canal occupé" : "Ouverture du canal…";
    } else if (radio.incomingFrom) {
      const speaker = state.players.get(radio.incomingFrom)?.name ?? "Ton coéquipier";
      mode = "rx"; label = `RÉCEPTION · ${speaker} parle`;
    }
    led.className = `led ${mode}`;
    ledLabel.textContent = label;
    pttButton.classList.toggle("active", mode === "tx");

    linkLine.textContent = LINK_LABELS[radio.linkStatus];
    linkLine.className = `link-status ${radio.linkStatus}`;

    const q = state.signalQuality ?? 1;
    if (document.activeElement !== slider) slider.value = String(q);
    qualityValue.textContent = `${Math.round(q * 100)} %`;
  };
  radio.onChange = update;
  update();

  // Vumètre du micro, rafraîchi à chaque image.
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

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    radio.onChange = undefined;
  };
}
