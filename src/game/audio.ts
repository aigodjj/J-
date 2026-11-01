// Procedural WebAudio: SFX, character voices, music loops and arena ambience (no external assets)
import { getSettings } from "./store";

interface Track { bpm: number; root: number; scale: number[]; chords: number[][]; kick: number[]; snare: number[]; lead: OscillatorType; swing?: number; energy: number }
const TRACKS: Record<string, Track> = {
  menu: { bpm: 112, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], kick: [0, 8], snare: [4, 12], lead: "triangle", energy: 1 },
  arena0: { bpm: 138, root: 62, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]], kick: [0, 6, 8, 14], snare: [4, 12], lead: "square", energy: 2 },
  arena1: { bpm: 150, root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [8, 0, 3], [5, 8, 0], [7, 10, 2]], kick: [0, 3, 8, 11], snare: [4, 12], lead: "sawtooth", energy: 3 },
  arena2: { bpm: 126, root: 59, scale: [0, 2, 5, 7, 9], chords: [[0, 4, 7], [5, 9, 0], [7, 11, 2], [4, 7, 11]], kick: [0, 4, 8, 12], snare: [4, 12], lead: "square", swing: 0.04, energy: 2 },
  result: { bpm: 100, root: 65, scale: [0, 4, 7, 9, 12], chords: [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]], kick: [0], snare: [8], lead: "triangle", energy: 1 },
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicG!: GainNode; sfxG!: GainNode;
  noiseBuf!: AudioBuffer;
  track: string | null = null;
  timer: number | null = null;
  step = 0; bar = 0; nextT = 0;
  amb: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  lastPlay: Record<string, number> = {};

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.musicG = this.ctx.createGain();
        this.sfxG = this.ctx.createGain();
        this.musicG.connect(this.master);
        this.sfxG.connect(this.master);
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolumes();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = getSettings();
    this.master.gain.value = s.master;
    this.musicG.gain.value = s.music * 0.35;
    this.sfxG.gain.value = s.sfx;
  }
  tone(f: number, dur: number, type: OscillatorType = "square", vol = 0.2, slide?: number, delay = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  noise(dur: number, vol = 0.2, freq = 2000, q = 0.7, type: BiquadFilterType = "bandpass", delay = 0, dest?: AudioNode, freqEnd?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  sfx(name: string) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.03) return;
    this.lastPlay[name] = now;
    switch (name) {
      case "hover": this.tone(900, 0.04, "triangle", 0.08); break;
      case "click": this.tone(520, 0.07, "square", 0.12, 780); break;
      case "select": this.tone(660, 0.08, "square", 0.14); this.tone(990, 0.12, "square", 0.14, undefined, 0.07); break;
      case "confirm": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "square", 0.14, undefined, i * 0.06)); break;
      case "back": this.tone(500, 0.1, "triangle", 0.14, 250); break;
      case "error": this.tone(200, 0.2, "sawtooth", 0.14, 120); break;
      case "jump": this.tone(300, 0.14, "square", 0.1, 620); break;
      case "dj": this.tone(450, 0.14, "square", 0.1, 900); break;
      case "land": this.noise(0.06, 0.1, 400, 1, "lowpass"); break;
      case "swing": this.noise(0.14, 0.12, 1800, 1.5, "bandpass", 0, undefined, 700); break;
      case "heavy": this.noise(0.22, 0.2, 900, 1.2, "bandpass", 0, undefined, 300); this.tone(120, 0.18, "sawtooth", 0.1, 60); break;
      case "special": this.tone(400, 0.25, "sawtooth", 0.12, 1000); this.noise(0.2, 0.1, 2500, 1, "highpass"); break;
      case "shot": this.tone(900, 0.12, "square", 0.1, 300); break;
      case "grab": this.tone(250, 0.1, "triangle", 0.15, 400); break;
      case "throw": this.noise(0.18, 0.2, 1200, 1, "bandpass", 0, undefined, 300); break;
      case "dodge": this.noise(0.18, 0.1, 3000, 2, "bandpass", 0, undefined, 1000); break;
      case "hit1": this.noise(0.08, 0.3, 1500, 1, "bandpass"); this.tone(180, 0.08, "square", 0.2, 90); break;
      case "hit2": this.noise(0.12, 0.38, 1000, 1, "bandpass"); this.tone(130, 0.14, "sawtooth", 0.25, 60); break;
      case "hit3": this.noise(0.25, 0.5, 700, 0.8, "bandpass"); this.tone(90, 0.3, "sawtooth", 0.35, 40); this.tone(1200, 0.08, "square", 0.1, 300); break;
      case "block": this.tone(1400, 0.07, "square", 0.14, 900); this.noise(0.06, 0.15, 4000, 2, "highpass"); break;
      case "perfect": this.tone(1200, 0.2, "triangle", 0.2, 2400); this.tone(1800, 0.25, "sine", 0.15, 3000, 0.05); break;
      case "shieldbreak": this.noise(0.5, 0.4, 2000, 0.5, "highpass"); this.tone(600, 0.5, "sawtooth", 0.2, 80); break;
      case "explode": this.noise(0.6, 0.5, 600, 0.6, "lowpass", 0, undefined, 80); this.tone(80, 0.5, "sawtooth", 0.3, 30); break;
      case "ult": this.tone(220, 0.8, "sawtooth", 0.2, 1760); this.noise(0.9, 0.2, 500, 1, "bandpass", 0, undefined, 6000); [523, 784, 1046].forEach((f, i) => this.tone(f, 0.3, "square", 0.12, undefined, 0.5 + i * 0.1)); break;
      case "ko": this.noise(0.9, 0.5, 400, 0.5, "lowpass", 0, undefined, 60); this.tone(700, 0.9, "sawtooth", 0.2, 80); this.tone(1400, 0.5, "sine", 0.12, 200); break;
      case "respawn": this.tone(400, 0.4, "triangle", 0.15, 1200); break;
      case "count": this.tone(660, 0.15, "square", 0.18); break;
      case "go": this.tone(990, 0.4, "square", 0.2); this.tone(1320, 0.5, "square", 0.18, undefined, 0.08); break;
      case "geyser": this.noise(0.5, 0.25, 500, 0.8, "lowpass", 0, undefined, 150); break;
      case "warn": this.tone(300, 0.1, "square", 0.08); break;
      case "win": [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, "square", 0.16, undefined, i * 0.11)); break;
      case "lose": [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.18, undefined, i * 0.22)); break;
      case "join": this.tone(600, 0.1, "triangle", 0.15); this.tone(900, 0.15, "triangle", 0.15, undefined, 0.09); break;
    }
  }
  voice(charId: number, kind: "atk" | "hurt" | "ult" | "win" | "pick") {
    if (!this.ctx) return;
    const base = [1.35, 0.8, 0.95, 0.9, 1.5, 1.25][charId] || 1;
    const f = 300 * base;
    const types: OscillatorType[] = ["sawtooth", "square", "square", "triangle", "triangle", "sawtooth"];
    const ty = types[charId] || "square";
    const v = 0.1;
    switch (kind) {
      case "atk": this.tone(f * 1.1, 0.12, ty, v, f * 1.5); break;
      case "hurt": this.tone(f * 1.4, 0.2, ty, v * 1.2, f * 0.6); break;
      case "ult": this.tone(f, 0.15, ty, v, f * 1.6); this.tone(f * 1.6, 0.3, ty, v, f * 2.2, 0.14); break;
      case "win": [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(f * m, 0.14, ty, v, undefined, i * 0.12)); break;
      case "pick": this.tone(f, 0.1, ty, v, f * 1.3); this.tone(f * 1.5, 0.14, ty, v, f * 1.8, 0.1); break;
    }
  }
  // ----- Music -----
  playMusic(name: string) {
    this.init();
    if (!this.ctx || this.track === name) return;
    this.stopMusic();
    this.track = name;
    this.step = 0;
    this.bar = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }
  schedule() {
    if (!this.ctx || !this.track) return;
    const tk = TRACKS[this.track];
    if (!tk) return;
    const sixteenth = 60 / tk.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.2) {
      const s = this.step % 16;
      const chord = tk.chords[this.bar % tk.chords.length];
      const t = this.nextT - this.ctx.currentTime;
      const d = this.musicG;
      if (tk.kick.includes(s)) { this.tone(140, 0.12, "sine", 0.5, 45, t, d); }
      if (tk.snare.includes(s)) { this.noise(0.1, 0.25, 2500, 0.8, "bandpass", t, d); }
      if (s % 2 === 0 && tk.energy > 1) this.noise(0.03, 0.08, 8000, 1, "highpass", t, d);
      if (tk.energy > 2 && s % 4 === 2) this.noise(0.03, 0.06, 9000, 1, "highpass", t, d);
      if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone(mtof(tk.root - 24 + chord[0]), sixteenth * 2.2, "triangle", 0.4, undefined, t, d);
      const arp = chord[(s / 2 | 0) % 3] + (s % 4 === 0 ? 12 : 0);
      if (s % 2 === 0) this.tone(mtof(tk.root + arp), sixteenth * 1.5, tk.lead, 0.07, undefined, t, d);
      const seed = (this.bar * 7 + s * 13) % 11;
      if ((s % 4 === 0 || (tk.energy > 1 && s % 4 === 3)) && seed > 3) {
        const note = tk.scale[seed % tk.scale.length] + 12;
        this.tone(mtof(tk.root + note), sixteenth * 2.5, tk.lead, 0.09, undefined, t + (s % 2 ? (tk.swing || 0) : 0), d);
      }
      this.nextT += sixteenth;
      this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
  }
  ambience(kind: number | null) {
    if (this.amb && this.ctx) {
      try { this.amb.src.stop(); } catch { /* already stopped */ }
      this.amb = null;
    }
    if (kind === null || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    if (kind === 0) { f.type = "highpass"; f.frequency.value = 3000; g.gain.value = 0.015; }
    else if (kind === 1) { f.type = "lowpass"; f.frequency.value = 220; g.gain.value = 0.12; }
    else { f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.6; g.gain.value = 0.03; }
    src.connect(f); f.connect(g); g.connect(this.sfxG);
    src.start();
    this.amb = { src, g };
  }
}
export const audio = new AudioEngine();
export const sfx = (n: string) => audio.sfx(n);
