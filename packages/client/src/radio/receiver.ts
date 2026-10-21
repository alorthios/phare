import { createPinkNoiseBuffer, softClipCurve } from "./noise.ts";

/**
 * Chaîne d'effets appliquée à la voix REÇUE (le micro part propre, c'est le haut-parleur qui grésille).
 *
 *  voix → [passe-haut 300 Hz] → [passe-bas f(q)] ─┬─ [sec] ──────────────┬→ [voix] ─┐
 *                                                 └─ [saturation] [mouillé]┘          ├→ [master] → 🔊
 *  bruit rose (boucle) → [passe-bande 2 kHz] → [volume du bruit] ────────────────────┤
 *  crépitements (courtes rafales aléatoires) ─────────────────────────────────────────┘
 *
 * q = qualité du signal : 1 = clair, RADIO.minQuality = très brouillé.
 */
export class RadioReceiver {
  private readonly highpass: BiquadFilterNode;
  private readonly lowpass: BiquadFilterNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly voice: GainNode;
  private readonly noiseGain: GainNode;
  private readonly crackleBus: GainNode;
  private readonly noiseBuffer: AudioBuffer;
  private source?: MediaStreamAudioSourceNode;
  /** Élément <audio> muet : contourne un bug de Chrome (sinon le flux WebRTC reste silencieux). */
  private keepAlive?: HTMLAudioElement;
  private crackleTimer: number;

  private quality = 1;
  private receiving = false;

  constructor(private readonly ctx: AudioContext) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    this.highpass = new BiquadFilterNode(ctx, { type: "highpass", frequency: 300 });
    this.lowpass = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 8000, Q: 0.8 });
    this.dry = new GainNode(ctx, { gain: 1 });
    this.wet = new GainNode(ctx, { gain: 0 });
    const shaper = new WaveShaperNode(ctx, { curve: softClipCurve(6), oversample: "2x" });
    this.voice = new GainNode(ctx, { gain: 1 });

    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.dry).connect(this.voice);
    this.lowpass.connect(shaper).connect(this.wet).connect(this.voice);
    this.voice.connect(master);

    // Souffle permanent (très faible au repos, plus fort pendant une réception brouillée).
    this.noiseBuffer = createPinkNoiseBuffer(ctx);
    const noise = new AudioBufferSourceNode(ctx, { buffer: this.noiseBuffer, loop: true });
    const band = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 2000, Q: 0.7 });
    this.noiseGain = new GainNode(ctx, { gain: 0 });
    noise.connect(band).connect(this.noiseGain).connect(master);
    noise.start();

    this.crackleBus = new GainNode(ctx, { gain: 1 });
    this.crackleBus.connect(master);
    this.crackleTimer = window.setInterval(() => this.maybeCrackle(), 100);

    this.apply();
  }

  /** Branche le flux audio reçu par WebRTC. */
  setStream(stream: MediaStream) {
    this.source?.disconnect();
    this.keepAlive?.remove();

    this.keepAlive = new Audio();
    this.keepAlive.muted = true;
    this.keepAlive.srcObject = stream;
    this.keepAlive.play().catch(() => { /* muet : sans importance */ });

    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.highpass);
  }

  setQuality(q: number) {
    if (q === this.quality) return;
    this.quality = q;
    this.apply();
  }

  /** true pendant que le coéquipier émet. */
  setReceiving(on: boolean) {
    if (on === this.receiving) return;
    this.receiving = on;
    this.apply();
  }

  dispose() {
    clearInterval(this.crackleTimer);
    this.source?.disconnect();
    this.keepAlive?.remove();
  }

  private apply() {
    const q = this.quality;
    const t = this.ctx.currentTime;
    const smooth = 0.15;   // transitions douces, sans « clic »

    // Passe-bas : 900 Hz (étouffé) → 8 kHz (clair), sur une échelle logarithmique.
    this.lowpass.frequency.setTargetAtTime(900 * Math.pow(8000 / 900, q), t, smooth);
    this.dry.gain.setTargetAtTime(q, t, smooth);
    this.wet.gain.setTargetAtTime((1 - q) * 0.7, t, smooth);
    this.voice.gain.setTargetAtTime(0.8 + 0.2 * q, t, smooth);

    const noise = this.receiving ? 0.02 + (1 - q) * 0.33 : 0.006;
    this.noiseGain.gain.setTargetAtTime(noise, t, smooth);
  }

  /** Crépitements : jusqu'à ~4 par seconde quand le signal est mauvais. */
  private maybeCrackle() {
    if (!this.receiving || this.quality > 0.9) return;
    const perSecond = (1 - this.quality) * 4.5;
    if (Math.random() > perSecond / 10) return;

    const t = this.ctx.currentTime;
    const duration = 0.01 + Math.random() * 0.03;
    const burst = new AudioBufferSourceNode(this.ctx, { buffer: this.noiseBuffer });
    const hp = new BiquadFilterNode(this.ctx, { type: "highpass", frequency: 1200 });
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(0.25 + Math.random() * 0.3, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    burst.connect(hp).connect(env).connect(this.crackleBus);
    burst.start(t, Math.random() * 2, duration);
  }
}
