import { MSG, ROLES, ROLE_INFO } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";
import { h, showScreen } from "./dom.ts";

/** Salle d'attente : code de la partie, choix des rôles, présence du coéquipier. */
export function showLobby(room: NightRoom, onLeave: () => void) {
  const render = () => {
    const players = [...room.state.players.entries()];
    const me = room.state.players.get(room.sessionId);
    const mate = players.find(([id]) => id !== room.sessionId)?.[1];

    const roleCards = ROLES.map((role) => {
      const holder = players.find(([, p]) => p.role === role);
      const mine = holder?.[0] === room.sessionId;
      const takenByMate = holder !== undefined && !mine;
      const info = ROLE_INFO[role];

      return h("button", {
        class: `role-card${mine ? " mine" : ""}`,
        disabled: takenByMate,
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
    else if (!me?.role || !mate.role) status = `${mate.name} est connecté ✔ Choisissez vos rôles.`;
    else status = "Équipage complet ! ⚓ (la radio arrive au jalon 2)";

    showScreen(
      h("div", { class: "card" },
        h("p", { class: "code-label" }, "Code de la partie"),
        h("p", { class: "code" }, room.roomId),
        h("p", { class: "hint" }, `Ton coéquipier ouvre ${location.origin} et saisit ce code.`),
        h("div", { class: "roles" }, ...roleCards),
        h("p", { class: "lobby-status" }, status),
        h("button", { class: "link", onclick: () => { room.leave(); } }, "Quitter la partie"),
      ),
    );
  };

  // On redessine l'écran à chaque changement d'état reçu du serveur.
  room.onStateChange(render);
  room.onLeave(() => onLeave());
  render();
}
