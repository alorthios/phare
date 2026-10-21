import { Room, type Client, type Delayed } from "@colyseus/core";
import {
  CODE_LENGTH, CODE_LETTERS, MSG, NightState, Player, RADIO,
  clampQuality, cleanName, isRole, type RadioLinkMessage,
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

  /** Minuteur qui coupe une émission trop longue. */
  private transmitTimeout?: Delayed;

  onCreate() {
    // Le code à 4 lettres sert directement d'identifiant de salle.
    this.roomId = generateCode();
    activeCodes.add(this.roomId);
    this.state.floorHolder = "";
    this.state.signalQuality = 1;

    // --- Salle d'attente ---------------------------------------------------

    // Un joueur choisit un rôle, ou l'abandonne en envoyant "".
    this.onMessage(MSG.chooseRole, (client: Client, role: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.radioReady) return;   // radio allumée : rôle verrouillé

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

    // --- Radio -------------------------------------------------------------

    // Le joueur a autorisé son micro : dès que les deux radios sont allumées,
    // on leur demande d'établir la liaison voix (WebRTC).
    this.onMessage(MSG.radioReady, (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.role) return;
      player.radioReady = true;
      this.linkRadiosIfReady();
    });

    // Push-to-Talk : un seul joueur peut avoir la parole à la fois.
    this.onMessage(MSG.pttRequest, (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player?.radioReady) return;

      if (this.state.floorHolder === "") {
        this.grantFloor(client.sessionId);
      } else if (this.state.floorHolder !== client.sessionId) {
        client.send(MSG.pttDenied);   // l'autre parle déjà
      }
    });

    this.onMessage(MSG.pttRelease, (client: Client) => {
      if (this.state.floorHolder === client.sessionId) this.releaseFloor();
    });

    // Signalisation WebRTC : le serveur ne lit pas le contenu, il le transmet à l'autre joueur.
    this.onMessage(MSG.rtc, (client: Client, signal: unknown) => {
      if (typeof signal !== "object" || signal === null) return;
      this.otherClient(client)?.send(MSG.rtc, signal);
    });

    // Curseur de debug (jalon 2) : remplacé par le calcul du faisceau au jalon 5.
    this.onMessage(MSG.debugSignal, (_client: Client, value: unknown) => {
      const quality = clampQuality(value);
      if (quality !== null) this.state.signalQuality = quality;
    });

    console.log(`🌙 Nouvelle nuit : salle ${this.roomId}`);
  }

  onJoin(client: Client, options?: { name?: string }) {
    const player = new Player();
    player.name = cleanName(options?.name);
    player.role = "";
    player.radioReady = false;
    this.state.players.set(client.sessionId, player);
    console.log(`  ⚓ ${player.name} rejoint ${this.roomId}`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.floorHolder === client.sessionId) this.releaseFloor();
    this.state.players.delete(client.sessionId);
    console.log(`  👋 ${player?.name ?? "?"} quitte ${this.roomId}`);
  }

  onDispose() {
    activeCodes.delete(this.roomId);
    console.log(`🌅 Salle ${this.roomId} fermée`);
  }

  // --- Outils ----------------------------------------------------------------

  private otherClient(client: Client): Client | undefined {
    return this.clients.find((c) => c.sessionId !== client.sessionId);
  }

  private linkRadiosIfReady() {
    const ready = this.clients.filter((c) => this.state.players.get(c.sessionId)?.radioReady);
    if (ready.length < 2) return;

    for (const c of ready) {
      const message: RadioLinkMessage = {
        initiator: this.state.players.get(c.sessionId)?.role === "captain",
      };
      c.send(MSG.radioLink, message);
    }
    console.log(`  📻 Radios liées dans ${this.roomId}`);
  }

  private grantFloor(sessionId: string) {
    this.state.floorHolder = sessionId;
    this.transmitTimeout?.clear();
    this.transmitTimeout = this.clock.setTimeout(() => {
      if (this.state.floorHolder === sessionId) this.releaseFloor();
    }, RADIO.maxTransmitMs);
  }

  private releaseFloor() {
    this.state.floorHolder = "";
    this.transmitTimeout?.clear();
    this.transmitTimeout = undefined;
  }
}
