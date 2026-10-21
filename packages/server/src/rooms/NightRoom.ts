import { Room, type Client, type Delayed } from "@colyseus/core";
import {
  Boat, CODE_LENGTH, CODE_LETTERS, MSG, NightState, Player, RADIO, THROTTLE_STOP,
  clampQuality, cleanName, generateLevel, isNavigable, isRole, isValidHelm, stepBoat,
  type HelmInput, type Level, type RadioLinkMessage,
} from "@phare/shared";

/** Fréquence de la simulation : 20 pas par seconde. */
const TICK_MS = 50;

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

  /** Dernier ordre reçu du Capitaine. */
  private helm: HelmInput = { rudder: 0, throttle: THROTTLE_STOP };

  /** L'archipel de la nuit (non synchronisé : chaque client le régénère à partir du seed). */
  private level!: Level;

  onCreate() {
    // Le code à 4 lettres sert directement d'identifiant de salle.
    this.roomId = generateCode();
    activeCodes.add(this.roomId);
    this.state.floorHolder = "";
    this.state.signalQuality = 1;
    this.state.seed = Math.floor(Math.random() * 2 ** 31);

    // L'archipel de la nuit : le serveur et les deux clients le génèrent à partir du même seed.
    const started = performance.now();
    this.level = generateLevel(this.state.seed);
    const level = this.level;
    console.log(`  🗺️  Archipel généré en ${Math.round(performance.now() - started)} ms (seed ${level.seed}, ${level.attempts} essai(s))`);

    // Le bateau part de l'entrée de la baie, cap au nord, machine stoppée.
    const boat = (this.state.boat = new Boat());
    Object.assign(boat, {
      x: level.spawn.x, z: level.spawn.z, heading: level.spawn.heading,
      speed: 0, rudder: 0, throttle: THROTTLE_STOP,
    });

    // Boucle de simulation : le serveur fait autorité sur la position du bateau.
    const navigable = (x: number, z: number) => isNavigable(level, x, z);
    this.setSimulationInterval((deltaMs) => {
      stepBoat(boat, this.helm, Math.min(deltaMs, 200) / 1000, navigable);
    }, TICK_MS);

    // --- Navigation ----------------------------------------------------------

    // Seul le Capitaine tient la barre.
    this.onMessage(MSG.helm, (client: Client, input: unknown) => {
      if (this.state.players.get(client.sessionId)?.role !== "captain") return;
      if (!isValidHelm(input)) return;
      this.helm = { rudder: input.rudder, throttle: input.throttle };
      boat.throttle = input.throttle;
    });

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
    if (player?.role === "captain") {
      // Plus personne à la barre : on stoppe la machine et on remet la barre au centre.
      this.helm = { rudder: 0, throttle: THROTTLE_STOP };
      this.state.boat.throttle = THROTTLE_STOP;
    }
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
