import { ROLE_INFO, isRole } from "@phare/shared";
import { startCaptainView } from "../captain/captainView.ts";
import { startKeeperView } from "../keeper/keeperView.ts";
import type { NightRoom } from "../net/connection.ts";
import type { Radio } from "../radio/radio.ts";
import { h } from "./dom.ts";
import { createRadioHud } from "./radioHud.ts";

/**
 * Écran de jeu plein écran : la vue du rôle (3D du Capitaine ou carte du Gardien),
 * avec par-dessus la radio et l'état de l'équipage. Renvoie une fonction de nettoyage.
 */
export function showGameScreen(room: NightRoom, radio: Radio): () => void {
  const me = room.state.players.get(room.sessionId);
  const role = me && isRole(me.role) ? me.role : "captain";

  const overlay = h("div", { class: "hud" });
  const root = h("div", { id: "game" }, overlay);
  document.body.append(root);
  document.body.classList.add("in-game");

  const radioHud = createRadioHud(room, radio);
  const crew = h("span", { class: "hud-small" });
  overlay.append(
    h("div", { class: "hud-top-right" },
      h("div", { class: "hud-panel" },
        h("p", { class: "hud-title" }, ROLE_INFO[role].title),
        crew,
        h("button", { class: "link", onclick: () => { room.leave(); } }, "Quitter la partie"),
      ),
    ),
    h("div", { class: "hud-bottom-right" }, radioHud.element),
  );

  const updateCrew = () => {
    const mate = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
    crew.textContent = mate ? `Avec ${mate.name}` : "Ton coéquipier a quitté la partie";
  };
  room.onStateChange(updateCrew);
  updateCrew();

  const stopView = role === "captain"
    ? startCaptainView(room, root, overlay)
    : startKeeperView(room, root, overlay);

  return () => {
    stopView();
    radioHud.dispose();
    room.onStateChange.remove(updateCrew);
    root.remove();
    document.body.classList.remove("in-game");
  };
}
