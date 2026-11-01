// Battle engine: 2.5D platform fighter simulation + Three.js rendering + CPU AI + online sync
import * as THREE from "three";
import { CHARS, ARENAS, Move, ProjDef, MatchConfig, MatchResult, DIFFICULTIES, ActionKey, ACTIONS, tr } from "./data";
import { buildCharacter, applyPose, Rig } from "./models";
import { buildArena, ArenaRT, Plat } from "./arenas";
import { audio } from "./audio";
import { getSettings } from "./store";
import { room } from "./net";

const STEP = 1 / 60;
const HW = 0.38; // half width
const HH = 1.6; // height
type Inp = Record<ActionKey, boolean>;
const emptyInp = (): Inp => ({ left: false, right: false, up: false, down: false, jump: false, attack: false, heavy: false, special: false, grab: false, block: false, dodge: false, ultimate: false });
const r2 = (n: number) => Math.round(n * 100) / 100;
const sgn = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface HudPlayer { name: string; charId: number; avatar: number; percent: number; lives: number; meter: number; shield: number; slot: number; cpu: boolean; out: boolean }
export interface TrainInfo { lastDmg: number; lastKb: number; lastAng: number; lastStun: number; combo: number; maxCombo: number; total: number; move: string; dummy: string }
export interface HudState {
  time: number; unlimited: boolean; countdown: number; go: boolean; players: HudPlayer[];
  banner: { id: number; text: string; color: string } | null; train?: TrainInfo; lost: number | null; ping: number; fps: number; phase: string; ultReady: boolean;
}
export interface Callbacks { onHud(h: HudState): void; onEnd(r: MatchResult): void; onPauseKey(): void }

type FState = "idle" | "run" | "jump" | "fall" | "attack" | "hit" | "block" | "dodge" | "stun" | "dead" | "respawn" | "grabbed" | "win" | "lose";

class Fighter {
  slot: number; charId: number; def = CHARS[0]; name: string; avatar: number;
  local = true; cpuLevel = -1; dummyMode = "";
  rig: Rig; x = 0; y = 0; vx = 0; vy = 0; face = 1; yaw = 0; ground = false; platIdx = -1;
  state: FState = "idle"; st = 0;
  percent = 0; lives = 3; meter = 0; shield = 100;
  move: Move | null = null; mt = 0; activated = false; fireIdx = 0; finDone = false; hitLog = new Map<number, number>(); moveId = 0; grabHit = false;
  jumps = 0; jumping = false; airDodge = false; usedUp = false; dropT = 0; invuln = 0; freeze = 0; stunT = 0; dodgeCd = 0; counterT = 0; hazCd = 0;
  dodgeDir = 0; respT = 0; hitTime = -10; lastHitBy = -1; lastHitT = -10;
  dmg = 0; kos = 0; falls = 0; out = false; spin = 0; spinV = 0; flash = 0; time = Math.random() * 10;
  buf: Record<string, number> = {}; inp = emptyInp(); prev = emptyInp();
  // puppet
  tx = 0; ty = 0; remoteInv = false; lastMt = 0; lastMoveKey = ""; lastState: FState = "idle";
  // visuals
  shadow!: THREE.Mesh; shield3d!: THREE.Mesh; viz!: THREE.Mesh; vizS!: THREE.Mesh; tag!: THREE.Sprite; pedestal!: THREE.Mesh;
  poseOverride: "" | "win" | "lose" = "";
  constructor(slot: number, charId: number, name: string, avatar: number) {
    this.slot = slot; this.charId = charId; this.def = CHARS[charId]; this.name = name; this.avatar = avatar;
    this.rig = buildCharacter(charId);
  }
}

interface Proj { owner: number; def: ProjDef; x: number; y: number; vx: number; vy: number; life: number; ghost: boolean; hit: Set<number>; obj: THREE.Object3D; pid: number; mk: string; cid: number; big: boolean; spin: number }
interface Part { m: THREE.Mesh; vx: number; vy: number; vz: number; life: number; max: number; g: number; s0: number; rot: number }
interface Ring { m: THREE.Mesh; life: number; max: number; s0: number; s1: number }

const PBOX = new THREE.BoxGeometry(1, 1, 1);
const pMats = new Map<number, THREE.MeshBasicMaterial>();
const pMat = (c: number) => {
  let m = pMats.get(c);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); pMats.set(c, m); }
  return m;
};
const RING_GEO = new THREE.RingGeometry(0.85, 1, 28);

function tagSprite(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const x = c.getContext("2d")!;
  x.font = 'bold 30px "Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  x.textAlign = "center"; x.textBaseline = "middle";
  const w = Math.min(240, x.measureText(text).width + 36);
  x.fillStyle = color; x.beginPath(); x.roundRect(128 - w / 2, 8, w, 38, 12); x.fill();
  x.fillStyle = "#fff"; x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 4;
  x.strokeText(text, 128, 28); x.fillText(text, 128, 28);
  x.fillStyle = color; x.beginPath(); x.moveTo(116, 46); x.lineTo(140, 46); x.lineTo(128, 60); x.fill();
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1);
  s.renderOrder = 10;
  return s;
}

// ======================= CPU AI =======================
class AI {
  lvl: number; timers: Partial<Record<ActionKey, number>> = {}; dir = 0; think = 0; seenMove = -1; reactAt = 0; blockUntil = 0;
  constructor(lvl: number) { this.lvl = lvl; }
  hold(k: ActionKey, d = 0.09) { this.timers[k] = d; }
  run(f: Fighter, foe: Fighter, eng: Engine, dt: number, recoverOnly: boolean): Inp {
    const D = DIFFICULTIES[this.lvl];
    const inp = emptyInp();
    const now = eng.time;
    const dx = foe.x - f.x, adx = Math.abs(dx), dy = foe.y - f.y;
    const toward = sgn(dx) || f.face;
    const onStage = eng.onStage(f);
    // --- recovery ---
    if (!onStage || f.y < -0.5) {
      const cx = clamp(-f.x, -1, 1);
      inp.left = cx < 0; inp.right = cx > 0;
      const skill = D.recover;
      const canAct = f.state === "idle" || f.state === "fall" || f.state === "jump" || f.state === "run";
      if (canAct && f.vy < 1 && f.y < 1.5) {
        if (f.jumps < 2 && Math.random() < skill * 0.35) this.hold("jump");
        else if (!f.usedUp && f.y < -1.5 && (f.jumps >= 2 || f.y < -4) && Math.random() < skill * 0.4) { inp.up = true; this.hold("special"); this.hold("up", 0.4); }
      }
      this.applyTimers(inp, dt);
      return inp;
    }
    if (recoverOnly) { this.applyTimers(inp, dt); return inp; }
    const canAct = f.state === "idle" || f.state === "run" || f.state === "jump" || f.state === "fall";
    // --- react to foe attacks ---
    if (foe.state === "attack" && foe.move && foe.moveId !== this.seenMove) {
      this.seenMove = foe.moveId;
      this.reactAt = now + D.react * (0.6 + Math.random() * 0.8);
    }
    if (this.reactAt > 0 && now >= this.reactAt) {
      this.reactAt = 0;
      const m = foe.move;
      const threat = foe.state === "attack" && m && ((adx < 3.4 && (m.hb[2] > 0)) || (m.proj && adx < 12 && sgn(f.x - foe.x) === foe.face) || (m.ult && adx < 10));
      if (threat && foe.mt < (m!.st + m!.ac) && (f.state === "idle" || f.state === "run" || f.state === "block")) {
        if (Math.random() < D.dodge && !m!.proj) { this.hold("dodge"); this.dir = -toward; this.blockUntil = 0; }
        else if (Math.random() < D.block && f.ground) { this.blockUntil = now + 0.35 + Math.random() * 0.3; }
        else if (Math.random() < D.dodge * 0.5) this.hold("jump");
      }
    }
    if (now < this.blockUntil && f.ground) { inp.block = true; this.applyTimers(inp, dt); return inp; }
    // --- decisions ---
    this.think -= dt;
    if (this.think <= 0 && canAct) {
      this.think = D.react * (0.5 + Math.random() * 0.9);
      const id = f.charId;
      const ranged = id === 3 || id === 4 || id === 5;
      const range = ({ 0: 1.9, 1: 2.2, 2: 2.0, 3: 2.5, 4: 1.8, 5: 1.9 } as Record<number, number>)[id] || 2;
      this.dir = 0;
      const foeHit = foe.state === "hit" || foe.state === "stun" || foe.state === "grabbed";
      if (f.meter >= 100 && eng.rules.ult && adx < 9 && Math.random() < D.ult * 0.5) { this.hold("ultimate"); }
      else if (foeHit && adx < range + 0.6 && Math.random() < D.combo) {
        this.dir = toward;
        this.hold(Math.random() < 0.7 ? "attack" : "heavy");
        if (foe.percent > 90 && Math.random() < 0.5) { this.hold("heavy"); }
      } else if (adx > range * (0.85 + 0.3 * D.acc) + (ranged ? 3.5 : 0)) {
        // approach / keep distance
        if (ranged && adx > 4 && adx < 11 && Math.random() < 0.65 && Math.abs(dy) < 3) { this.hold("special"); }
        else if (Math.random() < 0.35 + D.aggr * 0.65) this.dir = toward;
        if (dy > 2.5 && Math.random() < 0.5 && f.ground) this.hold("jump");
        else if (adx > 6 && Math.random() < 0.08 * D.aggr && f.ground) this.hold("jump");
        if (D.aggr > 0.6 && adx > 5 && adx < 10 && Math.random() < 0.25 && id !== 4) { this.dir = toward; this.hold("special"); inp.right = toward > 0; inp.left = toward < 0; }
      } else {
        // in range
        const r = Math.random();
        if (Math.random() < D.aggr + 0.1) {
          this.dir = Math.random() < 0.5 ? toward : 0;
          if (dy > 1.8) { this.hold("up", 0.2); this.hold("attack"); }
          else if (r < 0.4) this.hold("attack");
          else if (r < 0.55) { this.dir = toward; this.hold("attack"); }
          else if (r < 0.72) { this.dir = toward; this.hold("heavy"); }
          else if (r < 0.82 && D.combo > 0.3) { this.hold("grab"); }
          else if (r < 0.92) { this.dir = toward; this.hold("special"); }
          else { this.hold("down", 0.15); this.hold("attack"); }
          if (!f.ground && Math.random() < 0.6) { this.hold("attack"); }
        } else if (Math.random() < 0.3 * D.dodge + 0.05) {
          this.dir = -toward; // back off
        }
      }
    }
    if (canAct && !eng.onStage(foe) && foe.y < 2) {
      const tx = clamp(foe.x, -6, 6);
      this.dir = Math.abs(tx - f.x) > 0.6 ? sgn(tx - f.x) : 0;
      if ((f.charId >= 3) && adx < 11 && Math.random() < 0.02) this.hold("special");
    }
    if (f.ground && this.dir !== 0 && !eng.onStage({ x: f.x + this.dir * 1.3, y: f.y } as Fighter)) this.dir = 0;
    inp.left = this.dir < 0 || inp.left; inp.right = this.dir > 0 || inp.right;
    if (this.dir === 0 && Math.random() < 0.002) inp.down = true;
    this.applyTimers(inp, dt);
    return inp;
  }
  applyTimers(inp: Inp, dt: number) {
    for (const k of ACTIONS) {
      const t = this.timers[k];
      if (t !== undefined && t > 0) { inp[k] = true; this.timers[k] = t - dt; }
    }
  }
}

