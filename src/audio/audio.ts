const STORAGE_KEY = "swarm-survivors-volume";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private lastPlayed = new Map<string, number>();
  volume: number;

  constructor() {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    this.volume = Number.isFinite(saved) && saved > 0 ? saved : 0.7;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.4;
    this.musicGain.connect(this.master);
  }

  setVolume(v: number) {
    this.volume = v;
    localStorage.setItem(STORAGE_KEY, String(v));
    if (this.master && this.ctx)
      this.master.gain.setValueAtTime(v, this.ctx.currentTime);
  }

  private throttle(name: string, minMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < minMs) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    duration: number,
    gain: number,
    when = 0
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, gain: number, lowpass = 2000) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  shoot() {
    if (!this.throttle("shoot", 50)) return;
    this.tone("square", 880, 440, 0.06, 0.05);
  }

  hit() {
    if (!this.throttle("hit", 70)) return;
    this.noise(0.05, 0.08, 3000);
  }

  kill() {
    if (!this.throttle("kill", 60)) return;
    this.noise(0.12, 0.12, 1200);
    this.tone("triangle", 220, 60, 0.12, 0.1);
  }

  hurt() {
    if (!this.throttle("hurt", 200)) return;
    this.tone("sawtooth", 200, 70, 0.25, 0.18);
  }

  gem() {
    if (!this.throttle("gem", 60)) return;
    this.tone("sine", 1200, 1800, 0.07, 0.06);
  }

  levelup() {
    this.tone("sine", 523, 523, 0.12, 0.12);
    this.tone("sine", 659, 659, 0.12, 0.12, 0.09);
    this.tone("sine", 784, 784, 0.2, 0.12, 0.18);
  }

  pick() {
    this.tone("triangle", 600, 900, 0.08, 0.12);
  }

  gameover() {
    this.tone("sawtooth", 300, 60, 0.8, 0.2);
    this.tone("sawtooth", 150, 40, 1.0, 0.15, 0.15);
  }

  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone("triangle", f, f, 0.25, 0.15, i * 0.12));
  }

  bossSpawn() {
    this.tone("sawtooth", 80, 40, 1.2, 0.25);
  }

  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicTimer) return;
    const bassLine = [55, 55, 65.4, 49];
    const arp = [220, 261.6, 329.6, 392, 523.3];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const step = this.beat % 16;

      if (step % 4 === 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.2);
      }

      if (step % 8 === 4) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.value =
          bassLine[Math.floor(this.beat / 8) % bassLine.length];
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.45);
      }

      if (step % 2 === 1 && Math.random() < 0.3) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = arp[Math.floor(Math.random() * arp.length)];
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 0.35);
      }

      this.beat++;
    }, 234);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.beat = 0;
  }
}
