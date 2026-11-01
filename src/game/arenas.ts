// Three original voxel-style arenas: visuals + deterministic platform/hazard layouts
import * as THREE from "three";

export interface Plat { x: number; y: number; w: number; solid: boolean; th: number }
export interface HazardState { x: number; w: number; y0: number; y1: number; phase: "warn" | "fire"; dmg: number }
export interface ArenaRT {
  group: THREE.Group; bg: number; fog: [number, number, number];
  plats(t: number): Plat[];
  hazards(t: number, enabled: boolean): HazardState[];
  update(t: number, dt: number): void;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lam = new Map<number, THREE.MeshLambertMaterial>();
const bas = new Map<number, THREE.MeshBasicMaterial>();
const L = (c: number) => {
  let m = lam.get(c);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); lam.set(c, m); }
  return m;
};
const Bm = (c: number) => {
  let m = bas.get(c);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); bas.set(c, m); }
  return m;
};
function box(p: THREE.Object3D, w: number, h: number, d: number, c: number, x: number, y: number, z: number, basic = false) {
  const m = new THREE.Mesh(BOX, basic ? Bm(c) : L(c));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function mesh(p: THREE.Object3D, g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function skyDome(top: number, bot: number) {
  const g = new THREE.SphereGeometry(120, 16, 12);
  const col: number[] = [];
  const pos = g.attributes.position;
  const ct = new THREE.Color(top), cb = new THREE.Color(bot);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 120;
    const c = cb.clone().lerp(ct, Math.min(1, Math.max(0, (y + 0.15) * 1.3)));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}
function lights(g: THREE.Group, sky: number, ground: number, sun: number, int: number) {
  g.add(new THREE.HemisphereLight(sky, ground, 1.1));
  const d = new THREE.DirectionalLight(sun, int);
  d.position.set(-8, 16, 14);
  g.add(d);
}
function textTex(text: string, color: string, bg: string, w = 256, h = 96, font = 64) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.font = `bold ${font}px "Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif`;
  x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = color; x.shadowBlur = 14;
  x.fillStyle = color;
  x.fillText(text, w / 2, h / 2 + 4);
  x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ---------- Arena 0: Rainbow Marshmallow Isle ----------
function arena0(): ArenaRT {
  const g = new THREE.Group();
  g.add(skyDome(0x6fc8ff, 0xffd6f2));
  lights(g, 0xffffff, 0xffc9e8, 0xfff2cf, 1.0);
  // cake island
  box(g, 18, 0.5, 6, 0xff9ad0, 0, -0.25, 0);
  for (let i = -8; i <= 8; i += 2) box(g, 0.9, 0.5, 6.1, i % 4 === 0 ? 0xffffff : 0xffb3df, i, -0.5, 0);
  box(g, 17, 1.4, 5.6, 0xfff0d2, 0, -1.2, 0);
  box(g, 16, 1.2, 5.2, 0xff7a96, 0, -2.5, 0);
  box(g, 15, 1.0, 4.8, 0xfff0d2, 0, -3.6, 0);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(8, 7, 4), L(0x8b5a3a));
  cone.rotation.set(Math.PI, Math.PI / 4, 0); cone.position.set(0, -8.1, 0); cone.scale.set(1, 1, 0.7); g.add(cone);
  // decor on island
  for (const x of [-7.5, 7.5]) {
    box(g, 0.7, 0.7, 0.7, 0xff3b5c, x, 0.35, -2.2);
    box(g, 0.2, 0.4, 0.2, 0x3ca64a, x, 0.85, -2.2);
  }
  for (const [x, c] of [[-5, 0xff6fa5], [5.5, 0x6fd3ff], [-2, 0xffe36f]] as [number, number][]) {
    mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), L(0xffffff), x, 0.9, -2.6);
    mesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.18, 10), L(c), x, 1.9, -2.6).rotation.x = Math.PI / 2;
  }
  // soft platforms (cloud candy)
  const platDefs = [[-6.5, 4.2, 4.8], [6.5, 4.2, 4.8], [0, 8.2, 4.2]];
  for (const [x, y, w] of platDefs) {
    box(g, w, 0.35, 2.6, 0xffffff, x, y - 0.18, 0);
    box(g, w - 0.4, 0.3, 2.4, 0xffc4e8, x, y - 0.48, 0);
    box(g, 1.1, 0.5, 1.4, 0xffffff, x - w / 2 + 0.5, y + 0.0, -0.2);
    box(g, 1.3, 0.6, 1.5, 0xffffff, x + w / 2 - 0.6, y + 0.05, -0.2);
  }
  // rainbow
  const cols = [0xff5d5d, 0xffa14d, 0xffe85d, 0x6fe07a, 0x5dc4ff, 0xa48bff];
  cols.forEach((c, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 1.3, 0.7, 4, 28, Math.PI), Bm(c));
    t.position.set(0, -6, -34); g.add(t);
  });
  // donuts + clouds
  const donuts: THREE.Mesh[] = [];
  [[-17, 6, -10, 0xff8fb8], [16, 10, -12, 0xffd36f], [-22, -2, -14, 0x8fe0ff], [24, 2, -9, 0xd6a0ff]].forEach(([x, y, z, c]) => {
    const d = new THREE.Mesh(new THREE.TorusGeometry(2, 0.8, 6, 10), L(c));
    d.position.set(x, y, z); donuts.push(d); g.add(d);
  });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    box(c, 5, 1.2, 2, 0xffffff, 0, 0, 0); box(c, 3, 1.2, 2, 0xffffff, 1.2, 0.8, 0); box(c, 3, 1, 2, 0xfff0fa, -1.4, 0.5, 0);
    c.position.set(-40 + i * 10, -4 + (i * 7) % 16, -18 - (i % 3) * 5);
    clouds.push(c); g.add(c);
  }
  return {
    group: g, bg: 0xbfe6ff, fog: [0xd8efff, 60, 130],
    plats: () => [
      { x: 0, y: 0, w: 18, solid: true, th: 4 },
      { x: -6.5, y: 4.2, w: 4.8, solid: false, th: 0.3 }, { x: 6.5, y: 4.2, w: 4.8, solid: false, th: 0.3 }, { x: 0, y: 8.2, w: 4.2, solid: false, th: 0.3 },
    ],
    hazards: () => [],
    update: (t, dt) => {
      donuts.forEach((d, i) => { d.rotation.x += dt * (0.4 + i * 0.1); d.rotation.y += dt * 0.5; d.position.y += Math.sin(t + i) * dt * 0.4; });
      clouds.forEach((c, i) => { c.position.x += dt * (0.6 + (i % 3) * 0.3); if (c.position.x > 50) c.position.x = -50; });
    },
  };
}

