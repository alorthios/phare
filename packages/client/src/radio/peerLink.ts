import { MSG, type RtcSignal } from "@phare/shared";
import type { NightRoom } from "../net/connection.ts";

/**
 * Serveurs STUN : aident deux navigateurs à se trouver quand la découverte directe
 * sur le réseau local échoue. En réseau local, la connexion reste directe entre les deux PC.
 */
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Liaison voix WebRTC entre les deux joueurs.
 * Le serveur Colyseus sert seulement d'entremetteur (« signaling ») : il relaie
 * l'offre, la réponse et les candidats réseau. La voix, elle, va directement d'un PC à l'autre.
 */
export class PeerLink {
  private readonly pc: RTCPeerConnection;
  /** File d'attente : les messages de signalisation sont traités un par un, dans l'ordre. */
  private queue: Promise<void> = Promise.resolve();
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private readonly room: NightRoom,
    micTrack: MediaStreamTrack,
    initiator: boolean,
    onRemoteStream: (stream: MediaStream) => void,
    onStateChange: (state: RTCPeerConnectionState) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.addTrack(micTrack, new MediaStream([micTrack]));

    this.pc.ontrack = (ev) => onRemoteStream(ev.streams[0] ?? new MediaStream([ev.track]));
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.send({ candidate: ev.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => onStateChange(this.pc.connectionState);

    if (initiator) this.enqueue(() => this.sendOffer());
  }

  /** Message reçu de l'autre joueur (via le serveur). */
  handleSignal(signal: RtcSignal) {
    this.enqueue(async () => {
      if (signal.description) {
        await this.pc.setRemoteDescription(signal.description);
        if (signal.description.type === "offer") {
          await this.pc.setLocalDescription();   // crée la réponse
          this.send({ description: this.localDescription() });
        }
        for (const c of this.pendingCandidates) await this.pc.addIceCandidate(c);
        this.pendingCandidates = [];
      } else if (signal.candidate) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(signal.candidate);
        else this.pendingCandidates.push(signal.candidate);
      }
    });
  }

  close() {
    this.pc.close();
  }

  private async sendOffer() {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    this.send({ description: this.localDescription() });
  }

  private localDescription(): RtcSignal["description"] {
    const d = this.pc.localDescription!;
    return { type: d.type as "offer" | "answer", sdp: d.sdp };
  }

  private send(signal: RtcSignal) {
    this.room.send(MSG.rtc, signal);
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((err) => console.error("[radio] WebRTC :", err));
  }
}
