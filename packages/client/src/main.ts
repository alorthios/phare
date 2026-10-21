import "./style.css";
import { GAME_TITLE } from "@phare/shared";

document.querySelector("#title")!.textContent = GAME_TITLE;

// Petit test : le client arrive-t-il à joindre le serveur ?
const status = document.querySelector<HTMLParagraphElement>("#server-status")!;

async function checkServer() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status.textContent = "Serveur : connecté ✔";
    status.className = "status ok";
  } catch {
    status.textContent = "Serveur : injoignable ✘ (as-tu lancé npm run dev ?)";
    status.className = "status ko";
  }
}

checkServer();
