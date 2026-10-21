import { createPinkNoiseBuffer } from "./noise.ts";

/** Petits bruitages de la radio, synthétisés (aucun fichier son nécessaire). */
export class RadioSfx {
  private readonly noise: AudioBuffer;
  private readonly out: GainNode;

  constructor(private readonly ctx: AudioContext) {
    this.noise = createPinkNoiseBuffer(ctx, 1);
    this.out = new GainNode(ctx, { gain: 0.8 });
    this.out.connect(ctx.destination);
  }

  /** « Clic » quand on appuie sur le bouton d'émission. */
  click() {
    this.tone(1400, 0.015, 0.12, "square");
  }

  /** « Kssh » court : ouverture du canal (le coéquipier commence à parler). */
  squelchOpen() {
    this.burst(0.07, 0.18, 3000);
  }

  /** « Ksssshh » plus long : fin d'émission. */
  squelchClose() {
    this.burst(0.18, 0.22, 2200);
  }

  /** Double bip doux : canal occupé, l'autre parle déjà. */
  busy() {
    this.tone(480, 0.08, 0.06, "square");
    this.tone(480, 0.08, 0.06, "square", 0.14);
  }

  private burst(duration: number, volume: number, frequency: number) {
    const t = this.ctx.currentTime;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.noise });
    const band = new BiquadFilterNode(this.ctx, { type: "bandpass", frequency, Q: 0.6 });
    const env = new GainNode(this.ctx, { gain: volume });
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(band).connect(env).connect(this.out);
    src.start(t, 0, duration);
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const osc = new OscillatorNode(this.ctx, { type, frequency });
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(volume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
}
