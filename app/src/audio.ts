// All sound is synthesised with Web Audio; nothing is loaded. The context starts on the first input,
// as browsers require.

import type { Event } from "@ebbline/engine";
import type { Settings } from "./storage.ts";

type Wave = OscillatorType;

export class Sound {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private pad: GainNode | undefined;
  private settings: Settings;
  private readonly last = new Map<string, number>();

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Call from a user gesture. */
  unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    try {
      this.context = new AudioContext();
    } catch {
      return;
    }
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.startPad();
    this.apply(this.settings);
  }

  apply(settings: Settings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.pad) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.volume, now, 0.05);
    this.pad.gain.setTargetAtTime(settings.music ? 0.05 : 0, now, 0.5);
  }

  /** A quiet two-voice drone with a slow filter sweep. */
  private startPad(): void {
    const context = this.context;
    if (!context || !this.master) return;
    this.pad = context.createGain();
    this.pad.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    const sweep = context.createOscillator();
    sweep.frequency.value = 0.05;
    const depth = context.createGain();
    depth.gain.value = 250;
    sweep.connect(depth).connect(filter.frequency);
    sweep.start();
    for (const frequency of [55, 82.6, 110.4]) {
      const voice = context.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.value = frequency;
      voice.connect(filter);
      voice.start();
    }
    filter.connect(this.pad).connect(this.master);
  }

  private tone(frequency: number, seconds: number, wave: Wave, gain: number, slideTo?: number, delay = 0): void {
    const context = this.context;
    if (!context || !this.master) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  private noise(seconds: number, gain: number, cutoff: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, context.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);
    source.connect(filter).connect(amp).connect(this.master);
    source.start();
  }

  /** Lets a sound through at most once per interval. */
  private due(key: string, seconds: number): boolean {
    const now = this.context?.currentTime ?? 0;
    if (now - (this.last.get(key) ?? -1) < seconds) return false;
    this.last.set(key, now);
    return true;
  }

  click(): void {
    this.tone(660, 0.05, "square", 0.05);
  }

  deny(): void {
    if (this.due("deny", 0.15)) this.tone(140, 0.12, "square", 0.07);
  }

  play(event: Event): void {
    if (!this.context) return;
    switch (event.kind) {
      case "placed":
        if (this.due("placed", 0.05)) this.tone(520, 0.06, "triangle", 0.09);
        break;
      case "built":
        if (this.due("built", 0.1)) {
          this.tone(660, 0.1, "triangle", 0.08);
          this.tone(990, 0.14, "triangle", 0.06, undefined, 0.07);
        }
        break;
      case "lance":
        if (this.due("lance", 0.09)) this.tone(1400, 0.07, "sawtooth", 0.025, 500);
        break;
      case "lob":
        if (this.due("lob", 0.1)) this.tone(160, 0.2, "sine", 0.12, 60);
        break;
      case "impact":
        if (this.due("impact", 0.1)) this.noise(0.35, 0.16, 900);
        break;
      case "destroyed":
        if (this.due("destroyed", 0.1)) {
          this.noise(0.5, 0.2, 500);
          this.tone(110, 0.4, "sawtooth", 0.08, 40);
        }
        break;
      case "dismantled":
        this.tone(330, 0.1, "triangle", 0.07, 160);
        break;
      case "spit":
        this.tone(880, 0.12, "square", 0.05);
        this.tone(880, 0.12, "square", 0.05, undefined, 0.2);
        break;
      case "splash":
      case "burst":
        this.noise(0.5, 0.18, 400);
        break;
      case "intercept":
        if (event.kill) this.tone(1200, 0.18, "triangle", 0.1, 300);
        else if (this.due("intercept", 0.1)) this.tone(1800, 0.04, "square", 0.04);
        break;
      case "capped":
        [392, 523, 659, 784].forEach((f, n) => {
          this.tone(f, 0.3, "triangle", 0.1, undefined, n * 0.09);
        });
        break;
      case "won":
        [523, 659, 784, 1047].forEach((f, n) => {
          this.tone(f, 0.5, "triangle", 0.12, undefined, 0.4 + n * 0.14);
        });
        break;
      case "lost":
        [330, 262, 196, 131].forEach((f, n) => {
          this.tone(f, 0.6, "sawtooth", 0.08, undefined, n * 0.2);
        });
        break;
      default:
        break;
    }
  }
}
