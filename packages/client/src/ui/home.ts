import { CODE_LENGTH, MAX_NAME_LENGTH, normalizeCode } from "@phare/shared";
import { createNight, joinNight, type NightRoom } from "../net/connection.ts";
import { h, showScreen } from "./dom.ts";

const NAME_KEY = "phare.name";

function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}
function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* navigation privée : tant pis */ }
}

/** Écran d'accueil : pseudo, créer une partie, ou rejoindre avec un code. */
export function showHome(onJoined: (room: NightRoom) => void, message = "") {
  const nameInput = h("input", {
    id: "name", type: "text", maxlength: String(MAX_NAME_LENGTH),
    placeholder: "Ton nom de marin", autocomplete: "off",
  });
  nameInput.value = loadName();

  const codeInput = h("input", {
    id: "code", type: "text", maxlength: String(CODE_LENGTH),
    placeholder: "CODE", autocomplete: "off", class: "code-input",
    "aria-label": "Code de la partie",
  });
  codeInput.addEventListener("input", () => {
    codeInput.value = normalizeCode(codeInput.value);
  });

  const error = h("p", { class: "error", role: "alert" }, message);
  const buttons: HTMLButtonElement[] = [];

  async function attempt(action: () => Promise<NightRoom>, failMessage: string) {
    saveName(nameInput.value.trim());
    error.textContent = "";
    buttons.forEach((b) => (b.disabled = true));
    try {
      onJoined(await action());
    } catch (err) {
      console.error(err);
      error.textContent = failMessage;
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  const createBtn = h("button", {
    class: "primary",
    onclick: () => attempt(
      () => createNight(nameInput.value),
      "Impossible de créer la partie. Le serveur tourne-t-il ?",
    ),
  }, "Créer une partie");

  const joinBtn = h("button", {
    onclick: () => {
      const code = normalizeCode(codeInput.value);
      if (code.length !== CODE_LENGTH) {
        error.textContent = `Le code fait ${CODE_LENGTH} lettres.`;
        return;
      }
      attempt(() => joinNight(code, nameInput.value), `Partie ${code} introuvable ou déjà complète.`);
    },
  }, "Rejoindre");

  codeInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") joinBtn.click();
  });
  buttons.push(createBtn, joinBtn);

  showScreen(
    h("div", { class: "card" },
      h("label", { for: "name" }, "Nom"),
      nameInput,
      h("div", { class: "choices" },
        h("div", { class: "choice" },
          h("p", {}, "Lancer une nouvelle nuit"),
          createBtn,
        ),
        h("div", { class: "choice" },
          h("p", {}, "Rejoindre un coéquipier"),
          h("div", { class: "row" }, codeInput, joinBtn),
        ),
      ),
      error,
    ),
  );
}
