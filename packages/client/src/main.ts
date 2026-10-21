import "./style.css";
import { GAME_TITLE } from "@phare/shared";
import type { NightRoom } from "./net/connection.ts";
import type { Radio } from "./radio/radio.ts";
import { showHome } from "./ui/home.ts";
import { showGameScreen } from "./ui/gameScreen.ts";
import { showLobby } from "./ui/lobby.ts";

document.querySelector("#title")!.textContent = GAME_TITLE;

function goHome(message = "") {
  showHome(onJoined, message);
}

function onJoined(room: NightRoom) {
  let radio: Radio | undefined;
  let cleanupScreen: (() => void) | undefined;

  room.onLeave(() => {
    cleanupScreen?.();
    radio?.dispose();
    goHome("Tu as quitté la partie.");
  });

  showLobby(room, (r) => {
    radio = r;
    cleanupScreen = showGameScreen(room, r);
  });
}

if (location.pathname.startsWith("/debug/levelgen")) {
  // Outil de développement : feuilleter les archipels générés (chargé seulement sur cette page).
  import("./debug/levelgenPage.ts").then((m) => m.showLevelgenPage());
} else {
  goHome();
}

// Petit test : le client arrive-t-il à joindre le serveur ?
const status = document.querySelector<HTMLParagraphElement>("#server-status")!;

async function checkServer() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status.textContent = "Serveur : connecté ✔";
    status.className = "status ok";
  } catch {
    status.textContent = "Serveur : injoignable ✘";
    status.className = "status ko";
  }
}

checkServer();