// ======================= Engine =======================
export class Engine {
  renderer!: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  container: HTMLElement; canvas: HTMLCanvasElement; cfg: MatchConfig; cb: Callbacks;
  arena: { rt: ArenaRT; meta: (typeof ARENAS)[number]; lowest: number };
  fighters: Fighter[] = []; projs: Proj[] = []; parts: Part[] = []; rings: Ring[] = [];
  rules: MatchConfig["rules"]; plats: Plat[] = []; prevPlats: Plat[] = []; platDx: number[] = [];
  keys = new Set<string>(); tap = new Set<string>(); time = 0; elapsed = 0; phase: "count" | "fight" | "ended" = "count"; cd = 3.2; goT = 0;
  paused = false; disposed = false; raf = 0; lastNow = 0; acc = 0; frameAcc = 0; fpsC = 0; fpsT = 0; fps = 60;
  shake = 0; zoomPulse = 0; hudT = 0; banner: HudState["banner"] = null; bannerId = 0; bannerT = 0;
  camX = 0; camY = 2; camZ = 24; snapN = 0; pidN = 1; moveSeq = 1;
  train: TrainInfo = { lastDmg: 0, lastKb: 0, lastAng: 0, lastStun: 0, combo: 0, maxCombo: 0, total: 0, move: "-", dummy: "stand" };
  ais: AI[] = [];
  lostT = 0; resultT = 0; result: MatchResult | null = null; ro?: ResizeObserver;
  settings = getSettings(); netLost = false; isOnline: boolean; mySlot: number;
  stageGlow = 0; flashEl: THREE.Mesh;