// ---------- Arena 1: Pixel Lava Foundry ----------
const GEYSERS = [-4.2, 0, 4.2];
const GPER = 7.5;
function gPhase(i: number, t: number): "off" | "warn" | "fire" {
  const c = (t + i * 2.5 + 3) % GPER;
  if (c >= 4.7 && c < 5.8) return "warn";
  if (c >= 5.8 && c < 6.8) return "fire";
  return "off";
}
function arena1(): ArenaRT {
  const g = new THREE.Group();
  g.add(skyDome(0x2a0a1a, 0xff6a2a));
  lights(g, 0xffd2b0, 0x8a2a10, 0xffb070, 0.9);
  // main platform
  box(g, 13, 0.5, 6, 0x5b6270, 0, -0.25, 0);
  for (let i = -6; i <= 6; i += 1.5) box(g, 0.75, 0.52, 6.05, Math.round(i / 1.5) % 2 ? 0xffc21a : 0x20232a, i, -0.25, 0);
  box(g, 12, 1.4, 5.5, 0x454b57, 0, -1.2, 0);
  box(g, 10.5, 1.6, 5, 0x363b46, 0, -2.7, 0);
  box(g, 7, 2.2, 4.4, 0x2b2f38, 0, -4.6, 0);
  for (let i = 0; i < 6; i++) box(g, 0.22, 0.22, 0.1, 0x9aa3b5, -5 + i * 2, -1.2, 2.78);
  // geyser nozzles + fire columns
  const warns: THREE.Mesh[] = [], fires: THREE.Mesh[] = [];
  GEYSERS.forEach((x) => {
    box(g, 1.1, 0.3, 1.1, 0x20232a, x, 0.15, 0);
    const w = box(g, 1.7, 7, 1.7, 0xff3b1a, x, 3.6, 0, true);
    w.material = new THREE.MeshBasicMaterial({ color: 0xff3b1a, transparent: true, opacity: 0.0 });
    warns.push(w);
    const f = box(g, 1.7, 7, 1.7, 0xffb02a, x, 3.6, 0, true);
    f.material = new THREE.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.9 });
    f.visible = false;
    fires.push(f);
  });
  // soft platforms (steel catwalks)
  const softs: [number, number, number][] = [[-5.5, 3.8, 3.6], [5.5, 3.8, 3.6]];
  const mk = (x: number, y: number, w: number) => {
    const p = new THREE.Group();
    box(p, w, 0.3, 2.4, 0x7d8696, 0, -0.15, 0);
    box(p, w, 0.12, 2.5, 0xffc21a, 0, -0.02, 0);
    box(p, 0.2, 1.2, 0.2, 0x4a505c, -w / 2 + 0.3, -0.9, 0); box(p, 0.2, 1.2, 0.2, 0x4a505c, w / 2 - 0.3, -0.9, 0);
    p.position.set(x, y, 0); g.add(p);
    return p;
  };
  softs.forEach(([x, y, w]) => mk(x, y, w));
  const mover = mk(0, 7.8, 3.6);
  // lava
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(220, 120), new THREE.MeshBasicMaterial({ color: 0xff5a1a }));
  lava.rotation.x = -Math.PI / 2; lava.position.set(0, -11, -20); g.add(lava);
  const glow = new THREE.PointLight(0xff6a1a, 2.5, 60); glow.position.set(0, -6, 6); g.add(glow);
  // background gears, stacks
  const gears: THREE.Mesh[] = [];
  [[-18, 8, -14, 6, 0x4a505c], [20, 14, -18, 8, 0x5b6270], [-6, 20, -26, 9, 0x3a3f4a], [30, -2, -12, 5, 0x4a505c]].forEach(([x, y, z, r, c]) => {
    const m = mesh(g, new THREE.CylinderGeometry(r, r, 1.2, 8), L(c), x, y, z);
    m.rotation.x = Math.PI / 2; gears.push(m);
    mesh(g, new THREE.CylinderGeometry(r * 0.35, r * 0.35, 1.5, 6), L(0xffc21a), x, y, z).rotation.x = Math.PI / 2;
  });
  [[-26, -2], [26, 4], [-34, 6]].forEach(([x, h]) => { box(g, 4, 22 + h, 4, 0x2c2f38, x, 0 + h / 2, -20); box(g, 4.4, 1, 4.4, 0xff6a2a, x, 11 + h, -20, true); });
  // embers
  const embers: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const e = box(g, 0.14, 0.14, 0.14, 0xffa02a, (Math.random() - 0.5) * 70, -10 + Math.random() * 30, -4 - Math.random() * 14, true);
    embers.push(e);
  }
  return {
    group: g, bg: 0x3a0f1c, fog: [0x7a2a1a, 50, 120],
    plats: (t) => [
      { x: 0, y: 0, w: 13, solid: true, th: 4 },
      { x: -5.5, y: 3.8, w: 3.6, solid: false, th: 0.3 }, { x: 5.5, y: 3.8, w: 3.6, solid: false, th: 0.3 },
      { x: 4.2 * Math.sin(t * 0.5), y: 7.8, w: 3.6, solid: false, th: 0.3 },
    ],
    hazards: (t, en) => {
      if (!en) return [];
      const out: HazardState[] = [];
      GEYSERS.forEach((x, i) => { const p = gPhase(i, t); if (p !== "off") out.push({ x, w: 1.6, y0: 0, y1: 7, phase: p, dmg: 11 }); });
      return out;
    },
    update: (t, dt) => {
      mover.position.x = 4.2 * Math.sin(t * 0.5);
      gears.forEach((m, i) => (m.rotation.y += dt * (i % 2 ? -0.4 : 0.4)));
      (lava.material as THREE.MeshBasicMaterial).color.setHSL(0.04 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.04);
      embers.forEach((e) => { e.position.y += dt * 2; if (e.position.y > 22) e.position.y = -10; });
      GEYSERS.forEach((_, i) => {
        const p = gPhase(i, t);
        (warns[i].material as THREE.MeshBasicMaterial).opacity = p === "warn" ? 0.12 + 0.18 * (Math.sin(t * 22) > 0 ? 1 : 0) : 0;
        fires[i].visible = p === "fire";
        if (p === "fire") fires[i].scale.x = fires[i].scale.z = 1.5 + Math.sin(t * 40) * 0.2;
      });
    },
  };
}

