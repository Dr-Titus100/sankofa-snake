// Short sounds and phone vibration for the game's events. The sounds are made in the browser with
// the Web Audio API, so the game loads no sound files. Each note is a wooden, xylophone-like tone,
// after the gyil, a xylophone from the Upper West of Ghana. The notes come from a five-note scale.
import type { GameEvent } from "../../../packages/core/src";

/** A pentatonic scale in hertz, from G4 up two octaves. */
const SCALE = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];

interface Note {
  /** Index into SCALE, or a frequency in hertz when above 50. */
  pitch: number;
  /** Start time in seconds after the cue begins. */
  at: number;
  length?: number;
  volume?: number;
}

const freq = (pitch: number) => (pitch > 50 ? pitch : SCALE[Math.max(0, Math.min(SCALE.length - 1, pitch))]);

/** Vibration patterns in milliseconds, kept short so they don't get tiring. */
const BUZZ: Partial<Record<GameEvent["type"], number | number[]>> = {
  ate: 12,
  power: [20, 40, 20],
  bump: 40,
  crash: [90, 50, 160],
  cleared: [40, 40, 40, 40, 140],
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(
    public soundOn: boolean,
    public vibrationOn: boolean,
  ) {}

  /** Whether this device can vibrate. Most phones can, but iPhones can't from a web page. */
  static get canVibrate() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  /**
   * Browsers start sound only after the player presses something, so the game calls this on
   * each key press and tap. It creates the audio on the first one and wakes it if it was asleep.
   */
  unlock() {
    if (!this.soundOn) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      // No sound on this device. The game plays on without it.
      this.ctx = null;
    }
  }

  /** Plays the sound and the vibration for one game event. `eaten` sets the pitch of the cowrie note. */
  play(e: GameEvent, eaten = 0) {
    if (this.vibrationOn && Sound.canVibrate) {
      const buzz = BUZZ[e.type];
      if (buzz !== undefined) {
        try {
          navigator.vibrate(buzz);
        } catch {
          // Some browsers refuse vibration before the player has pressed anything.
        }
      }
    }
    if (!this.soundOn) return;
    const notes = cue(e, eaten);
    if (notes.length) this.notes(notes);
    if (e.type === "current") this.swish();
    if (e.type === "crash") this.thud(0.22);
    if (e.type === "bump") this.thud(0.12);
  }

  private notes(list: Note[]) {
    this.unlock();
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const now = ctx.currentTime + 0.01;
    for (const n of list) {
      const start = now + n.at;
      const length = n.length ?? 0.35;
      const volume = n.volume ?? 1;
      // A wooden bar rings with a strong first note and a quieter, quickly fading overtone.
      for (const [ratio, level, decay] of [
        [1, 0.9, length],
        [3.9, 0.25, length * 0.3],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq(n.pitch) * ratio;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level * volume, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        osc.connect(gain).connect(out);
        osc.start(start);
        osc.stop(start + decay + 0.05);
      }
    }
  }

  /** A short burst of filtered noise, like water rushing past. */
  private swish() {
    this.unlock();
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const length = 0.25;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    const start = ctx.currentTime + 0.01;
    filter.frequency.setValueAtTime(500, start);
    filter.frequency.exponentialRampToValueAtTime(1800, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter).connect(gain).connect(out);
    src.start(start);
  }

  /** A low drum hit for a crash or a bump. */
  private thud(volume: number) {
    this.unlock();
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const start = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(55, start + 0.25);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * 4, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.35);
  }
}

/** The notes for a game event. Events with no notes, such as a speed-up, return an empty list. */
export function cue(e: GameEvent, eaten: number): Note[] {
  switch (e.type) {
    case "ate":
      // Each cowrie in a run plays the next note up the scale, starting again every five.
      return [{ pitch: 2 + ((eaten - 1) % 5), at: 0, length: 0.3 }];
    case "speedup":
      return [
        { pitch: 5, at: 0.12, length: 0.15, volume: 0.6 },
        { pitch: 7, at: 0.2, length: 0.2, volume: 0.6 },
      ];
    case "powerAppeared":
      return [{ pitch: 9, at: 0, length: 0.25, volume: 0.4 }];
    case "power":
      return [
        { pitch: 4, at: 0, length: 0.15 },
        { pitch: 6, at: 0.07, length: 0.15 },
        { pitch: 8, at: 0.14, length: 0.3 },
      ];
    case "passed":
      return [
        { pitch: 7, at: 0, length: 0.15, volume: 0.7 },
        { pitch: 5, at: 0.08, length: 0.2, volume: 0.7 },
      ];
    case "crash":
      return [
        { pitch: 3, at: 0.05, length: 0.25, volume: 0.7 },
        { pitch: 1, at: 0.17, length: 0.25, volume: 0.7 },
        { pitch: 0, at: 0.29, length: 0.5, volume: 0.7 },
      ];
    case "cleared":
      return [
        { pitch: 0, at: 0, length: 0.2 },
        { pitch: 2, at: 0.12, length: 0.2 },
        { pitch: 4, at: 0.24, length: 0.2 },
        { pitch: 5, at: 0.36, length: 0.2 },
        { pitch: 7, at: 0.48, length: 0.6 },
      ];
    default:
      return [];
  }
}