  constructor(container: HTMLElement, cfg: MatchConfig, cb: Callbacks) {
    this.container = container; this.cfg = cfg; this.cb = cb; this.rules = cfg.rules;
    this.isOnline = cfg.mode === "online";
    this.mySlot = this.isOnline ? cfg.localSlot : 0;
    const s = this.settings;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: s.quality !== "low", powerPreference: "high-performance" });
    const pr = Math.min(window.devicePixelRatio || 1, s.quality === "high" ? 2 : s.quality === "medium" ? 1.25 : 1) * s.resScale;
    this.renderer.setPixelRatio(pr);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
    const meta = ARENAS[cfg.arena];
    const rt = buildArena(cfg.arena);
    this.arena = { rt, meta, lowest: -1 };
    this.scene.add(rt.group);
    this.scene.background = new THREE.Color(rt.bg);
    this.scene.fog = new THREE.Fog(rt.fog[0], rt.fog[1], rt.fog[2]);
    this.plats = rt.plats(0); this.prevPlats = this.plats;
    // fighters
    cfg.players.forEach((p, i) => {
      const f = new Fighter(i, p.charId, p.name, p.avatar);
      f.lives = cfg.mode === "training" ? 99 : this.rules.stocks;
      f.local = cfg.mode === "online" ? i === this.mySlot : true;
      f.x = i === 0 ? -3.2 : 3.2; f.face = i === 0 ? 1 : -1; f.yaw = f.face * (Math.PI / 2 - 0.45);
      f.tx = f.x;
      if (p.cpu) { f.cpuLevel = p.level; this.ais[i] = new AI(p.level); }
      if (cfg.mode === "training" && i === 1) { f.dummyMode = "stand"; this.ais[i] = new AI(2); }
      this.setupVisual(f, i);
      this.fighters.push(f);
    });
    // screen flash plane (for ultimates)
    this.flashEl = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.flashEl.renderOrder = 999; this.flashEl.frustumCulled = false;
    this.camera.add(this.flashEl); this.flashEl.position.z = -1; this.scene.add(this.camera);
    this.flashEl.scale.set(2, 2, 1);
    // input
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) { if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault(); return; }
      if (e.code === "Escape") { this.cb.onPauseKey(); return; }
      this.keys.add(e.code); this.tap.add(e.code);
      if (e.code === "KeyR" && cfg.mode === "training") this.resetTraining(false);
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Tab") e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    const bl = () => this.keys.clear();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", bl);
    this.unsub(() => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", bl); });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    // network
    if (this.isOnline) {
      room.lobby.inMatch = true;
      this.unsub(room.on("snap", (m) => this.onSnap(m)));
      this.unsub(room.on("hit", (m) => this.onNetHit(m)));
      this.unsub(room.on("hr", (m) => this.onNetHitResult(m)));
      this.unsub(room.on("proj", (m) => this.onNetProj(m)));
      this.unsub(room.on("ko", (m) => this.onNetKo(m)));
      this.unsub(room.on("end", (m) => this.onNetEnd(m)));
      this.unsub(room.on("fxu", (m) => this.onNetFx(m)));
      this.unsub(room.on("peerback", () => { this.lostT = 0; this.sendSnap(true); }));
    }
    audio.init();
    audio.playMusic("arena" + cfg.arena);
    audio.ambience(cfg.arena);
    this.cd = cfg.mode === "training" ? 0.01 : 3.2;
    this.raf = requestAnimationFrame(this.loop);
  }
  unsub(f: () => void) { this.unsub_.push(f); }
  private unsub_: (() => void)[] = [];

  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsub_.forEach((f) => f());
    this.ro?.disconnect();
    audio.ambience(null);
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch { /* noop */ }
    this.canvas.remove();
  }
  setPaused(p: boolean) { if (!this.isOnline) this.paused = p; }

  // ---------- visuals ----------
  setupVisual(f: Fighter, i: number) {
    const col = i === 0 ? "#ff4d6d" : "#3d8bff";
    this.scene.add(f.rig.root);
    f.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    f.shadow.rotation.x = -Math.PI / 2; this.scene.add(f.shadow);
    f.shield3d = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.3, depthWrite: false }));
    f.shield3d.visible = false; this.scene.add(f.shield3d);
    f.viz = new THREE.Mesh(PBOX, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
    f.viz.visible = false; this.scene.add(f.viz);
    f.vizS = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, wireframe: false }));
    f.vizS.visible = false; this.scene.add(f.vizS);
    const label = (this.cfg.players[i].cpu ? "CPU " : `P${i + 1} `) + f.name;
    f.tag = tagSprite(label.length > 14 ? label.slice(0, 14) : label, col);
    this.scene.add(f.tag);
    f.pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.2, 12), new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.75 }));
    f.pedestal.visible = false; this.scene.add(f.pedestal);
  }
  burst(x: number, y: number, col: number, n: number, sp: number, size = 0.18, life = 0.5, g = 12, z = 0.3) {
    const k = this.settings.vfx === 0 ? 0 : this.settings.vfx === 1 ? 0.5 : 1;
    n = Math.round(n * k);
    for (let i = 0; i < n && this.parts.length < 260; i++) {
      const m = new THREE.Mesh(PBOX, pMat(col));
      m.position.set(x, y, z); m.scale.setScalar(size);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, s = sp * (0.4 + Math.random() * 0.8);
      this.parts.push({ m, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (Math.random() - 0.3) * s * 0.4, life, max: life, g, s0: size * (0.6 + Math.random() * 0.8), rot: Math.random() * 6 });
    }
  }
  ring(x: number, y: number, col: number, s0: number, s1: number, life = 0.35) {
    if (this.settings.vfx === 0 || this.rings.length > 24) return;
    const m = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set(x, y, 0.5); m.scale.setScalar(s0);
    this.scene.add(m);
    this.rings.push({ m, life, max: life, s0, s1 });
  }
  banner_(text: string, color = "#fff") { this.banner = { id: ++this.bannerId, text, color }; this.bannerT = 1.3; }
  doShake(v: number) { if (this.settings.shake) this.shake = Math.max(this.shake, v); }
  flashScreen(v: number, col = 0xffffff) { (this.flashEl.material as THREE.MeshBasicMaterial).color.setHex(col); this.stageGlow = Math.max(this.stageGlow, v); }

  // ---------- main loop ----------
  loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const cap = this.settings.fpsCap;
    if (cap > 0 && now - this.lastNow < 1000 / cap - 2) return;
    const dt = Math.min(0.05, (now - this.lastNow) / 1000 || STEP);
    this.lastNow = now;
    this.fpsC++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.fpsC / this.fpsT); this.fpsC = 0; this.fpsT = 0; }
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 5) { this.step(STEP); this.acc -= STEP; n++; }
    if (n === 5) this.acc = 0;
    this.render(dt);
    this.hudT += dt;
    if (this.hudT > 0.066) { this.hudT = 0; this.cb.onHud(this.getHud()); }
  };

  getHud(): HudState {
    const rules = this.rules;
    const unlimited = rules.time === 0 || this.cfg.mode === "training";
    return {
      time: unlimited ? this.elapsed : Math.max(0, rules.time * 60 - this.elapsed), unlimited,
      countdown: this.phase === "count" ? Math.ceil(this.cd) : 0, go: this.phase === "fight" && this.goT > 0,
      players: this.fighters.map((f) => ({ name: f.name, charId: f.charId, avatar: f.avatar, percent: f.percent, lives: f.lives, meter: f.meter, shield: f.shield, slot: f.slot, cpu: f.cpuLevel >= 0, out: f.out })),
      banner: this.bannerT > 0 ? this.banner : null,
      train: this.cfg.mode === "training" ? this.train : undefined,
      lost: this.netLost ? Math.max(0, 15 - this.lostT) : null,
      ping: room.ping, fps: this.fps, phase: this.phase,
      ultReady: this.fighters[this.mySlot].meter >= 100,
    };
  }

  onStage(f: Fighter) {
    for (const p of this.plats) if (f.x > p.x - p.w / 2 - 0.2 && f.x < p.x + p.w / 2 + 0.2 && f.y >= p.y - (p.solid ? p.th : 0.5) - 0.2) return true;
    return false;
  }

  step(dt: number) {
    if (this.paused) return;
    this.time += dt;
    // net lost handling
    if (this.isOnline && this.phase !== "ended") {
      const lost = !room.connected;
      if (lost) {
        this.lostT += dt; this.netLost = true;
        if (this.lostT > 15) {
          const host = room.role === "host";
          this.finish(host ? this.mySlot : -1, host ? "forfeit" : "aborted", true);
        }
        return;
      }
      this.netLost = false; this.lostT = 0;
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    // arena
    if (this.phase === "fight") this.elapsed += dt;
    const at = this.phase === "count" ? 0 : this.elapsed;
    this.prevPlats = this.plats;
    this.plats = this.arena.rt.plats(at);
    this.platDx = this.plats.map((p, i) => p.x - (this.prevPlats[i]?.x ?? p.x));
    this.arena.lowest = -(this.arena.meta.blastY) * 0.45;
    this.arena.rt.update(at, dt);
    if (this.phase === "count") {
      const before = Math.ceil(this.cd);
      this.cd -= dt;
      const after = Math.ceil(this.cd);
      if (after !== before && after > 0) audio.sfx("count");
      if (this.cd <= 0) { this.phase = "fight"; this.goT = 0.8; audio.sfx("go"); if (this.cfg.mode !== "training") this.banner_("GO!", "#ffe14d"); }
      for (const f of this.fighters) this.updateVisualsOnly(f, dt);
      return;
    }
    if (this.goT > 0) this.goT -= dt;
    const [a, b] = this.fighters;
    for (const f of this.fighters) {
      if (f.local) this.stepFighter(f, f === a ? b : a, dt);
      else this.stepPuppet(f, dt);
      f.flash = Math.max(0, f.flash - dt);
      f.time += dt;
    }
    this.stepProjs(dt);
    this.stepParts(dt);
    if (this.phase === "fight") {
      if (this.isOnline) {
        this.snapN++;
        if (this.snapN % 2 === 0) this.sendSnap(false);
      }
      this.checkEnd();
    } else if (this.phase === "ended") {
      this.resultT -= dt;
      if (this.resultT <= 0 && this.result) { const r = this.result; this.result = null; this.cb.onEnd(r); }
    }
    this.shake *= Math.pow(0.001, dt);
    this.zoomPulse *= Math.pow(0.02, dt);
  }

  updateVisualsOnly(f: Fighter, dt: number) { f.time += dt; }

  // ---------- fighter simulation ----------
  readInput(f: Fighter, foe: Fighter, dt: number): Inp {
    if (f.cpuLevel >= 0 || f.dummyMode) {
      const ai = this.ais[f.slot];
      if (f.dummyMode === "stand") return ai.run(f, foe, this, dt, true);
      if (f.dummyMode === "block") { const i = ai.run(f, foe, this, dt, true); i.block = true; return i; }
      if (f.dummyMode === "jump") { const i = ai.run(f, foe, this, dt, true); if (f.ground && Math.random() < 0.02) i.jump = true; return i; }
      return ai.run(f, foe, this, dt, false);
    }
    const k = this.settings.keys, inp = emptyInp();
    const dn = (c: string) => this.keys.has(c) || this.tap.has(c);
    for (const a of ACTIONS) inp[a] = dn(k[a]);
    if (dn("ArrowLeft")) inp.left = true;
    if (dn("ArrowRight")) inp.right = true;
    if (dn("ArrowUp")) inp.up = true;
    if (dn("ArrowDown")) inp.down = true;
    this.tap.clear();
    if (inp.left && inp.right) inp.left = inp.right = false;
    return inp;
  }
  pressed(f: Fighter, k: ActionKey) { return f.buf[k] > 0; }
  consume(f: Fighter, k: ActionKey) { f.buf[k] = 0; }

  isInvuln(f: Fighter) {
    if (!f.local) return f.remoteInv;
    if (f.invuln > 0 || f.state === "dead") return true;
    if (f.state === "dodge" && f.st > 0.04 && f.st < 0.27) return true;
    if (f.state === "attack" && f.move?.inv && f.mt < f.move.st + f.move.ac) return true;
    return false;
  }

  stepFighter(f: Fighter, foe: Fighter, dt: number) {
    if (f.freeze > 0) { f.freeze -= dt; return; }
    const ph = f.def.phys;
    const inp = this.phase === "ended" ? emptyInp() : this.readInput(f, foe, dt);
    f.prev = f.inp; f.inp = inp;
    for (const k of ACTIONS) { if (inp[k] && !f.prev[k]) f.buf[k] = 0.13; else if (f.buf[k] > 0) f.buf[k] -= dt; }
    if (!this.rules.ult) f.buf.ultimate = 0;
    f.st += dt;
    if (f.invuln > 0) f.invuln -= dt;
    if (f.dodgeCd > 0) f.dodgeCd -= dt;
    if (f.counterT > 0) f.counterT -= dt;
    if (f.hazCd > 0) f.hazCd -= dt;
    if (this.cfg.mode === "training" && f.slot === 0) f.meter = 100;
    if (f.state !== "block" && f.state !== "stun") f.shield = Math.min(100, f.shield + 22 * dt);
    const dirIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    // platform carry
    if (f.ground && f.platIdx >= 0) f.x += this.platDx[f.platIdx] || 0;

    if (this.phase === "ended") { this.freeFall(f, dt, ph, 0); return; }

    switch (f.state) {
      case "dead":
        f.respT -= dt;
        if (f.respT <= 0) this.respawn(f);
        return;
      case "respawn":
        f.vx = f.vy = 0;
        f.x += dirIn * 3 * dt; f.y += (inp.up ? 1 : inp.down ? -1 : 0) * 2 * dt;
        if (f.st > 2.4 || (f.buf.jump > 0 && f.st > 0.4) || (f.st > 0.4 && (f.buf.attack > 0 || f.buf.special > 0))) { f.state = "fall"; f.st = 0; f.invuln = Math.max(f.invuln, 1.2); }
        return;
      case "hit": case "grabbed": {
        f.stunT -= dt;
        f.vx += dirIn * 5 * dt;
        this.freeFall(f, dt, ph, 0);
        f.spin += f.spinV * dt;
        if (f.stunT <= 0) { f.state = f.ground ? "idle" : "fall"; f.st = 0; f.spin = 0; this.train.combo = 0; }
        else if (f.ground && Math.abs(f.vx) > 0.2) f.vx *= 1 - Math.min(1, 4 * dt);
        this.checkKO(f);
        return;
      }
      case "stun":
        f.stunT -= dt; f.vx *= 1 - Math.min(1, 6 * dt);
        this.freeFall(f, dt, ph, 0);
        if (f.stunT <= 0) { f.state = f.ground ? "idle" : "fall"; f.shield = 40; }
        this.checkKO(f);
        return;
      case "attack": this.stepAttack(f, foe, dt, dirIn, ph); this.checkKO(f); return;
      case "dodge": {
        f.vx *= 1 - Math.min(1, 5 * dt);
        if (!f.ground) f.vy = f.st < 0.25 ? 0 : f.vy - 30 * dt;
        this.integrate(f, dt, f.ground || f.st >= 0.25 ? ph.grav : 0, ph);
        if (f.st >= 0.38) { f.state = f.ground ? "idle" : "fall"; f.st = 0; f.dodgeCd = 0.35; }
        this.checkKO(f);
        return;
      }
      case "block": {
        f.shield -= 10 * dt;
        f.vx *= 1 - Math.min(1, 12 * dt);
        this.integrate(f, dt, ph.grav, ph);
        if (!inp.block || !f.ground) { f.state = "idle"; f.st = 0; }
        else if (f.shield <= 0) this.shieldBreak(f);
        else if (f.buf.dodge > 0 && f.dodgeCd <= 0) { this.consume(f, "dodge"); this.startDodge(f, dirIn); }
        this.checkKO(f);
        return;
      }
    }
    // ---- free states ----
    const free = f.state === "idle" || f.state === "run" || f.state === "jump" || f.state === "fall";
    if (free) {
      // actions
      if (inp.block && f.ground && f.shield > 8) {
        f.state = "block"; f.st = 0; audio.sfx("grab");
        return;
      }
      if (f.buf.dodge > 0 && f.dodgeCd <= 0 && (f.ground || !f.airDodge)) { this.consume(f, "dodge"); this.startDodge(f, dirIn); return; }
      if (f.buf.ultimate > 0 && f.meter >= 100) { this.consume(f, "ultimate"); this.startMove(f, f.def.moves.ult, foe); return; }
      if (f.buf.grab > 0 && f.ground) { this.consume(f, "grab"); this.startMove(f, f.def.moves.grab, foe); return; }
      const mk = this.pickMove(f, dirIn);
      if (mk) {
        const m = f.def.moves[mk];
        if (!(m.rise && f.usedUp)) { this.startMove(f, m, foe, dirIn); return; }
      }
    }
    // jump
    if (f.buf.jump > 0) {
      if (f.ground) { this.consume(f, "jump"); f.vy = ph.jump; f.ground = false; f.jumps = 1; f.jumping = true; audio.sfx("jump"); this.burst(f.x, f.y, 0xffffff, 5, 3, 0.12, 0.3, 2); }
      else if (f.jumps < 2) { this.consume(f, "jump"); f.vy = ph.jump * 0.94; f.jumps = 2; f.jumping = true; audio.sfx("dj"); this.ring(f.x, f.y + 0.3, 0xffffff, 0.3, 1.4, 0.3); }
    }
    if (f.jumping && !inp.jump && f.vy > 6) { f.vy = 6; f.jumping = false; }
    if (f.vy <= 0) f.jumping = false;
    // horizontal
    const sp = ph.speed;
    if (f.ground) {
      const target = dirIn * sp;
      const a = dirIn !== 0 && sgn(f.vx) !== dirIn && f.vx !== 0 ? 110 : dirIn !== 0 ? 70 : 55;
      f.vx += clamp(target - f.vx, -a * dt, a * dt);
      if (dirIn) f.face = dirIn;
    } else {
      const target = dirIn * sp * ph.air;
      if (dirIn !== 0 && Math.abs(f.vx) <= Math.abs(target)) f.vx += dirIn * 38 * dt;
      else if (dirIn !== 0 && sgn(f.vx) !== dirIn) f.vx += dirIn * 24 * dt;
      else if (dirIn === 0) f.vx *= 1 - 0.7 * dt;
      if (dirIn) f.face = dirIn;
    }
    // drop through / fast fall
    if (f.ground && inp.down && f.buf.down === undefined) { /* noop */ }
    if (f.ground && f.platIdx >= 0 && !this.plats[f.platIdx].solid && inp.down && !f.prev.down) { f.dropT = 0.28; f.y -= 0.06; f.ground = false; }
    const fall = inp.down && f.vy < 0 && !f.ground ? 30 : 21;
    this.integrate(f, dt, ph.grav, ph, fall);
    // state label
    if (f.ground) f.state = Math.abs(f.vx) > 0.6 && dirIn !== 0 ? "run" : "idle";
    else f.state = f.vy > 0.5 ? "jump" : "fall";
    this.checkKO(f);
    this.checkHazards(f);
  }

  freeFall(f: Fighter, dt: number, ph: { grav: number }, extra: number) {
    void extra;
    this.integrate(f, dt, ph.grav, ph as never, 26);
    this.checkHazards(f);
  }

  integrate(f: Fighter, dt: number, grav: number, _ph: unknown, maxFall = 22) {
    if (grav > 0) { f.vy -= 36 * grav * dt; if (f.vy < -maxFall) f.vy = -maxFall; }
    const prevY = f.y;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.dropT > 0) f.dropT -= dt;
    const was = f.ground;
    f.ground = false; f.platIdx = -1;
    for (let i = 0; i < this.plats.length; i++) {
      const p = this.plats[i];
      const left = p.x - p.w / 2, right = p.x + p.w / 2, top = p.y;
      if (f.x + HW < left || f.x - HW > right) continue;
      if (p.solid) {
        const bottom = top - p.th;
        if (f.vy <= 0 && prevY >= top - 0.06 && f.y <= top) {
          if ((f.state === "hit" || f.state === "grabbed") && f.vy < -10) { f.vy = -f.vy * 0.35; f.y = top + 0.02; this.burst(f.x, top, 0xffffff, 6, 4, 0.14, 0.35, 4); audio.sfx("land"); this.doShake(0.2); continue; }
          f.y = top; f.vy = 0; f.ground = true; f.platIdx = i;
        } else if (f.y < top - 0.06 && f.y + HH > bottom) {
          if (f.vy > 0 && prevY + HH <= bottom + 0.08) { f.y = bottom - HH; f.vy = f.state === "hit" ? -f.vy * 0.3 : 0; }
          else {
            const side = f.x < p.x ? -1 : 1;
            f.x = side < 0 ? left - HW : right + HW;
            if (sgn(f.vx) === -side) f.vx = f.state === "hit" ? -f.vx * 0.5 : 0;
          }
        }
      } else if (f.vy <= 0 && prevY >= top - 0.06 && f.y <= top && f.dropT <= 0) {
        if ((f.state === "hit" || f.state === "grabbed") && f.vy < -10) { f.vy = -f.vy * 0.3; f.y = top + 0.02; continue; }
        f.y = top; f.vy = 0; f.ground = true; f.platIdx = i;
      }
    }
    if (f.ground) {
      if (!was) { this.burst(f.x, f.y, 0xffffff, 4, 2.5, 0.12, 0.3, 2); if (f.vy < -5 || true) audio.sfx("land"); }
      f.jumps = 0; f.usedUp = false; f.airDodge = false; f.jumping = false;
    }
  }

  pickMove(f: Fighter, dirIn: number): string | null {
    const inp = f.inp, g = f.ground;
    const fwd = dirIn !== 0 && dirIn === f.face, back = dirIn !== 0 && dirIn !== f.face;
    if (f.buf.special > 0) {
      this.consume(f, "special");
      return inp.up ? "uspecial" : dirIn !== 0 ? "sspecial" : "special";
    }
    const press = f.buf.attack > 0 ? "attack" : f.buf.heavy > 0 ? "heavy" : "";
    if (!press) return null;
    this.consume(f, press as ActionKey);
    if (g) {
      if (press === "attack") return inp.up ? "utilt" : inp.down ? "dtilt" : dirIn !== 0 ? "ftilt" : "jab";
      return inp.up ? "uheavy" : inp.down ? "dheavy" : "heavy";
    }
    if (inp.up) return "uair";
    if (inp.down) return "dair";
    if (back) return "bair";
    if (fwd) return "fair";
    return "nair";
  }

  startDodge(f: Fighter, dirIn: number) {
    f.state = "dodge"; f.st = 0; f.dodgeDir = dirIn;
    if (!f.ground) f.airDodge = true;
    f.vx = dirIn * (f.ground ? 11 : 9);
    if (!f.ground) f.vy = 0;
    audio.sfx("dodge");
  }
  shieldBreak(f: Fighter) {
    f.state = "stun"; f.stunT = 1.8; f.st = 0; f.vy = 9; f.ground = false; f.shield = 0;
    audio.sfx("shieldbreak"); this.burst(f.x, f.y + 1, 0x7fe0ff, 24, 8, 0.2, 0.6, 6); this.ring(f.x, f.y + 1, 0x7fe0ff, 0.5, 3, 0.5);
    if (f.local && f.slot === this.mySlot) this.banner_(tr("護盾破碎！", "SHIELD BREAK!"), "#7fe0ff");
  }

  startMove(f: Fighter, m: Move, foe: Fighter, dirIn = 0) {
    if (m.ult && f.meter < 100) return;
    if (m.air && f.ground) m = f.def.moves.jab;
    f.state = "attack"; f.move = m; f.mt = 0; f.st = 0; f.activated = false; f.fireIdx = 0; f.finDone = false; f.hitLog = new Map(); f.moveId = this.moveSeq++; f.grabHit = false;
    f.invuln = Math.min(f.invuln, 0.2);
    if (dirIn !== 0 && f.ground && m.key !== "bair") f.face = dirIn;
    if (m.rise) f.usedUp = true;
    if (m.ult) {
      f.meter = 0;
      audio.sfx("ult"); audio.voice(f.charId, "ult");
      this.flashScreen(0.7, m.col); this.zoomPulse = 1; this.doShake(0.6);
      this.ring(f.x, f.y + 1, m.col, 0.5, 6, 0.6);
      this.burst(f.x, f.y + 1, m.col, 30, 9, 0.22, 0.7, 2);
      this.banner_(f.name + "：" + tr(m.name, m.en), "#" + m.col.toString(16).padStart(6, "0"));
      if (this.isOnline && f.local) room.send({ t: "fxu", k: "ult", s: f.slot });
    } else {
      audio.sfx(m.sfx);
      if (Math.random() < 0.5 || m.proj || m.key === "heavy") audio.voice(f.charId, "atk");
    }
    void foe;
  }

  stepAttack(f: Fighter, foe: Fighter, dt: number, dirIn: number, ph: { grav: number; air: number; speed: number }) {
    const m = f.move!;
    f.mt += dt;
    const t = f.mt;
    const actStart = m.st, actEnd = m.st + m.ac, total = m.st + m.ac + m.rc * (f.grabHit ? 0.6 : 1);
    // activation
    if (!f.activated && t >= actStart) {
      f.activated = true;
      if (m.lunge) f.vx = f.face * m.lunge;
      if (m.hop) f.vy = m.hop;
      if (m.rise) { f.vy = m.rise; f.ground = false; }
      if (m.dash) f.vx = f.face * m.dash;
      if (m.fx === "slash" || m.fx === "zslash") this.burst(f.x + f.face * (m.hb[0] || 1), f.y + m.hb[1], m.col, 6, 5, 0.14, 0.25, 0);
    }
    const inAct = t >= actStart && t < actEnd;
    // movement during move
    if (m.dash && inAct) {
      f.vx = f.face * m.dash;
      if (m.ult && !this.onStage({ ...f, x: f.x + f.face * 1.2 } as Fighter)) f.vx = 0;
      if (m.fx === "zslash") f.vy = ((t - actStart) / m.ac < 0.5 ? 6 : -6);
      else if (m.noG) f.vy = 0;
      if (Math.random() < 0.7) this.burst(f.x - f.face * 0.4, f.y + 0.9, m.col, 1, 1.5, 0.2, 0.3, 0);
    }
    const useGrav = !(m.noG && inAct) && !(m.rise && inAct);
    const vx0 = f.vx;
    if (f.ground && !m.dash) f.vx *= 1 - Math.min(1, 8 * dt);
    else if (!f.ground && !m.dash && !m.rise) f.vx += dirIn * 20 * dt * ph.air;
    if (m.rise && inAct && dirIn) f.vx += dirIn * 30 * dt;
    if (Math.abs(f.vx) > ph.speed * 1.1 && Math.abs(f.vx) > Math.abs(vx0)) f.vx = vx0;
    if (m.rise && inAct) f.vy = Math.max(f.vy, m.rise * 0.45 * (1 - (t - actStart) / m.ac) + 2);
    this.integrate(f, dt, useGrav ? ph.grav : 0, ph);
    if (m.air && f.ground && !inAct) { /* landing lag */ f.mt = Math.max(f.mt, actEnd); }
    if (m.grab) f.face = f.face;
    // hits
    if (inAct && m.hb[2] > 0 && !m.proj) this.meleeCheck(f, foe, m, false);
    // fire projectiles
    if (m.fire) {
      while (f.fireIdx < m.fire.length && t >= m.st + m.fire[f.fireIdx].t) {
        this.fireProj(f, foe, m, m.fire[f.fireIdx]);
        f.fireIdx++;
      }
    }
    // final hit
    if (m.fin && !f.finDone && t >= actEnd) {
      f.finDone = true;
      this.meleeCheck(f, foe, m, true);
      this.burst(f.x + f.face * m.hb[0], f.y + m.hb[1], m.col, 22, 9, 0.22, 0.6, 3);
      this.ring(f.x + f.face * m.hb[0] * 0.6, f.y + 1, m.col, 0.5, 4.5, 0.4);
      audio.sfx("explode");
    }
    if (t >= total) {
      f.state = f.ground ? "idle" : "fall"; f.st = 0; f.move = null;
      if (m.ult) f.invuln = Math.max(f.invuln, 0.15);
    }
  }

  hurtBox(t: Fighter) { return { x0: t.x - HW, x1: t.x + HW, y0: t.y, y1: t.y + HH }; }

  meleeCheck(f: Fighter, foe: Fighter, m: Move, fin: boolean) {
    const [cx, cy, w, h] = m.hb;
    const bx = f.x + f.face * cx, by = f.y + cy;
    const x0 = bx - w / 2, x1 = bx + w / 2, y0 = by - h / 2, y1 = by + h / 2;
    const hb = this.hurtBox(foe);
    if (x1 < hb.x0 || x0 > hb.x1 || y1 < hb.y0 || y0 > hb.y1) return;
    if (this.isInvuln(foe) && !m.grab) return;
    if (m.grab && this.isInvuln(foe)) return;
    if (foe.state === "dead" || foe.state === "respawn") return;
    const last = f.hitLog.get(foe.slot);
    if (!fin) {
      if (last !== undefined && (!m.multi || f.mt - last < m.multi)) return;
    }
    f.hitLog.set(foe.slot, f.mt);
    const p = fin && m.fin ? m.fin : m;
    if (m.grab) {
      f.grabHit = true;
      const inp = f.inp;
      const back = (inp.left || inp.right) && ((inp.right ? 1 : -1) !== f.face);
      const dir = inp.up ? "u" : inp.down ? "d" : back ? "b" : "f";
      const T = { f: [8, 9, 1.0, 35, f.face], b: [9, 10, 1.0, 35, -f.face], u: [7, 9, 0.9, 85, f.face], d: [10, 5.5, 1.2, 70, f.face] }[dir]!;
      audio.sfx("throw");
      this.dealHit(f, foe, { dmg: T[0], kb: T[1], ks: T[2], ang: T[3], dx: T[4], grab: true, mv: m.key, snapX: f.x + f.face * 0.9, pull: false, ult: false, col: m.col });
      return;
    }
    this.dealHit(f, foe, { dmg: p.dmg, kb: p.kb, ks: p.ks, ang: p.ang, pull: !!m.pull && !fin, mv: m.key, ult: !!m.ult, fin, col: m.col, multi: !!m.multi && !fin });
  }

  fireProj(f: Fighter, foe: Fighter, m: Move, fr: NonNullable<Move["fire"]>[number]) {
    const def = m.proj!;
    let x: number, y: number, vx: number, vy: number;
    if (fr.sky !== undefined) {
      x = foe.x + (fr.sx || 0) + (Math.random() - 0.5) * 0.6; y = Math.max(foe.y, 0) + fr.sky; vx = 0; vy = def.vy || -15;
    } else {
      x = f.x + f.face * (fr.dx ?? 0.9); y = f.y + (fr.dy ?? 1.0);
      vx = f.face * (fr.vx ?? def.sp); vy = (fr.vy ?? def.vy ?? 0);
    }
    this.spawnProj(f.slot, f.charId, m.key, x, y, vx, vy, !!fr.big, false, this.pidN++);
    if (m.key !== "ult") audio.sfx("shot");
    if (this.isOnline && f.local) room.send({ t: "proj", s: f.slot, c: f.charId, k: m.key, x: r2(x), y: r2(y), vx: r2(vx), vy: r2(vy), b: fr.big ? 1 : 0, p: this.pidN - 1 });
  }

  spawnProj(owner: number, cid: number, mk: string, x: number, y: number, vx: number, vy: number, big: boolean, ghost: boolean, pid: number) {
    const base = CHARS[cid].moves[mk].proj!;
    const def: ProjDef = big ? { ...base, w: base.w * 2.6, h: base.h * 2.6, dmg: 12, kb: 12, ks: 1.7, ang: 30 } : base;
    const obj = this.projMesh(def);
    obj.position.set(x, y, 0);
    this.scene.add(obj);
    this.projs.push({ owner, def, x, y, vx, vy, life: def.life, ghost, hit: new Set(), obj, pid, mk, cid, big, spin: 0 });
  }
  projMesh(def: ProjDef): THREE.Object3D {
    const g = new THREE.Group();
    const c = def.col;
    const bb = (w: number, h: number, d: number, col: number, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(PBOX, pMat(col)); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m; };
    switch (def.shape) {
      case "wave": { const t = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 5, 12, Math.PI), pMat(c)); t.rotation.z = -Math.PI / 2; g.add(t); const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 5, 10, Math.PI), pMat(0xffffff)); t2.rotation.z = -Math.PI / 2; g.add(t2); break; }
      case "bomb": { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), pMat(c)); g.add(s); bb(0.12, 0.3, 0.12, 0x3a2a1a, 0, 0.55); bb(0.14, 0.14, 0.14, 0xffe14d, 0, 0.75); bb(0.5, 0.12, 0.12, 0x3ca64a, 0.1, 0.3); break; }
      case "doc": bb(0.8, 0.6, 0.06, 0xffffff); bb(0.5, 0.06, 0.08, 0x6b7bd0, 0, 0.12); bb(0.5, 0.06, 0.08, 0x6b7bd0, 0, -0.05); bb(0.2, 0.2, 0.08, 0xff4d4d, 0.2, -0.18); break;
      case "heart": [[-0.25, 0.2, 0.5], [0.25, 0.2, 0.5], [0, -0.05, 0.78], [0, -0.3, 0.38]].forEach(([x, y, s]) => bb(s, s, 0.4, c, x, y)); bb(0.15, 0.15, 0.45, 0xffffff, -0.3, 0.3); break;
      case "arrow": bb(0.3, 0.8, 0.3, c, 0, 0.3); { const cn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 4), pMat(c)); cn.rotation.set(Math.PI, Math.PI / 4, 0); cn.position.y = -0.3; g.add(cn); } break;
      default: { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 })); g.add(s); const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), pMat(0xffffff)); g.add(s2); bb(0.9, 0.08, 0.9, 0xffffff).rotation.y = 0.7; }
    }
    g.scale.set(def.w, def.h, def.w);
    return g;
  }

  stepProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      const foe = this.fighters[1 - p.owner];
      if (p.def.g) p.vy -= p.def.g * dt;
      if (p.def.homing && !p.ghost) { const ty = foe.y + 0.9; p.vy += clamp(ty - p.y, -3, 3) * p.def.homing * 60 * dt * 0.6; p.vy = clamp(p.vy, -6, 6); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += dt * 8;
      p.obj.position.set(p.x, p.y, 0);
      if (p.def.shape === "wave") { p.obj.scale.x = p.def.w * (1 + (1 - p.life / p.def.life) * 0.4); p.obj.rotation.y = 0; p.obj.scale.set(p.def.w, p.def.h, p.def.w); p.obj.rotation.z = p.vx < 0 ? Math.PI : 0; }
      else if (p.def.shape === "orb") { p.obj.rotation.y += dt * 4; p.obj.scale.setScalar(p.def.w * (1 + Math.sin(p.spin) * 0.08)); }
      else if (p.def.shape === "bomb") p.obj.rotation.z += dt * 6;
      else if (p.def.shape === "doc") p.obj.rotation.z = Math.sin(p.spin * 2) * 0.3 + (p.vx < 0 ? Math.PI : 0) * 0;
      if (Math.random() < 0.5) this.burst(p.x, p.y, p.def.col, 1, 1, 0.12, 0.25, 0);
      let dead = p.life <= 0 || Math.abs(p.x) > 45 || p.y < -20 || p.y > 40;
      let exploded = false;
      // terrain for gravity projectiles
      if (!dead && p.def.g) {
        for (const pl of this.plats) {
          if (p.x > pl.x - pl.w / 2 && p.x < pl.x + pl.w / 2 && p.y <= pl.y + 0.3 && p.y > pl.y - (pl.solid ? pl.th : 0.4) && p.vy < 0) { dead = true; exploded = true; break; }
        }
      }
      // hit test
      if (!dead && !p.ghost && foe.state !== "dead" && foe.state !== "respawn") {
        const hb = this.hurtBox(foe);
        const hw = p.def.w * 0.45, hh = p.def.h * 0.45;
        if (p.x + hw > hb.x0 && p.x - hw < hb.x1 && p.y + hh > hb.y0 && p.y - hh < hb.y1 && !p.hit.has(foe.slot) && !this.isInvuln(foe)) {
          p.hit.add(foe.slot);
          if (p.def.explode) { dead = true; exploded = true; }
          else {
            const att = this.fighters[p.owner];
            const d = p.def;
            this.dealHit(att, foe, { dmg: d.dmg, kb: d.kb, ks: d.ks, ang: d.ang, mv: p.mk, ult: p.mk === "ult", pid: p.pid, col: d.col, proj: true, px: p.x, dx: sgn(p.vx) || 1, multi: false });
            if (!d.pierce) dead = true;
          }
        }
      }
      if (dead) {
        if (exploded && p.def.explode) this.explodeAt(p);
        this.scene.remove(p.obj);
        this.projs.splice(i, 1);
      }
    }
  }
  explodeAt(p: Proj) {
    const R = p.def.explode!;
    this.burst(p.x, p.y, p.def.col, 24, 10, 0.25, 0.6, 4);
    this.burst(p.x, p.y, 0xffd24a, 14, 7, 0.2, 0.5, 2);
    this.ring(p.x, p.y, 0xffa02a, 0.5, R * 1.3, 0.4);
    audio.sfx("explode"); this.doShake(0.35);
    if (p.ghost) return;
    const foe = this.fighters[1 - p.owner];
    const att = this.fighters[p.owner];
    if (foe.state === "dead" || foe.state === "respawn" || this.isInvuln(foe)) return;
    const cx = foe.x, cy = foe.y + 0.8;
    if (Math.hypot(cx - p.x, cy - p.y) < R + 0.5 && !p.hit.has(-9)) {
      p.hit.add(-9);
      this.dealHit(att, foe, { dmg: p.def.dmg, kb: p.def.kb, ks: p.def.ks, ang: p.def.ang, mv: p.mk, pid: p.pid, col: p.def.col, proj: true, px: p.x, dx: sgn(foe.x - p.x) || 1, ult: false, multi: false });
    }
  }

  // ---------- hit handling ----------
  dealHit(att: Fighter, tgt: Fighter, h: HitInfo) {
    let dmg = h.dmg * this.rules.dmgMul;
    let counter = false;
    if (att.counterT > 0) { dmg *= 1.5; counter = true; att.counterT = 0; }
    const info: NetHit = { ...h, dmg, from: att.slot, ax: att.x, af: att.face, kbm: this.rules.kbMul, ctr: counter ? 1 : 0, mid: att.moveId };
    if (tgt.local) {
      const res = this.resolveHit(tgt, info);
      this.applyHitResult(att, tgt, info, res);
    } else {
      // online remote victim: send, show instant feedback
      room.send({ t: "hit", h: info });
      this.burst(tgt.x, tgt.y + 0.9, h.col, 8, 6, 0.18, 0.3, 6);
      att.freeze = Math.min(0.12, 0.03 + dmg * 0.004);
      audio.sfx(dmg > 12 ? "hit3" : dmg > 6 ? "hit2" : "hit1");
      if (h.proj && h.pid) this.removeGhost(att.slot, h.pid);
    }
    if (counter) this.banner_(tr("反擊！", "COUNTER!"), "#ffe14d");
  }
  removeGhost(owner: number, pid: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.owner === owner && p.pid === pid && !p.def.pierce) { this.scene.remove(p.obj); this.projs.splice(i, 1); }
    }
  }

  resolveHit(v: Fighter, h: NetHit): HitRes {
    const res: HitRes = { ok: false, dmg: 0, blocked: false, perfect: false, kb: 0 };
    if (v.state === "dead" || v.state === "respawn" || this.isInvuln(v)) return res;
    const attackerFront = (h.ax - v.x) * v.face >= -0.3;
    if (v.state === "block" && !h.grab && attackerFront) {
      res.ok = true; res.blocked = true;
      if (v.st < 0.16) {
        res.perfect = true; v.counterT = 1.0; v.invuln = 0.2; v.meter = Math.min(100, v.meter + 15);
        audio.sfx("perfect"); this.ring(v.x + v.face * 0.5, v.y + 1, 0xffffff, 0.3, 2.2, 0.35); this.burst(v.x + v.face * 0.6, v.y + 1, 0xffffff, 14, 8, 0.15, 0.4, 0);
        v.freeze = 0.1; this.doShake(0.25);
        if (v.slot === this.mySlot || !this.isOnline) this.banner_(tr("完美格擋！", "PERFECT BLOCK!"), "#7fe0ff");
      } else {
        v.shield -= h.dmg * 1.5 + 3;
        v.vx = sgn(v.x - h.ax) * Math.min(6, 2.5 + h.dmg * 0.3);
        audio.sfx("block"); this.burst(v.x + v.face * 0.6, v.y + 1, 0x7fe0ff, 8, 5, 0.14, 0.3, 0);
        v.freeze = 0.05;
        if (v.shield <= 0) this.shieldBreak(v);
      }
      return res;
    }
    res.ok = true;
    const dmg = h.dmg;
    v.percent = Math.min(999, v.percent + dmg);
    v.meter = Math.min(100, v.meter + dmg * 0.6);
    const kbm = (h.kbm ?? 1);
    const weight = v.def.phys.weight;
    const kb = ((h.kb + v.percent * 0.06 * h.ks) * kbm) / weight;
    const dirX = h.grab ? (h.dx ?? 1) : h.pull ? sgn(h.ax - v.x) || 1 : h.proj ? (h.dx ?? sgn(v.x - h.ax)) || 1 : sgn(v.x - h.ax) || h.af;
    const a = (h.ang * Math.PI) / 180;
    v.vx = Math.cos(a) * kb * dirX;
    v.vy = Math.sin(a) * kb;
    if (h.pull) { v.vx = dirX * Math.min(6, Math.abs(h.ax - v.x) * 4 + 1); v.vy = Math.max(0, v.vy * 0.3); }
    if (v.ground && v.vy > 1.5) { v.ground = false; v.y += 0.05; }
    if (v.ground && v.vy <= 1.5) v.vy = 0;
    if (h.grab && h.snapX !== undefined) v.x = h.snapX;
    const stun = clamp(0.12 + kb * 0.021, 0.14, 1.15) * (h.multi ? 0.6 : 1);
    if (v.state === "attack") { v.move = null; }
    v.state = h.grab ? "grabbed" : "hit"; v.stunT = stun; v.st = 0; v.usedUp = false; v.hitTime = this.time;
    v.spinV = kb > 13 ? 10 * -dirX : 0; v.spin = 0;
    v.lastHitBy = h.from; v.lastHitT = this.time;
    v.freeze = Math.min(h.ult ? 0.2 : 0.17, 0.035 + dmg * 0.0055);
    v.flash = 0.15;
    v.face = v.face; // keep
    // effects
    const strong = kb > 14;
    audio.sfx(strong ? "hit3" : kb > 9 ? "hit2" : "hit1");
    audio.voice(v.charId, "hurt");
    this.burst(v.x, v.y + 0.9, h.col, strong ? 22 : 12, strong ? 12 : 8, 0.2, 0.45, 8);
    this.burst(v.x, v.y + 0.9, 0xffffff, 6, 6, 0.14, 0.3, 4);
    this.ring(v.x, v.y + 0.9, 0xffffff, 0.3, strong ? 3 : 1.8, 0.25);
    this.doShake(clamp(kb * 0.03, 0.1, 0.8));
    res.dmg = dmg; res.kb = kb;
    // training info
    if (this.cfg.mode === "training" && v.slot === 1) {
      const T = this.train;
      T.combo = v.hitTime && this.time - (T as unknown as { lh?: number }).lh! < stunWindow() ? T.combo + 1 : 1;
      (T as unknown as { lh: number }).lh = this.time;
      T.maxCombo = Math.max(T.maxCombo, T.combo); T.total = T.combo > 1 ? T.total + dmg : dmg;
      T.lastDmg = dmg; T.lastKb = kb; T.lastAng = h.ang; T.lastStun = stun;
      const mvDef = this.fighters[0].def.moves[h.mv];
      T.move = mvDef ? tr(mvDef.name, mvDef.en) : h.mv;
    }
    if (h.pid && this.isOnline) this.removeGhost(h.from, h.pid);
    return res;
  }
  applyHitResult(att: Fighter, tgt: Fighter, h: NetHit, res: HitRes) {
    if (!res.ok) return;
    att.dmg += res.dmg;
    if (res.blocked) {
      att.freeze = 0.08;
      if (res.perfect) { // stagger attacker
        att.state = "stun"; att.stunT = 0.7; att.vx = sgn(att.x - tgt.x) * 5; att.move = null; att.freeze = 0.12;
      }
      return;
    }
    att.meter = Math.min(100, att.meter + res.dmg * 0.9);
    att.freeze = Math.min(0.17, 0.035 + res.dmg * 0.0055);
    if (h.ult) att.freeze = 0.02;
    if (h.mv === "ult" && h.multi) { att.freeze = 0.02; tgt.freeze = 0.02; }
  }

  // ---------- KO / respawn / hazards ----------
  checkKO(f: Fighter) {
    const m = this.arena.meta;
    if (f.state === "dead") return;
    if (f.x < -m.blastX || f.x > m.blastX || f.y < -m.blastY || f.y > m.topY) this.knockOut(f);
  }
  knockOut(f: Fighter) {
    const m = this.arena.meta;
    const px = clamp(f.x, -m.blastX, m.blastX), py = clamp(f.y, -m.blastY, m.topY);
    const by = f.lastHitBy >= 0 && this.time - f.lastHitT < 7 ? f.lastHitBy : -1;
    this.koFx(px, py, f.charId);
    f.state = "dead"; f.respT = 1.3; f.st = 0; f.falls++;
    f.vx = f.vy = 0; f.move = null;
    if (this.cfg.mode !== "training") f.lives--;
    f.percent = 0; f.spin = 0;
    if (by >= 0 && by !== f.slot) this.fighters[by].kos++;
    if (f.lives <= 0 && this.cfg.mode !== "training") f.out = true;
    f.x = 0; f.y = 40;
    if (this.isOnline) room.send({ t: "ko", s: f.slot, by, lv: f.lives, x: r2(px), y: r2(py), c: f.charId });
    if (f.out) f.respT = 99;
    if (this.cfg.mode === "training") { f.respT = 0.9; this.train.combo = 0; }
  }
  koFx(px: number, py: number, cid: number) {
    audio.sfx("ko"); audio.voice(cid, "hurt");
    this.burst(px, py, 0xffffff, 36, 18, 0.3, 0.9, 0);
    this.burst(px, py, 0xffd24a, 24, 14, 0.25, 0.8, 0);
    this.ring(px, py, 0xffffff, 0.5, 8, 0.6);
    this.doShake(1.0); this.zoomPulse = 0.6; this.flashScreen(0.35, 0xffffff);
    this.banner_("KO!", "#ff6a6a");
  }
  respawn(f: Fighter) {
    f.state = "respawn"; f.st = 0; f.invuln = 3.2;
    f.x = f.slot === 0 ? -3 : 3; f.y = this.arena.meta.spawn + 5; f.vx = f.vy = 0; f.shield = 100; f.jumps = 0; f.usedUp = false;
    f.face = f.slot === 0 ? 1 : -1; f.yaw = f.face * (Math.PI / 2 - 0.45);
    audio.sfx("respawn");
    this.ring(f.x, f.y, 0x9be7ff, 0.5, 4, 0.5);
  }
  checkHazards(f: Fighter) {
    if (f.hazCd > 0 || this.isInvuln(f)) return;
    const hz = this.arena.rt.hazards(this.elapsed, this.rules.hazards);
    for (const h of hz) {
      if (h.phase !== "fire") continue;
      if (Math.abs(f.x - h.x) < h.w / 2 + HW && f.y < h.y1 && f.y + HH > h.y0) {
        f.hazCd = 1.0;
        const res = this.resolveHit(f, { dmg: h.dmg, kb: 10, ks: 0.9, ang: 80, ax: h.x, af: 1, kbm: this.rules.kbMul, from: -1, mv: "hazard", col: 0xff7a1a, grab: false, pull: false, ult: false, ctr: 0, mid: 0, multi: false });
        if (res.ok && !res.blocked) { this.burst(f.x, f.y + 1, 0xff7a1a, 20, 9, 0.22, 0.5, 4); f.lastHitBy = -1; }
        if (res.ok && res.blocked) f.vy = 6;
      }
    }
  }

  // ---------- end of match ----------
  checkEnd() {
    if (this.cfg.mode === "training") return;
    if (this.isOnline && room.role !== "host") return;
    const [a, b] = this.fighters;
    if (a.out || b.out) {
      // wait for KO fx beat
      if (a.out && b.out) return this.finish(-1, "ko", true);
      return this.finish(a.out ? 1 : 0, "ko", true);
    }
    if (this.rules.time > 0 && this.elapsed >= this.rules.time * 60) {
      if (a.lives !== b.lives) return this.finish(a.lives > b.lives ? 0 : 1, "time", true);
      if (Math.abs(a.percent - b.percent) > 0.5) return this.finish(a.percent < b.percent ? 0 : 1, "time", true);
      this.finish(-1, "time", true);
    }
  }
  buildResult(winner: number, reason: MatchResult["reason"]): MatchResult {
    return {
      mode: this.cfg.mode, winner, reason, dur: Math.round(this.elapsed), localSlot: this.mySlot, arena: this.cfg.arena,
      players: this.fighters.map((f) => ({ slot: f.slot, charId: f.charId, name: f.name, avatar: f.avatar, dmg: Math.round(f.dmg), kos: f.kos, falls: f.falls, lives: Math.max(0, f.lives), percent: Math.round(f.percent) })),
    };
  }
  finish(winner: number, reason: MatchResult["reason"], broadcast: boolean, preset?: MatchResult) {
    if (this.phase === "ended") return;
    const res = preset || this.buildResult(winner, reason);
    if (preset) res.localSlot = this.mySlot;
    this.phase = "ended";
    this.result = res;
    this.resultT = reason === "aborted" ? 0.3 : 3.4;
    this.fighters.forEach((f, i) => {
      f.poseOverride = res.winner === i ? "win" : res.winner < 0 ? "" : "lose";
      f.state = f.state === "dead" ? "dead" : f.state;
    });
    if (reason !== "aborted") {
      const mine = res.winner === this.mySlot;
      audio.stopMusic();
      audio.sfx(res.winner < 0 ? "lose" : mine ? "win" : "lose");
      if (res.winner >= 0) audio.voice(this.fighters[res.winner].charId, "win");
      this.banner_(res.winner < 0 ? tr("時間到！平手", "TIME! DRAW") : reason === "time" ? tr("時間到！", "TIME UP!") : tr("遊戲結束！", "GAME SET!"), "#ffe14d");
      this.zoomPulse = 0.5;
    }
    if (broadcast && this.isOnline && reason !== "aborted") room.send({ t: "end", res });
  }

  // ---------- training helpers ----------
  resetTraining(full: boolean) {
    const [a, b] = this.fighters;
    a.x = -3.2; b.x = 3.2; a.y = b.y = 0; a.vx = a.vy = b.vx = b.vy = 0; a.state = b.state = "idle"; a.move = b.move = null;
    a.face = 1; b.face = -1; a.stunT = b.stunT = 0; a.invuln = b.invuln = 0.3;
    if (full) { a.percent = b.percent = 0; this.train.combo = 0; this.train.maxCombo = 0; this.train.lastDmg = 0; this.train.lastKb = 0; this.train.total = 0; }
    this.projs.forEach((p) => this.scene.remove(p.obj)); this.projs = [];
    a.shield = b.shield = 100;
  }
  setDummy(mode: string) {
    const d = this.fighters[1];
    this.train.dummy = mode;
    if (mode === "cpu") { d.dummyMode = ""; d.cpuLevel = 2; this.ais[1] = new AI(2); }
    else { d.dummyMode = mode; d.cpuLevel = -1; this.ais[1] = new AI(2); }
  }
  setTrainPercent(p: number) { this.fighters[1].percent = p; }
  fillMeter() { this.fighters.forEach((f) => (f.meter = 100)); }

  // ---------- online: snapshots & messages ----------
  sendSnap(force: boolean) {
    const f = this.fighters[this.mySlot];
    void force;
    room.send({
      t: "snap", x: r2(f.x), y: r2(f.y), vx: r2(f.vx), vy: r2(f.vy), f: f.face, s: f.state, m: f.move?.key || "", mt: Math.round(f.mt * 1000) / 1000,
      pc: Math.round(f.percent * 10) / 10, lv: f.lives, me: Math.round(f.meter), iv: this.isInvuln(f) ? 1 : 0, sh: Math.round(f.shield), g: f.ground ? 1 : 0, sp: r2(f.spin), fl: f.flash > 0 ? 1 : 0, ct: f.counterT > 0 ? 1 : 0,
    });
  }
  onSnap(m: Record<string, number | string>) {
    const r = this.fighters[1 - this.mySlot];
    if (!r || r.local) return;
    const st = m.s as FState;
    const mk = m.m as string;
    r.tx = m.x as number; r.ty = m.y as number; r.vx = m.vx as number; r.vy = m.vy as number; r.face = m.f as number;
    if (Math.hypot(r.x - r.tx, r.y - r.ty) > 4 || r.state === "dead") { r.x = r.tx; r.y = r.ty; }
    r.percent = m.pc as number; r.lives = m.lv as number; r.meter = m.me as number; r.remoteInv = m.iv === 1; r.shield = m.sh as number; r.ground = m.g === 1; r.spin = m.sp as number;
    if (m.fl === 1) r.flash = 0.1;
    r.counterT = m.ct === 1 ? 1 : 0;
    r.out = r.lives <= 0 && this.cfg.mode !== "training";
    // event detection
    if (st === "attack" && mk && r.def.moves[mk]) {
      const mt = m.mt as number;
      if (r.state !== "attack" || mk !== r.lastMoveKey || mt < r.lastMt - 0.02) {
        const mv = r.def.moves[mk];
        r.move = mv; r.moveId = this.moveSeq++;
        audio.sfx(mv.sfx); if (Math.random() < 0.5) audio.voice(r.charId, "atk");
        if (mv.ult) { audio.sfx("ult"); this.flashScreen(0.6, mv.col); this.zoomPulse = 1; this.banner_(r.name + "：" + tr(mv.name, mv.en), "#" + mv.col.toString(16).padStart(6, "0")); }
      }
      r.move = r.def.moves[mk]; r.mt = mt; r.lastMt = mt; r.lastMoveKey = mk;
    } else if (st !== "attack") { r.move = null; r.lastMoveKey = ""; r.lastMt = 0; }
    if (st === "dodge" && r.state !== "dodge") audio.sfx("dodge");
    if (r.state !== st) r.st = 0;
    r.state = st;
  }
  stepPuppet(r: Fighter, dt: number) {
    r.st += dt;
    if (r.state === "attack" && r.move) r.mt += dt;
    r.tx += r.vx * dt; r.ty += r.vy * dt;
    const k = Math.min(1, dt * 16);
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k;
    if (this.phase === "ended" && r.poseOverride === "") r.state = r.state;
  }
  onNetHit(m: { h: NetHit }) {
    const me = this.fighters[this.mySlot];
    if (this.phase === "ended") return;
    const res = this.resolveHit(me, m.h);
    // stats credit (victim side tracks attacker's damage too)
    const att = this.fighters[m.h.from];
    if (att && res.ok && !res.blocked) att.dmg += res.dmg;
    if (m.h.ctr && res.ok) this.banner_(tr("反擊！", "COUNTER!"), "#ffe14d");
    room.send({ t: "hr", ok: res.ok ? 1 : 0, d: r2(res.dmg), b: res.blocked ? 1 : 0, p: res.perfect ? 1 : 0, ult: m.h.ult ? 1 : 0, multi: m.h.multi ? 1 : 0 });
  }
  onNetHitResult(m: Record<string, number>) {
    const att = this.fighters[this.mySlot];
    if (!m.ok) return;
    if (m.b) {
      att.freeze = 0.08;
      if (m.p) { att.state = "stun"; att.stunT = 0.7; att.vx = -att.face * 5; att.move = null; att.freeze = 0.12; }
      return;
    }
    att.dmg += m.d;
    att.meter = Math.min(100, att.meter + m.d * 0.9);
    att.freeze = m.ult ? 0.02 : Math.min(0.17, 0.035 + m.d * 0.0055);
  }
  onNetProj(m: Record<string, number | string>) {
    this.spawnProj(m.s as number, m.c as number, m.k as string, m.x as number, m.y as number, m.vx as number, m.vy as number, m.b === 1, true, m.p as number);
  }
  onNetKo(m: Record<string, number>) {
    const r = this.fighters[m.s];
    if (!r || r.local) return;
    r.lives = m.lv; r.falls++; r.state = "dead"; r.x = r.tx = 0; r.y = r.ty = 40;
    if (m.by >= 0 && m.by !== m.s) this.fighters[m.by].kos++;
    r.out = r.lives <= 0;
    this.koFx(m.x, m.y, m.c);
  }
  onNetEnd(m: { res: MatchResult }) {
    if (room.role === "host") return;
    this.finish(m.res.winner, m.res.reason, false, { ...m.res, localSlot: this.mySlot });
  }
  onNetFx(m: Record<string, number | string>) {
    if (m.k === "ult") {
      const r = this.fighters[m.s as number];
      if (r && !r.local) { this.flashScreen(0.6, r.def.moves.ult.col); this.zoomPulse = 1; }
    }
  }

  // ---------- rendering ----------
  render(dt: number) {
    const m = this.arena.meta;
    const act = this.fighters.filter((f) => f.state !== "dead" || f.y < 30);
    let cx = 0, cy = 2, spanX = 8, spanY = 4;
    const live = this.fighters.filter((f) => f.state !== "dead");
    if (live.length) {
      const xs = live.map((f) => clamp(f.x, -m.blastX, m.blastX)), ys = live.map((f) => clamp(f.y, -m.blastY + 4, m.topY - 6));
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      cx = (minX + maxX) / 2; cy = (minY + maxY) / 2 + 1.5; spanX = maxX - minX; spanY = maxY - minY;
    }
    void act;
    const aspect = this.camera.aspect;
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    let z = Math.max((spanX + 12) / (2 * t * aspect), (spanY + 8) / (2 * t), 14);
    z = Math.min(z, 50) - this.zoomPulse * 3.5;
    if (this.phase === "count") z += this.cd * 3;
    cx = clamp(cx, -14, 14); cy = clamp(cy, -1, 11);
    const k = Math.min(1, dt * 4);
    this.camX += (cx - this.camX) * k; this.camY += (cy - this.camY) * k; this.camZ += (z - this.camZ) * Math.min(1, dt * 3);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camX + sx, this.camY + 3.2 + sy, this.camZ);
    this.camera.lookAt(this.camX, this.camY + 0.6, 0);
    // flash
    this.stageGlow *= Math.pow(0.02, dt);
    (this.flashEl.material as THREE.MeshBasicMaterial).opacity = this.stageGlow * 0.55;
    // fighters
    const timeNow = this.time;
    for (const f of this.fighters) this.renderFighter(f, dt, timeNow);
    // fx
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const p = 1 - r.life / r.max;
      r.m.scale.setScalar(r.s0 + (r.s1 - r.s0) * (1 - Math.pow(1 - p, 2)));
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - p));
      if (r.life <= 0) { this.scene.remove(r.m); (r.m.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
    }
    this.renderer.render(this.scene, this.camera);
    if (this.paused) return;
    // particles are stepped in sim; render-only extras here
  }

  stepParts(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.rot * dt; p.m.rotation.y += p.rot * dt;
      p.m.scale.setScalar(Math.max(0.001, p.s0 * (p.life / p.max)));
      if (p.life <= 0) { this.scene.remove(p.m); this.parts.splice(i, 1); }
    }
  }

  renderFighter(f: Fighter, dt: number, T: number) {
    const rig = f.rig;
    const hidden = f.state === "dead";
    rig.root.visible = !hidden && !(f.invuln > 0 && f.state !== "respawn" && Math.floor(T * 20) % 2 === 0 && f.invuln < 2.0 && f.local && f.state !== "dodge" && f.invuln > 0.35);
    f.tag.visible = !hidden; f.shadow.visible = !hidden;
    f.pedestal.visible = f.state === "respawn";
    if (hidden) { f.viz.visible = false; f.vizS.visible = false; f.shield3d.visible = false; return; }
    // yaw
    const target = f.face * (Math.PI / 2 - 0.45);
    f.yaw += (target - f.yaw) * Math.min(1, dt * 18);
    rig.root.position.set(f.x, f.y, 0);
    rig.root.rotation.y = f.yaw;
    // pose
    let state: string = f.state;
    const mv = f.move;
    const p: { anim?: string; phase?: "st" | "ac" | "rc"; p?: number } = {};
    if (f.state === "attack" && mv) {
      const t = f.mt;
      const tot = mv.st + mv.ac + mv.rc;
      if (t < mv.st) { p.phase = "st"; p.p = mv.st > 0 ? t / mv.st : 1; }
      else if (t < mv.st + mv.ac) { p.phase = "ac"; p.p = (t - mv.st) / mv.ac; }
      else { p.phase = "rc"; p.p = clamp((t - mv.st - mv.ac) / Math.max(0.01, tot - mv.st - mv.ac), 0, 1); }
      p.anim = mv.anim;
      if (mv.ult && p.phase === "st") state = "ult";
    }
    if (f.poseOverride) state = f.poseOverride;
    else if (f.state === "idle" || f.state === "run") state = Math.abs(f.vx) > 1 && f.ground ? "run" : "idle";
    applyPose(rig, { state, t: f.st, time: f.time, vx: f.vx, vy: f.vy, onGround: f.ground, anim: p.anim, phase: p.phase, p: p.p, speedRatio: Math.abs(f.vx) / f.def.phys.speed, spin: f.spin });
    if (f.state === "respawn") rig.all.position.y += Math.sin(T * 4) * 0.05;
    // flash
    const em = f.flash > 0 ? 0.8 : f.counterT > 0 ? 0.35 : 0;
    for (const m of rig.mats) m.emissive.setScalar(em);
    // tag
    f.tag.position.set(f.x, f.y + 2.95, 0.5);
    // shadow
    let top = -50;
    for (const pl of this.plats) if (f.x > pl.x - pl.w / 2 && f.x < pl.x + pl.w / 2 && pl.y <= f.y + 0.1 && pl.y > top) top = pl.y;
    if (top > -50) {
      f.shadow.visible = true; f.shadow.position.set(f.x, top + 0.02, 0.2);
      const hgt = f.y - top;
      f.shadow.scale.setScalar(Math.max(0.3, 1 - hgt * 0.07));
      (f.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.08, 0.32 - hgt * 0.02);
    } else f.shadow.visible = false;
    // pedestal
    if (f.state === "respawn") f.pedestal.position.set(f.x, f.y - 0.12, 0);
    // shield bubble
    const blocking = f.state === "block";
    f.shield3d.visible = blocking;
    if (blocking) {
      f.shield3d.position.set(f.x, f.y + 0.9, 0.2);
      f.shield3d.scale.setScalar(0.5 + (f.shield / 100) * 0.55);
      (f.shield3d.material as THREE.MeshBasicMaterial).opacity = f.st < 0.16 ? 0.6 : 0.28;
    }
    // hit viz
    const act = f.state === "attack" && mv && f.mt >= mv.st && f.mt < mv.st + mv.ac && mv.hb[2] > 0 && mv.fx !== "none";
    f.viz.visible = false; f.vizS.visible = false;
    if (act && mv) {
      const [cx, cy, w, h] = mv.hb;
      const x = f.x + f.face * cx, y = f.y + cy;
      const pr = (f.mt - mv.st) / mv.ac;
      if (mv.fx === "nova" || mv.fx === "vortex") {
        f.vizS.visible = true; f.vizS.position.set(x, y, 0);
        const s = (mv.fx === "nova" ? 0.4 + pr * 0.6 : 0.8 + Math.sin(T * 12) * 0.05) * w;
        f.vizS.scale.set(s, s * (h / w), s);
        (f.vizS.material as THREE.MeshBasicMaterial).color.setHex(mv.col);
        (f.vizS.material as THREE.MeshBasicMaterial).opacity = mv.fx === "nova" ? 0.45 * (1 - pr * 0.5) : 0.28;
        f.vizS.rotation.y = T * 6;
      } else {
        f.viz.visible = true; f.viz.position.set(x, y, 0.2);
        const beam = mv.fx === "beam";
        f.viz.scale.set(w * (beam ? 0.6 + pr * 0.4 : 0.85), h * (beam ? 0.8 + Math.sin(T * 40) * 0.2 : 0.85), 1.2);
        const mat = f.viz.material as THREE.MeshBasicMaterial;
        mat.color.setHex(mv.col); mat.opacity = beam ? 0.6 : 0.3 * (1 - pr * 0.6);
      }
    }
    // remote ult aura particles
    if (f.state === "attack" && mv?.ult && Math.random() < 0.5) this.burst(f.x, f.y + 0.9, mv.col, 1, 6, 0.16, 0.4, -4);
  }
}

interface HitInfo {
  dmg: number; kb: number; ks: number; ang: number; mv: string; col: number; ult?: boolean; pull?: boolean; grab?: boolean; dx?: number; snapX?: number;
  fin?: boolean; multi?: boolean; proj?: boolean; pid?: number; px?: number;
}
interface NetHit extends HitInfo { from: number; ax: number; af: number; kbm: number; ctr: number; mid: number }
interface HitRes { ok: boolean; dmg: number; blocked: boolean; perfect: boolean; kb: number }
const stunWindow = () => 1.5;
