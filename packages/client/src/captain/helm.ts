import { MSG, THROTTLE_LEVELS, THROTTLE_STOP, type HelmInput } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";

/**
 * Commandes du Capitaine au clavier.
 * On utilise `event.code` (la position physique de la touche) : la même touche
 * donne ZQSD sur un clavier AZERTY et WASD sur un QWERTY, sans réglage.
 *
 *   Z / ↑ : télégraphe + (accélérer)     Q / ← : barre à gauche (maintenir)
 *   S / ↓ : télégraphe − (ralentir)      D / → : barre à droite (maintenir)
 */
const LEFT = new Set(["KeyA", "ArrowLeft"]);    // KeyA = Q en AZERTY
const RIGHT = new Set(["KeyD", "ArrowRight"]);
const UP = new Set(["KeyW", "ArrowUp"]);        // KeyW = Z en AZERTY
const DOWN = new Set(["KeyS", "ArrowDown"]);

export function bindHelm(room: NightRoom) {
  const held = new Set<string>();
  let throttle = room.state.boat?.throttle ?? THROTTLE_STOP;
  let sent: HelmInput | null = null;

  const send = () => {
    const left = [...held].some((c) => LEFT.has(c));
    const right = [...held].some((c) => RIGHT.has(c));
    const helm: HelmInput = { rudder: (right ? 1 : 0) - (left ? 1 : 0), throttle };
    if (sent && sent.rudder === helm.rudder && sent.throttle === helm.throttle) return;
    sent = helm;
    room.send(MSG.helm, helm);
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.target instanceof HTMLInputElement) return;
    const c = ev.code;
    if (!LEFT.has(c) && !RIGHT.has(c) && !UP.has(c) && !DOWN.has(c)) return;
    ev.preventDefault();
    if (ev.repeat) return;

    if (UP.has(c)) throttle = Math.min(THROTTLE_LEVELS.length - 1, throttle + 1);
    else if (DOWN.has(c)) throttle = Math.max(0, throttle - 1);
    else held.add(c);
    send();
  };

  const onKeyUp = (ev: KeyboardEvent) => {
    if (held.delete(ev.code)) send();
  };

  // Fenêtre quittée : on lâche la barre (sinon elle resterait braquée).
  const onBlur = () => {
    held.clear();
    send();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}
