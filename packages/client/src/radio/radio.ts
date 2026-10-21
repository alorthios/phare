import { MSG, type RadioLinkMessage, type RtcSignal } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";
import { PeerLink } from "./peerLink.ts";
import { RadioReceiver } from "./receiver.ts";
import { RadioSfx } from "./sfx.ts";

export type LinkStatus = "waiting" | "connecting" | "connected" | "lost";

/** Erreur lisible par un joueur quand le micro n'est pas accessible. */
export class MicError extends Error {}

async function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicError("Micro indisponible : la page doit être ouverte en https://");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === "NotAllowedError") {
      throw new MicError("Micro refusé. Clique sur l'icône 🔒 de la barre d'adresse pour l'autoriser, puis réessaie.");
    }
    if (name === "NotFoundError") throw new MicError("Aucun micro détecté sur ce PC.");
    throw new MicError(`Impossible d'ouvrir le micro (${name}).`);
  }
}

/**
 * La radio d'un joueur : micro, liaison avec le coéquipier, Push-to-Talk, effets.
 *
 * Push-to-Talk semi-duplex :
 *   appui    → demande la parole au serveur (ptt_request)
 *   serveur  → floorHolder = moi → on active la piste micro
 *   relâche  → on coupe la piste tout de suite + ptt_release
 * Le micro n'est donc JAMAIS ouvert sans l'accord du serveur.
 */
export class Radio {
  linkStatus: LinkStatus = "waiting";
  /** Appelé quand quelque chose d'affichable change. */
  onChange?: () => void;

  private link?: PeerLink;
  private pressed = false;
  private prevFloor = "";
  private readonly micTrack: MediaStreamTrack;
  private readonly analyser: AnalyserNode;
  private readonly levelData: Uint8Array<ArrayBuffer>;
  private readonly receiver: RadioReceiver;
  private readonly sfx: RadioSfx;
  private readonly unbinds: Array<() => void> = [];
  private readonly sync = () => this.syncWithState();

  /** À appeler depuis un clic (le navigateur exige un geste pour démarrer l'audio). */
  static async start(room: NightRoom): Promise<Radio> {
    const ctx = new AudioContext();
    try {
      const mic = await openMicrophone();
      await ctx.resume();
      return new Radio(room, mic, ctx);
    } catch (err) {
      await ctx.close();
      throw err;
    }
  }

  private constructor(
    private readonly room: NightRoom,
    private readonly mic: MediaStream,
    private readonly ctx: AudioContext,
  ) {
    this.micTrack = mic.getAudioTracks()[0];
    this.micTrack.enabled = false;   // muet tant que le serveur n'a pas donné la parole

    // Vumètre local : permet de vérifier que le micro capte, même sans émettre.
    this.analyser = new AnalyserNode(ctx, { fftSize: 512 });
    ctx.createMediaStreamSource(new MediaStream([this.micTrack.clone()])).connect(this.analyser);
    this.levelData = new Uint8Array(this.analyser.fftSize);

    this.receiver = new RadioReceiver(ctx);
    this.sfx = new RadioSfx(ctx);

    this.unbinds.push(
      room.onMessage(MSG.radioLink, (msg: RadioLinkMessage) => this.openLink(msg.initiator)),
      room.onMessage(MSG.rtc, (signal: RtcSignal) => this.link?.handleSignal(signal)),
      room.onMessage(MSG.pttDenied, () => this.sfx.busy()),
    );
    room.onStateChange(this.sync);
    this.syncWithState();

    room.send(MSG.radioReady);
  }

  get transmitting(): boolean {
    return this.room.state.floorHolder === this.room.sessionId;
  }

  /** sessionId du coéquipier qui parle, ou "" si personne. */
  get incomingFrom(): string {
    const holder = this.room.state.floorHolder;
    return holder !== "" && holder !== this.room.sessionId ? holder : "";
  }

  get isPressed(): boolean {
    return this.pressed;
  }

  /** Niveau du micro entre 0 et 1. */
  micLevel(): number {
    this.analyser.getByteTimeDomainData(this.levelData);
    let sum = 0;
    for (const v of this.levelData) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / this.levelData.length) * 4);
  }

  press() {
    if (this.pressed) return;
    this.pressed = true;
    this.room.send(MSG.pttRequest);
    this.onChange?.();
  }

  release() {
    if (!this.pressed) return;
    this.pressed = false;
    this.micTrack.enabled = false;   // coupé immédiatement, sans attendre le serveur
    this.room.send(MSG.pttRelease);
    this.onChange?.();
  }

  setDebugQuality(q: number) {
    this.room.send(MSG.debugSignal, q);
  }

  dispose() {
    this.unbinds.forEach((unbind) => unbind());
    this.room.onStateChange.remove(this.sync);
    this.link?.close();
    this.mic.getTracks().forEach((t) => t.stop());
    this.receiver.dispose();
    this.ctx.close();
  }

  private openLink(initiator: boolean) {
    this.link?.close();
    this.setLinkStatus("connecting");
    this.link = new PeerLink(
      this.room, this.micTrack, initiator,
      (stream) => this.receiver.setStream(stream),
      (state) => {
        if (state === "connected") this.setLinkStatus("connected");
        else if (state === "failed" || state === "disconnected") this.setLinkStatus("lost");
      },
    );
  }

  private setLinkStatus(status: LinkStatus) {
    this.linkStatus = status;
    this.onChange?.();
  }

  private syncWithState() {
    const state = this.room.state;
    const me = this.room.sessionId;
    const floor = state.floorHolder ?? "";

    this.receiver.setQuality(state.signalQuality ?? 1);

    // Sons de début/fin d'émission
    const prev = this.prevFloor;
    if (floor !== prev) {
      if (floor === me) this.sfx.click();
      else if (prev === me) this.sfx.click();
      if (floor !== "" && floor !== me) this.sfx.squelchOpen();
      else if (prev !== "" && prev !== me) this.sfx.squelchClose();
      this.prevFloor = floor;
    }

    this.receiver.setReceiving(this.incomingFrom !== "");
    this.micTrack.enabled = this.transmitting && this.pressed;

    // Le coéquipier est parti ou a éteint sa radio : on ferme la liaison.
    const mate = [...state.players.entries()].find(([id]) => id !== me)?.[1];
    if (!mate?.radioReady && this.link) {
      this.link.close();
      this.link = undefined;
      this.linkStatus = "waiting";
    }

    this.onChange?.();
  }
}
