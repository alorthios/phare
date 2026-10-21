/** Réglages de la radio, partagés par le client et le serveur. */
export const RADIO = {
  /** Durée maximale d'une émission : au-delà, le serveur coupe (micro bloqué, touche coincée…). */
  maxTransmitMs: 30_000,
  /** La qualité ne descend jamais à 0 : on peut toujours se comprendre (jeu cozy). */
  minQuality: 0.15,
} as const;

/** Message de signalisation WebRTC relayé tel quel par le serveur. */
export interface RtcSignal {
  description?: { type: "offer" | "answer"; sdp?: string };
  candidate?: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}

/** Envoyé par le serveur aux deux joueurs quand leurs radios sont allumées. */
export interface RadioLinkMessage {
  /** true = c'est ce joueur qui lance la connexion WebRTC (le Capitaine). */
  initiator: boolean;
}

export function clampQuality(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(RADIO.minQuality, value));
}