// ---------- Arena 2: Neon Night Market Rooftop ----------
function arena2(): ArenaRT {
  const g = new THREE.Group();
  g.add(skyDome(0x1a0b3d, 0xff4fa0));
  lights(g, 0xcdb8ff, 0x4a2a6a, 0xffd0f0, 0.8);
  // rooftop slab
  box(g, 15, 0.5, 6, 0x6b5a7a, 0, -0.25, 0);
  box(g, 15.4, 0.3, 0.3, 0xff4f6a, 0, 0.1, 3.0);
  box(g, 15, 1.2, 5.6, 0x4a3b5e, 0, -1.1, 0);
  box(g, 12, 9, 5, 0x2f2540, 0, -6.2, 0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) box(g, 0.7, 0.9, 0.1, (r + c) % 3 === 0 ? 0xffd86b : 0x6a5a8a, -4.5 + c * 1.8, -2.5 - r * 1.8, 2.55, true);
  // water tank + signs on roof
  box(g, 1.6, 1.4, 1.6, 0x8a97b0, -6, 0.7, -2); box(g, 1.7, 0.2, 1.7, 0x5a6578, -6, 1.5, -2);
  const tex = (txt: string, col: string) => new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: textTex(txt, col, "#150a2a") }));
  const signs: THREE.Mesh[] = [];
  ([["夜市", "#ff4fa0", -16, 8], ["珍珠奶茶", "#5ff0ff", 14, 12], ["雞排", "#ffe45f", -2, 17], ["蚵仔煎", "#9bff6f", 22, 4], ["滷味", "#ff8a4f", -24, 15]] as [string, string, number, number][]).forEach(([t, c, x, y], i) => {
    const m = tex(t, c); m.position.set(x, y, -10 - (i % 2) * 4); g.add(m); signs.push(m);
    box(g, 5.2, 2.1, 0.3, 0x201038, x, y, -10.3 - (i % 2) * 4);
  });
  // background buildings
  for (let i = 0; i < 14; i++) {
    const h = 8 + ((i * 7) % 11) * 2;
    const x = -45 + i * 7;
    box(g, 5.5, h, 5, i % 2 ? 0x2a1e48 : 0x372757, x, h / 2 - 12, -24);
    for (let k = 0; k < h / 3; k++) box(g, 0.8, 1, 0.1, (i + k) % 3 ? 0xffd86b : 0x4a3a6a, x + ((k % 2) * 2 - 1), -10 + k * 3, -21.4, true);
  }
  // lantern string
  const lanterns: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Group();
    mesh(l, new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3b3b : 0xff8a3b }), 0, 0, 0).scale.set(1, 1.15, 1);
    box(l, 0.5, 0.15, 0.5, 0xffd24a, 0, 0.7, 0); box(l, 0.5, 0.15, 0.5, 0xffd24a, 0, -0.7, 0);
    l.position.set(-16 + i * 4, 12.5 + Math.sin(i * 1.3) * 0.6, -4);
    lanterns.push(l); g.add(l);
  }
  box(g, 40, 0.06, 0.06, 0x2a1a3a, 0, 13.4, -4);
  // soft platforms (awnings)
  const awn = (x: number, y: number, w: number) => {
    const p = new THREE.Group();
    const n = Math.round(w / 0.8);
    for (let i = 0; i < n; i++) box(p, w / n, 0.3, 2.4, i % 2 ? 0xffffff : 0xff4f6a, -w / 2 + (i + 0.5) * (w / n), -0.15, 0);
    box(p, w, 0.4, 0.1, 0xff4f6a, 0, -0.55, 1.2);
    box(p, 0.15, 1.3, 0.15, 0x6b4a2a, -w / 2 + 0.2, -0.9, -0.9); box(p, 0.15, 1.3, 0.15, 0x6b4a2a, w / 2 - 0.2, -0.9, -0.9);
    p.position.set(x, y, 0); g.add(p); return p;
  };
  awn(-7, 3.6, 4); awn(7, 3.6, 4);
  const mover = awn(0, 7.4, 4.6);
  box(mover, 0.5, 0.5, 0.5, 0xffd24a, 0, 0.3, -0.5);
  return {
    group: g, bg: 0x1a0b3d, fog: [0x2a1450, 50, 120],
    plats: (t) => [
      { x: 0, y: 0, w: 15, solid: true, th: 4 },
      { x: -7, y: 3.6, w: 4, solid: false, th: 0.3 }, { x: 7, y: 3.6, w: 4, solid: false, th: 0.3 },
      { x: 5 * Math.sin(t * 0.7), y: 7.4, w: 4.6, solid: false, th: 0.3 },
    ],
    hazards: () => [],
    update: (t) => {
      mover.position.x = 5 * Math.sin(t * 0.7);
      lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.4 + i) * 0.12; });
      signs.forEach((s, i) => { (s.material as THREE.MeshBasicMaterial).color.setScalar(0.75 + 0.25 * (Math.sin(t * 3 + i * 2) > -0.6 ? 1 : 0)); });
    },
  };
}

export function buildArena(id: number): ArenaRT {
  return [arena0, arena1, arena2][id]();
}
