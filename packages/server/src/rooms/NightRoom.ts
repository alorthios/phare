import { Room, type Client } from "@colyseus/core";
import {
  CODE_LENGTH, CODE_LETTERS, MSG, NightState, Player, cleanName, isRole,
} from "@phare/shared";

/** Codes des salles ouvertes, pour ne jamais donner deux fois le même. */
const activeCodes = new Set<string>();

function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)],
    ).join("");
  } while (activeCodes.has(code));
  return code;
}

/** Une salle = une nuit, jouée par un Capitaine et un Gardien. */
export class NightRoom extends Room<{ state: NightState }> {
  maxClients = 2;
  state = new NightState();

  onCreate() {
    // Le code à 4 lettres sert directement d'identifiant de salle.
    this.roomId = generateCode();
    activeCodes.add(this.roomId);

    // Un joueur choisit un rôle, ou l'abandonne en envoyant "".
    this.onMessage(MSG.chooseRole, (client: Client, role: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (role === "") {
        player.role = "";
        return;
      }
      if (!isRole(role)) return;

      const takenByOther = [...this.state.players.entries()].some(
        ([id, p]) => id !== client.sessionId && p.role === role,
      );
      if (takenByOther) return;   // rôle déjà pris : on ignore la demande

      player.role = role;
    });

    console.log(`🌙 Nouvelle nuit : salle ${this.roomId}`);
  }

  onJoin(client: Client, options?: { name?: string }) {
    const player = new Player();
    player.name = cleanName(options?.name);
    player.role = "";
    this.state.players.set(client.sessionId, player);
    console.log(`  ⚓ ${player.name} rejoint ${this.roomId}`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`  👋 ${player?.name ?? "?"} quitte ${this.roomId}`);
  }

  onDispose() {
    activeCodes.delete(this.roomId);
    console.log(`🌅 Salle ${this.roomId} fermée`);
  }
}
