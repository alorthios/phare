import { MSG, ROLES, ROLE_INFO } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";
import { MicError, Radio } from "../radio/radio.ts";
import { h, showScreen } from "./dom.ts";

/**
 * Salle d'attente : code de la partie, choix des rôles, présence du coéquipier.
 * Quand l'équipage est complet, chacun allume sa radio (ce qui demande l'accès au micro).
 */
export function showLobby(room: NightRoom, onRadioOn: (radio: Radio) => void) {
  let radioError = "";
  let starting = false;

  const turnOnRadio = async () => {
    starting = true;
    radioError = "";
    render();
    try {
      const radio = await Radio.start(room);
      room.onStateChange.remove(render);
      onRadioOn(radio);
    } catch (err) {
      console.error(err);
      radioError = err instanceof MicError ? err.message : "Impossible d'allumer la radio.";
      starting = false;
      render();
    }
  };

  function render() {
    const players = [...room.state.players.entries()];
    const me = room.state.players.get(room.sessionId);
    const mate = players.find(([id]) => id !== room.sessionId)?.[1];
    const crewComplete = Boolean(me?.role && mate?.role);

    const roleCards = ROLES.map((role) => {
      const holder = players.find(([, p]) => p.role === role);
      const mine = holder?.[0] === room.sessionId;
      const takenByMate = holder !== undefined && !mine;
      const info = ROLE_INFO[role];

      return h("button", {
        class: `role-card${mine ? " mine" : ""}`,
        disabled: takenByMate || starting,
        "aria-pressed": mine ? "true" : "false",
        onclick: () => room.send(MSG.chooseRole, mine ? "" : role),
      },
        h("strong", {}, info.title),
        h("span", { class: "role-desc" }, info.description),
        h("span", { class: "role-holder" },
          mine ? "✔ C'est toi" : takenByMate ? `Pris par ${holder[1].name}` : "Libre"),
      );
    });

    let status: string;
    if (!mate) status = "En attente d'un coéquipier…";
    else if (!crewComplete) status = `${mate.name} est connecté ✔ Choisissez vos rôles.`;
    else status = mate.radioReady
      ? `Équipage complet ! ⚓ ${mate.name} a déjà allumé sa radio.`
      : "Équipage complet ! ⚓";

    showScreen(
      h("div", { class: "card" },
        h("p", { class: "code-label" }, "Code de la partie"),
        h("p", { class: "code" }, room.roomId),
        h("p", { class: "hint" }, `Ton coéquipier ouvre ${location.origin} et saisit ce code.`),
        h("div", { class: "roles" }, ...roleCards),
        h("p", { class: "lobby-status" }, status),
        crewComplete && h("button", {
          class: "primary", disabled: starting, onclick: turnOnRadio,
        }, starting ? "Autorise le micro…" : "📻 Allumer la radio"),
        h("p", { class: "error", role: "alert" }, radioError),
        h("button", { class: "link", onclick: () => { room.leave(); } }, "Quitter la partie"),
      ),
    );
  }

  // On redessine l'écran à chaque changement d'état reçu du serveur.
  room.onStateChange(render);
  render();
}
