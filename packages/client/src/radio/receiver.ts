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
  /** Baisse brièvement la voix pendant un « krrrkrrkrrr » (le signal décroche). */
  private readonly dropout: GainNode;
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
    this.dropout = new GainNode(ctx, { gain: 1 });

    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.dry).connect(this.voice);
    this.lowpass.connect(shaper).connect(this.wet).connect(this.voice);
    this.voice.connect(this.dropout).connect(master);

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

  /**
   * Appelé toutes les 100 ms. Deux sortes de parasites :
   *  - des crépitements isolés (« tic ») : jusqu'à ~4 par seconde quand le signal est mauvais ;
   *  - des rafales « krrrkrrkrrr » : rares quand le signal est correct, fréquentes quand il est brouillé,
   *    et très rarement au repos (le poste grésille un peu même quand personne ne parle).
   */
  private maybeCrackle() {
    const bad = 1 - this.quality;   // 0 = signal parfait, 0.85 = très brouillé

    if (this.receiving && this.quality < 0.9) {
      const clicksPerSecond = bad * 4.5;
      if (Math.random() < clicksPerSecond / 10) {
        this.click(this.ctx.currentTime, 0.01 + Math.random() * 0.03, 0.25 + Math.random() * 0.3, 1200);
      }
    }

    const trainsPerSecond = this.receiving ? Math.pow(bad, 1.5) * 1.3 : 0.03;
    if (Math.random() < trainsPerSecond / 10) this.crackleTrain(this.receiving ? 1 : 0.35);
  }

  /** « krrrkrrkrrr » : 2 ou 3 salves de micro-clics très rapprochés, au volume irrégulier. */
  private crackleTrain(volume: number) {
    let t = this.ctx.currentTime + 0.01;
    const start = t;
    const salvos = 1 + Math.floor(Math.random() * 3);

    for (let s = 0; s < salvos; s++) {
      const clicks = 4 + Math.floor(Math.random() * 9);
      const pitch = 1500 + Math.random() * 2000;   // chaque « krr » a sa propre couleur
      for (let i = 0; i < clicks; i++) {
        t += 0.015 + Math.random() * 0.025;        // 15 à 40 ms entre deux clics
        this.click(t, 0.006 + Math.random() * 0.006, volume * (0.08 + Math.random() * 0.3), pitch);
      }
      t += 0.05 + Math.random() * 0.08;            // petit silence entre deux « krr »
    }

    // Pendant la rafale, la voix décroche un peu, puis revient.
    if (this.receiving) {
      const g = this.dropout.gain;
      g.cancelScheduledValues(start);
      g.setTargetAtTime(0.35 + this.quality * 0.4, start, 0.02);
      g.setTargetAtTime(1, t, 0.06);
    }
  }

  /** Un clic bref : une miette de bruit filtrée, qui s'éteint très vite. */
  private click(t: number, duration: number, gain: number, frequency: number) {
    const burst = new AudioBufferSourceNode(this.ctx, { buffer: this.noiseBuffer });
    const hp = new BiquadFilterNode(this.ctx, { type: "highpass", frequency });
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    burst.connect(hp).connect(env).connect(this.crackleBus);
    burst.start(t, Math.random() * 2, duration);
  }
}
