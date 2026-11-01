// Voxel chibi character rigs built from boxes, plus procedural pose animation
import * as THREE from "three";

const GEO = new THREE.BoxGeometry(1, 1, 1);
export interface Rig {
  root: THREE.Group; all: THREE.Group; body: THREE.Group; head: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  extras: Record<string, THREE.Object3D>; mats: THREE.MeshLambertMaterial[]; id: number;
}
const PIV = 0.85;
type V3 = [number, number, number];
const SKIN = 0xfbd9bd;

class Builder {
  cache = new Map<number, THREE.MeshLambertMaterial>();
  mats: THREE.MeshLambertMaterial[] = [];
  m(c: number) {
    let x = this.cache.get(c);
    if (!x) {
      x = new THREE.MeshLambertMaterial({ color: c, emissive: 0x000000 });
      this.cache.set(c, x);
      this.mats.push(x);
    }
    return x;
  }
  b(parent: THREE.Object3D, size: V3, color: number, pos: V3, rot?: V3) {
    const mesh = new THREE.Mesh(GEO, this.m(color));
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(mesh);
    return mesh;
  }
  g(parent: THREE.Object3D, pos: V3) {
    const g = new THREE.Group();
    g.position.set(pos[0], pos[1], pos[2]);
    parent.add(g);
    return g;
  }
}

interface Skel {
  torso: number; torsoSize?: V3; armCol: number; handCol: number; armW?: number; handSize?: number;
  legTop: number; legBot: number; shoe: number; legW?: number; headSize?: V3; headCol: number; shoeSize?: V3; scale?: number;
}
function skeleton(B: Builder, id: number, o: Skel): Rig {
  const root = new THREE.Group();
  const all = B.g(root, [0, PIV, 0]);
  const ts = o.torsoSize || [0.7, 0.55, 0.46];
  const body = B.g(all, [0, 0.45 - PIV, 0]);
  B.b(body, ts, o.torso, [0, ts[1] / 2, 0]);
  const hs = o.headSize || [0.9, 0.82, 0.82];
  const head = B.g(body, [0, ts[1], 0]);
  B.b(head, hs, o.headCol, [0, hs[1] / 2 - 0.02, 0]);
  const aw = o.armW || 0.24;
  const mkArm = (s: number) => {
    const a = B.g(body, [s * (ts[0] / 2 + aw / 2 + 0.02), ts[1] - 0.06, 0]);
    B.b(a, [aw, 0.4, aw + 0.04], o.armCol, [0, -0.2, 0]);
    const hsz = o.handSize || aw + 0.02;
    B.b(a, [hsz, 0.2, hsz], o.handCol, [0, -0.5, 0]);
    return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const lw = o.legW || 0.26;
  const mkLeg = (s: number) => {
    const l = B.g(all, [s * 0.18, 0.45 - PIV, 0]);
    B.b(l, [lw, 0.2, lw], o.legTop, [0, -0.1, 0]);
    B.b(l, [lw, 0.13, lw], o.legBot, [0, -0.265, 0]);
    const ss = o.shoeSize || [lw + 0.06, 0.12, lw + 0.2];
    B.b(l, ss, o.shoe, [0, -0.39, 0.05]);
    return l;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  if (o.scale) root.scale.setScalar(o.scale);
  return { root, all, body, head, armL, armR, legL, legR, extras: {}, mats: B.mats, id };
}

function eyes(B: Builder, head: THREE.Object3D, z: number, y: number, sep: number, o: { w: number; h: number; iris: number; white?: number; hl?: boolean }) {
  for (const s of [-1, 1]) {
    B.b(head, [o.w, o.h, 0.03], o.white ?? 0xffffff, [s * sep, y, z]);
    B.b(head, [o.w * 0.72, o.h * 0.9, 0.035], o.iris, [s * sep, y - 0.01, z + 0.005]);
    B.b(head, [o.w * 0.3, o.h * 0.3, 0.04], 0x1a1030, [s * sep, y - 0.02, z + 0.01]);
    if (o.hl !== false) B.b(head, [o.w * 0.2, o.h * 0.2, 0.045], 0xffffff, [s * sep + o.w * 0.12, y + o.h * 0.22, z + 0.015]);
  }
}
const blush = (B: Builder, head: THREE.Object3D, z: number, y: number, sep: number, c = 0xff9aa8) => {
  for (const s of [-1, 1]) B.b(head, [0.16, 0.09, 0.03], c, [s * sep, y, z]);
};

function buildGodjj(B: Builder): Rig {
  const r = skeleton(B, 0, { torso: 0x3fb7a6, torsoSize: [0.74, 0.55, 0.5], armCol: 0x4fc7b6, armW: 0.28, handCol: SKIN, handSize: 0.22, legTop: SKIN, legBot: 0x3a3a3f, shoe: 0x2e2e33, headCol: SKIN, headSize: [0.86, 0.76, 0.8], scale: 0.95 });
  const h = r.head, bd = r.body;
  // hood
  B.b(h, [1.08, 0.32, 1.1], 0x4fd0bd, [0, 0.9, -0.08]);
  B.b(h, [1.08, 0.95, 0.34], 0x45c2b0, [0, 0.45, -0.46]);
  for (const s of [-1, 1]) B.b(h, [0.16, 0.9, 0.95], 0x47c6b3, [s * 0.52, 0.48, -0.1]);
  B.b(h, [1.0, 0.2, 0.5], 0x5ad8c5, [0, 0.76, 0.28]);
  // frog eyes on hood
  for (const s of [-1, 1]) {
    B.b(h, [0.3, 0.32, 0.22], 0xffffff, [s * 0.3, 1.14, 0.12]);
    B.b(h, [0.15, 0.2, 0.05], 0x222222, [s * 0.3, 1.13, 0.24]);
  }
  B.b(h, [0.12, 0.28, 0.12], 0x3fc9b5, [-0.05, 1.28, -0.2]);
  B.b(h, [0.16, 0.14, 0.12], 0x3fc9b5, [-0.22, 1.2, -0.2]);
  // bill
  const bill = B.b(h, [0.95, 0.1, 0.55], 0xf59b2b, [0, 0.98, 0.5], [0.06, 0, 0]);
  bill.name = "bill";
  B.b(h, [0.2, 0.04, 0.12], 0xcf7a15, [0, 1.04, 0.62]);
  // bangs
  [-0.34, -0.17, 0, 0.17, 0.34].forEach((x, i) => B.b(h, [0.19, 0.22 + (i % 2) * 0.06, 0.1], i % 2 ? 0x7a52b0 : 0x8b62c4, [x, 0.66, 0.41]));
  for (const s of [-1, 1]) {
    B.b(h, [0.14, 0.32, 0.5], 0x7b53b5, [s * 0.47, 0.4, 0.05]);
    B.b(h, [0.14, 0.2, 0.5], 0xe863a3, [s * 0.47, 0.14, 0.05]);
  }
  eyes(B, h, 0.41, 0.4, 0.2, { w: 0.2, h: 0.24, iris: 0x8e4fe0 });
  blush(B, h, 0.41, 0.2, 0.3);
  B.b(h, [0.12, 0.07, 0.03], 0xe8705f, [0, 0.14, 0.41]);
  // hoodie details
  B.b(bd, [0.42, 0.2, 0.04], 0x3aa898, [0, 0.14, 0.27]);
  for (const s of [-1, 1]) B.b(bd, [0.05, 0.24, 0.04], 0xffffff, [s * 0.1, 0.34, 0.26]);
  B.b(bd, [0.82, 0.2, 0.58], 0x3fb7a6, [0, 0.0, 0]);
  // tail prop
  const tail = B.g(r.armR, [0, -0.5, 0.15]);
  B.b(tail, [0.42, 0.12, 0.75], 0x8b5230, [0, 0, 0.3]);
  B.b(tail, [0.44, 0.04, 0.05], 0x5a3318, [0, 0.07, 0.3]);
  B.b(tail, [0.05, 0.04, 0.7], 0x5a3318, [0, 0.07, 0.3]);
  tail.rotation.x = -0.3;
  r.extras.tail = tail;
  return r;
}

function buildDingyi(B: Builder): Rig {
  const r = skeleton(B, 1, { torso: 0xf4efe4, torsoSize: [0.92, 0.6, 0.62], armCol: 0xf4efe4, armW: 0.34, handCol: 0x2b2326, handSize: 0.4, legTop: 0x2b2326, legBot: 0x2b2326, legW: 0.32, shoe: 0x2b2326, shoeSize: [0.38, 0.14, 0.46], headCol: 0x2b2326, headSize: [1.18, 0.95, 0.98], scale: 0.95 });
  const h = r.head, bd = r.body;
  // muzzle & face
  B.b(h, [0.7, 0.4, 0.22], 0xf4e3c7, [0, 0.3, 0.52]);
  B.b(h, [0.2, 0.12, 0.1], 0x1b1417, [0, 0.4, 0.66]);
  for (const s of [-1, 1]) B.b(h, [0.3, 0.32, 0.12], 0xf4e3c7, [s * 0.4, 0.28, 0.48]);
  for (const s of [-1, 1]) B.b(h, [0.15, 0.12, 0.05], 0xe0b27a, [s * 0.26, 0.68, 0.5]);
  // eyes: open (left) + wink (right)
  B.b(h, [0.22, 0.26, 0.04], 0xffffff, [-0.28, 0.5, 0.5]);
  B.b(h, [0.16, 0.22, 0.05], 0x7a3f12, [-0.27, 0.5, 0.52]);
  B.b(h, [0.07, 0.07, 0.06], 0xffffff, [-0.24, 0.57, 0.53]);
  B.b(h, [0.24, 0.05, 0.05], 0x120c0e, [0.28, 0.5, 0.51], [0, 0, -0.25]);
  B.b(h, [0.16, 0.22, 0.04], 0xff8fa0, [0.0, 0.14, 0.62]);
  B.b(h, [0.1, 0.05, 0.04], 0x120c0e, [0, 0.22, 0.6]);
  blush(B, h, 0.55, 0.3, 0.44, 0xf3a0a0);
  // ears
  for (const s of [-1, 1]) {
    B.b(h, [0.34, 0.45, 0.2], 0x2b2326, [s * 0.5, 1.08, 0.0], [0, 0, -s * 0.25]);
    B.b(h, [0.18, 0.28, 0.06], 0xf0b8a0, [s * 0.5, 1.08, 0.11], [0, 0, -s * 0.25]);
  }
  // chef hat
  const hat = B.g(h, [0, 0.95, -0.02]);
  B.b(hat, [0.85, 0.22, 0.85], 0xffffff, [0, 0.08, 0]);
  B.b(hat, [1.0, 0.55, 1.0], 0xf8f5ee, [0, 0.52, 0]);
  B.b(hat, [0.32, 0.45, 0.4], 0xeeeae0, [-0.2, 0.9, 0]);
  B.b(hat, [0.32, 0.5, 0.4], 0xf8f5ee, [0.15, 0.95, 0]);
  B.b(hat, [0.22, 0.2, 0.04], 0xc89a3c, [0, 0.12, 0.44]);
  r.extras.hat = hat;
  // scarf + medal
  B.b(bd, [0.86, 0.14, 0.66], 0x9b1c31, [0, 0.58, 0]);
  B.b(bd, [0.2, 0.3, 0.05], 0x8a1528, [0.05, 0.38, 0.33], [0, 0, 0.15]);
  B.b(bd, [0.16, 0.16, 0.05], 0xd9a93a, [0, 0.52, 0.34]);
  // jacket trims + buttons
  for (const s of [-1, 1]) B.b(bd, [0.04, 0.4, 0.04], 0xd9a93a, [s * 0.1, 0.34, 0.32]);
  for (let i = 0; i < 3; i++) B.b(bd, [0.07, 0.07, 0.05], 0xd9a93a, [-0.28, 0.45 - i * 0.12, 0.33]);
  // apron
  B.b(bd, [0.72, 0.48, 0.05], 0x2b2326, [0, 0.12, 0.33]);
  B.b(bd, [0.4, 0.2, 0.06], 0x3a3034, [0, 0.12, 0.35]);
  B.b(bd, [0.14, 0.14, 0.07], 0xd9a93a, [0, 0.12, 0.37]);
  B.b(bd, [0.06, 0.32, 0.06], 0xd9a93a, [0.3, 0.1, 0.36]);
  B.b(bd, [0.92, 0.2, 0.66], 0xf4efe4, [0, -0.02, 0]);
  // cuffs + hand tips
  for (const a of [r.armL, r.armR]) {
    B.b(a, [0.38, 0.1, 0.4], 0xffffff, [0, -0.38, 0]);
    B.b(a, [0.2, 0.1, 0.1], 0xe0b27a, [0, -0.54, 0.16]);
  }
  for (const l of [r.legL, r.legR]) B.b(l, [0.3, 0.06, 0.16], 0xd9a93a, [0, -0.41, 0.22]);
  // tail
  const tail = B.g(bd, [0, 0.12, -0.34]);
  B.b(tail, [0.3, 0.5, 0.25], 0x2b2326, [0, 0.2, -0.1], [0.5, 0, 0]);
  B.b(tail, [0.28, 0.2, 0.22], 0xe0c08e, [0, 0.45, -0.28], [0.5, 0, 0]);
  r.extras.tail = tail;
  return r;
}

function buildShizimaru(B: Builder): Rig {
  const CREAM = 0xf8e6bf, BR = 0xb87a45, BR2 = 0x9c6535;
  const r = skeleton(B, 2, { torso: CREAM, torsoSize: [0.6, 0.5, 0.44], armCol: CREAM, armW: 0.26, handCol: CREAM, handSize: 0.3, legTop: CREAM, legBot: CREAM, legW: 0.28, shoe: CREAM, headCol: CREAM, headSize: [1.12, 0.92, 0.88], scale: 0.95 });
  const h = r.head, bd = r.body;
  // mane ring
  const mane = B.g(h, [0, 0.45, -0.1]);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const sz = 0.42 + ((i * 7) % 3) * 0.06;
    B.b(mane, [sz, sz, 0.55], i % 2 ? BR : BR2, [Math.cos(a) * 0.68, Math.sin(a) * 0.62, -0.18], [0, 0, a]);
  }
  B.b(mane, [1.0, 0.4, 0.5], BR, [0, 0.05, -0.38]);
  B.b(h, [0.9, 0.3, 0.2], BR, [0.0, 0.88, 0.15]);
  B.b(h, [0.7, 0.3, 0.3], BR2, [0, -0.1, 0.0]); // chin fluff
  for (const s of [-1, 1]) {
    B.b(h, [0.34, 0.34, 0.14], CREAM, [s * 0.4, 1.0, 0.0]);
    B.b(h, [0.2, 0.2, 0.05], 0xf79aa0, [s * 0.4, 1.0, 0.08]);
  }
  // grumpy face
  B.b(h, [0.3, 0.06, 0.04], 0x5a3a22, [-0.27, 0.66, 0.45], [0, 0, 0.3]);
  B.b(h, [0.3, 0.06, 0.04], 0x5a3a22, [0.27, 0.68, 0.45], [0, 0, -0.1]);
  for (const s of [-1, 1]) {
    B.b(h, [0.24, 0.16, 0.04], 0x4a2c1c, [s * 0.27, 0.46, 0.45]);
    B.b(h, [0.07, 0.07, 0.05], 0xffffff, [s * 0.27 - 0.04, 0.48, 0.47]);
  }
  blush(B, h, 0.45, 0.25, 0.36, 0xf79aa0);
  B.b(h, [0.1, 0.04, 0.04], 0x4a2c1c, [0, 0.36, 0.45]);
  B.b(h, [0.12, 0.04, 0.04], 0x4a2c1c, [-0.05, 0.28, 0.45], [0, 0, 0.7]);
  B.b(h, [0.12, 0.04, 0.04], 0x4a2c1c, [0.05, 0.28, 0.45], [0, 0, -0.7]);
  // collar mane
  B.b(bd, [0.9, 0.2, 0.6], BR, [0, 0.52, 0]);
  B.b(bd, [0.4, 0.2, 0.2], BR2, [0, 0.45, 0.28]);
  // soles
  for (const l of [r.legL, r.legR]) B.b(l, [0.34, 0.04, 0.46], BR2, [0, -0.45, 0.05]);
  // tail
  const tail = B.g(bd, [0, 0.1, -0.24]);
  B.b(tail, [0.1, 0.1, 0.3], BR, [0, 0.05, -0.15]);
  B.b(tail, [0.1, 0.3, 0.1], BR, [0, 0.25, -0.32]);
  B.b(tail, [0.22, 0.24, 0.22], 0x6a4325, [0, 0.5, -0.34]);
  r.extras.tail = tail;
  return r;
}

function buildDakai(B: Builder): Rig {
  const JK = 0x6f78a8, JK2 = 0x5c6492;
  const r = skeleton(B, 3, { torso: 0x1d1d22, torsoSize: [0.68, 0.55, 0.42], armCol: JK, armW: 0.25, handCol: SKIN, handSize: 0.25, legTop: 0x3c3d4a, legBot: 0x34353f, legW: 0.28, shoe: 0x17171b, headCol: SKIN, headSize: [0.9, 0.8, 0.82], scale: 0.97 });
  const h = r.head, bd = r.body;
  // hair
  B.b(h, [0.98, 0.3, 0.98], 0x1b1b20, [0, 0.9, -0.02]);
  B.b(h, [0.98, 0.7, 0.3], 0x18181c, [0, 0.55, -0.4]);
  for (const s of [-1, 1]) B.b(h, [0.12, 0.45, 0.78], 0x1b1b20, [s * 0.5, 0.6, -0.05]);
  [[-0.3, 1.1, 0.0, 0.34], [0.05, 1.15, 0.05, 0.4], [0.35, 1.08, -0.05, 0.3], [-0.05, 1.02, 0.3, 0.3], [0.38, 0.85, 0.35, 0.22]].forEach(([x, y, z, s], i) => B.b(h, [s, s * 0.8, s], i % 2 ? 0x15151a : 0x232328, [x, y, z], [0.2 * i, 0.3 * i, 0.1]));
  B.b(h, [0.62, 0.16, 0.12], 0x1b1b20, [-0.1, 0.78, 0.42]);
  B.b(h, [0.14, 0.3, 0.12], 0x1b1b20, [0.4, 0.62, 0.38]);
  for (const s of [-1, 1]) B.b(h, [0.1, 0.22, 0.2], SKIN, [s * 0.5, 0.35, 0.0]);
  // face
  eyes(B, h, 0.42, 0.4, 0.22, { w: 0.2, h: 0.22, iris: 0x6b3f22 });
  for (const s of [-1, 1]) {
    B.b(h, [0.3, 0.06, 0.04], 0x15151a, [s * 0.22, 0.62, 0.42], [0, 0, s * 0.18]);
    // glasses
    B.b(h, [0.3, 0.03, 0.03], 0x101014, [s * 0.22, 0.52, 0.44]);
    B.b(h, [0.3, 0.03, 0.03], 0x101014, [s * 0.22, 0.27, 0.44]);
    B.b(h, [0.03, 0.26, 0.03], 0x101014, [s * 0.22 - 0.15, 0.4, 0.44]);
    B.b(h, [0.03, 0.26, 0.03], 0x101014, [s * 0.22 + 0.15, 0.4, 0.44]);
    B.b(h, [0.03, 0.04, 0.3], 0x101014, [s * 0.45, 0.5, 0.28]);
  }
  B.b(h, [0.1, 0.03, 0.03], 0x101014, [0, 0.5, 0.44]);
  B.b(h, [0.14, 0.03, 0.03], 0xd78f80, [0, 0.12, 0.42]);
  // shirt + jacket
  for (let i = 0; i < 3; i++) B.b(bd, [0.06, 0.06, 0.04], 0x55565f, [0, 0.45 - i * 0.14, 0.22]);
  for (const s of [-1, 1]) {
    B.b(bd, [0.26, 0.55, 0.48], JK, [s * 0.3, 0.27, -0.01]);
    B.b(bd, [0.12, 0.3, 0.1], JK2, [s * 0.17, 0.4, 0.25], [0, 0, s * 0.3]);
  }
  B.b(bd, [0.7, 0.55, 0.1], JK2, [0, 0.27, -0.25]);
  B.b(bd, [0.54, 0.1, 0.4], 0x1d1d22, [0, 0.6, 0]);
  for (const a of [r.armL, r.armR]) B.b(a, [0.28, 0.08, 0.3], 0x1d1d22, [0, -0.36, 0]);
  return r;
}

function buildNizi(B: Builder): Rig {
  const PK = 0xf06a9a, PK2 = 0xff8ab5;
  const r = skeleton(B, 4, { torso: PK, torsoSize: [0.66, 0.5, 0.46], armCol: PK2, armW: 0.3, handCol: SKIN, handSize: 0.22, legTop: 0xf6d8cb, legBot: 0xf0cfc2, legW: 0.24, shoe: 0x1c1b22, shoeSize: [0.34, 0.2, 0.42], headCol: SKIN, headSize: [0.88, 0.78, 0.8], scale: 0.97 });
  const h = r.head, bd = r.body;
  // hair: dark top -> purple tips
  B.b(h, [1.06, 0.34, 1.06], 0x2b2433, [0, 0.9, -0.04]);
  B.b(h, [1.06, 0.4, 0.34], 0x2f2638, [0, 0.55, -0.45]);
  B.b(h, [1.06, 0.3, 0.34], 0x4b2f78, [0, 0.2, -0.45]);
  B.b(h, [1.04, 0.2, 0.34], 0x7e45c2, [0, -0.0, -0.45]);
  for (const s of [-1, 1]) {
    B.b(h, [0.2, 0.42, 0.9], 0x2f2638, [s * 0.53, 0.55, -0.02]);
    B.b(h, [0.2, 0.26, 0.9], 0x5a3590, [s * 0.53, 0.2, -0.02]);
    B.b(h, [0.2, 0.2, 0.9], 0x8a4fd0, [s * 0.53, 0.0, -0.02]);
  }
  [-0.36, -0.18, 0, 0.18, 0.36].forEach((x, i) => B.b(h, [0.19, 0.3, 0.1], i % 2 ? 0x29222f : 0x372c40, [x, 0.66, 0.42]));
  // Z clip
  const zc = 0xf0558f;
  B.b(h, [0.2, 0.05, 0.05], zc, [-0.3, 0.88, 0.5]);
  B.b(h, [0.2, 0.05, 0.05], zc, [-0.3, 0.74, 0.5]);
  B.b(h, [0.2, 0.05, 0.05], zc, [-0.3, 0.81, 0.5], [0, 0, 0.8]);
  eyes(B, h, 0.41, 0.38, 0.21, { w: 0.22, h: 0.26, iris: 0x8a4fe0 });
  for (const s of [-1, 1]) B.b(h, [0.26, 0.04, 0.04], 0x1a1020, [s * 0.21, 0.53, 0.42]);
  blush(B, h, 0.41, 0.2, 0.31);
  B.b(h, [0.14, 0.1, 0.03], 0xe6556a, [0, 0.12, 0.41]);
  B.b(h, [0.5, 0.06, 0.4], 0x17141c, [0, -0.02, 0]); // choker
  // sweater & straps
  B.b(bd, [0.86, 0.16, 0.54], PK2, [0, 0.45, 0]);
  B.b(bd, [0.46, 0.1, 0.3], SKIN, [0, 0.58, 0.05]);
  for (const s of [-1, 1]) B.b(bd, [0.05, 0.3, 0.04], 0x17141c, [s * 0.1, 0.55, 0.25], [0, 0, -s * 0.5]);
  // plaid skirt
  B.b(bd, [0.86, 0.22, 0.62], PK, [0, -0.02, 0]);
  for (let i = -3; i <= 3; i++) B.b(bd, [0.03, 0.22, 0.64], 0x2a2230, [i * 0.12, -0.02, 0]);
  for (const y of [-0.06, 0.04]) B.b(bd, [0.88, 0.03, 0.64], 0x2a2230, [0, y, 0]);
  // fishnet lines
  for (const l of [r.legL, r.legR]) {
    B.b(l, [0.26, 0.02, 0.26], 0x7a6070, [0, -0.07, 0]);
    B.b(l, [0.26, 0.02, 0.26], 0x7a6070, [0, -0.17, 0]);
    B.b(l, [0.02, 0.32, 0.26], 0x7a6070, [0, -0.17, 0]);
    B.b(l, [0.08, 0.04, 0.04], 0xd0d0d8, [0.0, -0.36, 0.28]);
    B.b(l, [0.08, 0.04, 0.04], 0xd0d0d8, [0.0, -0.42, 0.28]);
  }
  return r;
}

function buildYutou(B: Builder): Rig {
  const LV = 0xc9a8f5, LV2 = 0xb592ee, PUR = 0x6f6fe6;
  const r = skeleton(B, 5, { torso: 0xf4f2fb, torsoSize: [0.66, 0.52, 0.46], armCol: 0xeeeaf8, armW: 0.3, handCol: 0x1c1b24, handSize: 0.23, legTop: SKIN, legBot: 0x3a2f3a, legW: 0.25, shoe: 0x1c1b24, shoeSize: [0.32, 0.18, 0.42], headCol: SKIN, headSize: [0.88, 0.78, 0.8], scale: 0.97 });
  const h = r.head, bd = r.body;
  B.b(h, [1.08, 0.36, 1.08], 0xd7b9fb, [0, 0.9, -0.04]);
  B.b(h, [1.08, 0.85, 0.36], LV, [0, 0.45, -0.46]);
  B.b(h, [1.06, 0.2, 0.34], 0xa8b4f5, [0, -0.05, -0.46]);
  for (const s of [-1, 1]) {
    B.b(h, [0.2, 0.62, 0.92], LV2, [s * 0.54, 0.42, -0.02]);
    B.b(h, [0.2, 0.2, 0.92], 0xa5b0f4, [s * 0.54, -0.03, -0.02]);
  }
  [-0.38, -0.2, -0.02, 0.17, 0.36].forEach((x, i) => B.b(h, [0.2, 0.28 + (i % 3) * 0.05, 0.1], i % 2 ? 0xc3a1f2 : 0xdcc2fb, [x, 0.66, 0.42]));
  // X clip + bow
  B.b(h, [0.22, 0.05, 0.05], 0x7c5ce0, [0.36, 0.84, 0.5], [0, 0, 0.8]);
  B.b(h, [0.22, 0.05, 0.05], 0x7c5ce0, [0.36, 0.84, 0.5], [0, 0, -0.8]);
  B.b(h, [0.18, 0.12, 0.05], 0x7fd3f5, [0.36, 0.7, 0.5]);
  eyes(B, h, 0.41, 0.36, 0.21, { w: 0.22, h: 0.2, iris: 0xa05ae6 });
  for (const s of [-1, 1]) B.b(h, [0.26, 0.06, 0.04], 0x2a1f40, [s * 0.21, 0.5, 0.42], [0, 0, s * 0.22]);
  blush(B, h, 0.41, 0.2, 0.31, 0xf5a8b8);
  B.b(h, [0.1, 0.03, 0.03], 0xd8707f, [0, 0.11, 0.41]);
  B.b(h, [0.46, 0.08, 0.38], 0x17141c, [0, -0.02, 0]);
  B.b(h, [0.07, 0.07, 0.04], 0xcfc2f5, [0, -0.02, 0.2]);
  // top + jacket
  B.b(bd, [0.5, 0.3, 0.06], 0xffffff, [0, 0.35, 0.24]);
  B.b(bd, [0.16, 0.16, 0.05], 0x8e6cf0, [0.12, 0.38, 0.28]);
  for (const s of [-1, 1]) {
    B.b(bd, [0.3, 0.5, 0.5], 0xf4f2fb, [s * 0.4, 0.26, 0.0]);
    B.b(bd, [0.34, 0.14, 0.54], 0x1c1b24, [s * 0.4, 0.58, 0.0]);
    B.b(bd, [0.06, 0.3, 0.52], PUR, [s * 0.25, 0.3, 0.0]);
  }
  for (const a of [r.armL, r.armR]) {
    B.b(a, [0.34, 0.1, 0.34], PUR, [0, -0.36, 0]);
    B.b(a, [0.2, 0.14, 0.2], SKIN, [0, -0.48, 0.0]);
    B.b(a, [0.1, 0.1, 0.06], 0x8e6cf0, [0.0, -0.1, 0.18]);
  }
  // skirt + belt
  B.b(bd, [0.84, 0.24, 0.6], 0x6e70dc, [0, -0.03, 0]);
  B.b(bd, [0.86, 0.06, 0.62], 0x17141c, [0, 0.08, 0]);
  B.b(bd, [0.14, 0.1, 0.04], 0xffffff, [0.25, 0.08, 0.32]);
  B.b(bd, [0.86, 0.04, 0.3], 0x17141c, [0, -0.14, -0.15]);
  B.b(r.legL, [0.28, 0.05, 0.28], 0x17141c, [0, -0.06, 0]);
  B.b(r.legR, [0.26, 0.2, 0.26], 0x4a3a46, [0, -0.1, 0]);
  for (const l of [r.legL, r.legR]) B.b(l, [0.34, 0.04, 0.44], PUR, [0, -0.45, 0.05]);
  return r;
}

export function buildCharacter(id: number): Rig {
  const B = new Builder();
  const rig = [buildGodjj, buildDingyi, buildShizimaru, buildDakai, buildNizi, buildYutou][id](B);
  rig.mats = B.mats;
  return rig;
}

// ===== Pose animation =====
interface PoseSet { aR?: V3; aL?: V3; lR?: V3; lL?: V3; b?: V3 }
const ANIMS: Record<string, [PoseSet, PoseSet]> = {
  jab: [{ aR: [0.6, 0, 0.2], aL: [-0.8, 0, -0.2], b: [0, 0.3, 0] }, { aR: [-1.55, 0, 0], aL: [-0.5, 0, 0], b: [0.1, -0.3, 0] }],
  swing: [{ aR: [0.8, 0, 0.9], aL: [0.3, 0, -0.5], b: [0, 0.6, 0] }, { aR: [-1.7, 0, 0.2], aL: [0.5, 0, -0.4], b: [0.1, -0.7, 0] }],
  uppercut: [{ aR: [0.7, 0, 0.2], aL: [-0.4, 0, -0.3], b: [0.1, 0, 0], lR: [0.3, 0, 0], lL: [-0.3, 0, 0] }, { aR: [-3.0, 0, 0.1], aL: [-0.3, 0, -0.5], b: [-0.2, 0, 0] }],
  smash: [{ aR: [-3.0, 0, 0.3], aL: [-3.0, 0, -0.3], b: [-0.3, 0, 0] }, { aR: [-1.0, 0, 0.1], aL: [-1.0, 0, -0.1], b: [0.5, 0, 0], lR: [-0.4, 0, 0], lL: [0.4, 0, 0] }],
  kick: [{ lR: [0.6, 0, 0], aL: [-0.6, 0, -0.5], aR: [0.6, 0, 0.5], b: [-0.1, 0, 0] }, { lR: [-1.7, 0, 0], aL: [-0.4, 0, -0.8], aR: [0.4, 0, 0.8], b: [-0.2, 0, 0] }],
  spin: [{ aR: [0, 0, 1.4], aL: [0, 0, -1.4], lR: [-0.3, 0, 0.3], lL: [-0.3, 0, -0.3] }, { aR: [0, 0, 1.5], aL: [0, 0, -1.5], lR: [-0.5, 0, 0.4], lL: [-0.2, 0, -0.4] }],
  thrust: [{ aR: [0.5, 0, 0.3], aL: [0.5, 0, -0.3], b: [-0.1, 0, 0] }, { aR: [-1.55, 0, 0.15], aL: [-1.55, 0, -0.15], b: [0.55, 0, 0], lR: [0.7, 0, 0], lL: [-0.5, 0, 0] }],
  cast: [{ aR: [0.3, 0, 0.4], aL: [0.3, 0, -0.4], b: [-0.1, 0, 0] }, { aR: [-1.45, 0, 0.1], aL: [-1.45, 0, -0.1], b: [0.1, 0, 0] }],
  slam: [{ aR: [-3.1, 0, 0.4], aL: [-3.1, 0, -0.4], b: [-0.35, 0, 0] }, { aR: [-0.6, 0, 0.2], aL: [-0.6, 0, -0.2], b: [0.7, 0, 0], lL: [0.4, 0, 0], lR: [-0.4, 0, 0] }],
  dive: [{ aR: [-2.8, 0, 0.2], aL: [-2.8, 0, -0.2] }, { aR: [-0.4, 0, 1.0], aL: [-0.4, 0, -1.0], b: [0.3, 0, 0], lR: [0.2, 0, 0.1], lL: [0.2, 0, -0.1] }],
  grab: [{ aR: [-0.8, 0, 0.2], aL: [-0.8, 0, -0.2] }, { aR: [-1.55, 0, -0.1], aL: [-1.55, 0, 0.1], b: [0.25, 0, 0] }],
};
const Z: V3 = [0, 0, 0];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lv = (a: V3 | undefined, b: V3 | undefined, t: number): V3 => {
  const A = a || Z, Bv = b || Z;
  return [lerp(A[0], Bv[0], t), lerp(A[1], Bv[1], t), lerp(A[2], Bv[2], t)];
};
const set = (o: THREE.Object3D, v: V3) => o.rotation.set(v[0], v[1], v[2]);

export interface PoseIn {
  state: string; t: number; time: number; vx: number; vy: number; onGround: boolean;
  anim?: string; phase?: "st" | "ac" | "rc"; p?: number; speedRatio?: number; spin?: number; moveKey?: string;
}
export function applyPose(rig: Rig, s: PoseIn) {
  const { all, body, head, armL, armR, legL, legR } = rig;
  all.position.set(0, PIV, 0);
  all.rotation.set(0, 0, 0);
  all.scale.set(1, 1, 1);
  body.position.y = 0.45 - PIV;
  body.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  rig.root.scale.y = rig.root.scale.x;
  let aR: V3 = Z, aL: V3 = Z, lR: V3 = Z, lL: V3 = Z, b: V3 = Z, hd: V3 = Z;
  const T = s.time;
  const tail = rig.extras.tail;
  if (tail && rig.id !== 0) tail.rotation.y = Math.sin(T * 6) * 0.35;
  if (rig.id === 1 && rig.extras.hat) rig.extras.hat.rotation.y = 0;
  switch (s.state) {
    case "run": {
      const ph = T * 15 * Math.min(1.3, 0.6 + (s.speedRatio || 1) * 0.5);
      const sw = Math.sin(ph);
      lR = [sw * 0.95, 0, 0]; lL = [-sw * 0.95, 0, 0];
      aR = [-sw * 0.9, 0, 0.1]; aL = [sw * 0.9, 0, -0.1];
      b = [0.18, 0, 0];
      all.position.y = PIV + Math.abs(Math.cos(ph)) * 0.07;
      if (tail) tail.rotation.y = Math.sin(ph) * 0.4;
      break;
    }
    case "jump": lR = [-0.5, 0, 0.1]; lL = [0.35, 0, -0.1]; aR = [-0.4, 0, 1.2]; aL = [-0.4, 0, -1.2]; b = [0.05, 0, 0]; break;
    case "fall": lR = [-0.2, 0, 0.2]; lL = [0.1, 0, -0.2]; aR = [-0.2, 0, 1.4]; aL = [-0.2, 0, -1.4]; break;
    case "attack": {
      const set2 = ANIMS[s.anim || "jab"] || ANIMS.jab;
      const p = s.p || 0;
      const A = set2[0], Bp = set2[1];
      let ps: PoseSet;
      if (s.phase === "st") ps = { aR: lv(Z, A.aR, p), aL: lv(Z, A.aL, p), lR: lv(Z, A.lR, p), lL: lv(Z, A.lL, p), b: lv(Z, A.b, p) };
      else if (s.phase === "ac") { const e = 1 - Math.pow(1 - p, 3); ps = { aR: lv(A.aR, Bp.aR, e), aL: lv(A.aL, Bp.aL, e), lR: lv(A.lR, Bp.lR, e), lL: lv(A.lL, Bp.lL, e), b: lv(A.b, Bp.b, e) }; }
      else ps = { aR: lv(Bp.aR, Z, p), aL: lv(Bp.aL, Z, p), lR: lv(Bp.lR, Z, p), lL: lv(Bp.lL, Z, p), b: lv(Bp.b, Z, p) };
      aR = ps.aR!; aL = ps.aL!; lR = ps.lR!; lL = ps.lL!; b = ps.b!;
      if (s.anim === "spin") {
        const total = s.phase === "ac" ? p : s.phase === "rc" ? 1 : 0;
        all.rotation.y = total * Math.PI * 2;
      }
      if (!s.onGround && s.anim !== "spin") { lR = [lR[0] - 0.3, 0, 0.1]; lL = [lL[0] + 0.2, 0, -0.1]; }
      break;
    }
    case "hit": case "grabbed": {
      const f = Math.sin(T * 28) * 0.4;
      aR = [-0.6 + f, 0, 1.4]; aL = [-0.6 - f, 0, -1.4]; lR = [-0.5 + f, 0, 0.3]; lL = [0.4 - f, 0, -0.3]; b = [-0.35, 0, 0]; hd = [-0.25, 0, 0];
      if (s.spin) all.rotation.z = s.spin;
      break;
    }
    case "stun": aR = [0.2, 0, 0.3]; aL = [0.2, 0, -0.3]; b = [0.35, 0, Math.sin(T * 8) * 0.1]; hd = [0.4, 0, Math.sin(T * 8) * 0.25]; lR = [-0.4, 0, 0.2]; lL = [-0.4, 0, -0.2]; all.position.y = PIV - 0.1; break;
    case "block": aR = [-1.3, 0, -0.9]; aL = [-1.3, 0, 0.9]; b = [0.2, 0, 0]; lR = [-0.5, 0, 0.1]; lL = [-0.5, 0, -0.1]; all.position.y = PIV - 0.1; break;
    case "dodge": {
      const p = Math.min(1, s.t / 0.35);
      all.rotation.x = (s.vx !== 0 ? p * Math.PI * 2 : 0);
      if (s.vx === 0) { all.scale.set(1, 0.7, 1); all.position.y = PIV - 0.15; }
      lR = [-1.2, 0, 0]; lL = [-1.2, 0, 0]; aR = [-1.3, 0, 0.3]; aL = [-1.3, 0, -0.3];
      break;
    }
    case "ult": aR = [-2.8 + Math.sin(T * 30) * 0.1, 0, 0.5]; aL = [-2.8 - Math.sin(T * 30) * 0.1, 0, -0.5]; b = [-0.2, 0, 0]; lR = [0.2, 0, 0.3]; lL = [0.2, 0, -0.3]; all.position.y = PIV + Math.sin(T * 20) * 0.03; break;
    case "win": winPose(rig, s.t, T); return;
    case "lose": b = [0.5, 0, 0]; hd = [0.5, 0, 0]; aR = [0.1, 0, 0.1]; aL = [0.1, 0, -0.1]; lR = [-0.3, 0, 0]; lL = [-0.3, 0, 0]; all.position.y = PIV - 0.12; break;
    case "taunt": aR = [-2.9 + Math.sin(T * 8) * 0.3, 0, 0.3]; aL = [0, 0, -0.3]; b = [-0.1, 0, 0]; break;
    default: {
      // idle
      const sw = Math.sin(T * 3);
      aR = [sw * 0.08, 0, 0.15 + sw * 0.03]; aL = [-sw * 0.08, 0, -0.15 - sw * 0.03];
      all.position.y = PIV + sw * 0.015;
      b = [0.03 + sw * 0.01, 0, 0];
      lR = [0.04, 0, 0.04]; lL = [-0.04, 0, -0.04];
    }
  }
  set(armR, aR); set(armL, aL); set(legR, lR); set(legL, lL); set(body, b); set(head, hd);
}

function winPose(rig: Rig, t: number, T: number) {
  const { all, body, head, armL, armR, legL, legR } = rig;
  const hop = Math.abs(Math.sin(T * 6));
  switch (rig.id) {
    case 0: // GODJJ: tail high + spin hop
      all.position.y = PIV + hop * 0.35; all.rotation.y = Math.sin(T * 3) * 0.6;
      armR.rotation.set(-3.1, 0, 0.3); armL.rotation.set(-0.4, 0, -1.3); legR.rotation.set(-0.4, 0, 0); legL.rotation.set(0.3, 0, 0);
      if (rig.extras.tail) rig.extras.tail.rotation.set(-0.6, Math.sin(T * 12) * 0.5, 0);
      break;
    case 1: // Ding Yi: flex, hat spin
      all.position.y = PIV + hop * 0.12; armR.rotation.set(-0.4, 0, 1.4 + Math.sin(T * 8) * 0.1); armL.rotation.set(-0.4, 0, -1.4 - Math.sin(T * 8) * 0.1);
      body.rotation.set(-0.1, Math.sin(T * 4) * 0.3, 0); legR.rotation.set(0, 0, 0.3); legL.rotation.set(0, 0, -0.3);
      if (rig.extras.hat) rig.extras.hat.rotation.y = T * 8;
      break;
    case 2: // Shizimaru: grumpy roar fist
      all.position.y = PIV + hop * 0.1; armR.rotation.set(-3.0, 0, 0.2); armL.rotation.set(-0.2, 0, -0.5);
      head.rotation.set(-0.35 + Math.sin(T * 10) * 0.1, 0, 0); body.rotation.set(-0.1, 0, 0);
      break;
    case 3: // Da Kai: adjust glasses
      armR.rotation.set(-2.5, 0, -0.5 + Math.sin(T * 4) * 0.1); armL.rotation.set(0, 0, -0.2);
      head.rotation.set(Math.sin(T * 2) * 0.1 - 0.1, 0, 0); body.rotation.set(0.05, 0, 0);
      break;
    case 4: // Nizi: peace hop spin
      all.position.y = PIV + hop * 0.4; all.rotation.y = T * 2.2;
      armR.rotation.set(-2.9, 0, 0.4); armL.rotation.set(-0.3, 0, -1.2); legR.rotation.set(-0.5, 0, 0.2); legL.rotation.set(0.4, 0, -0.2);
      break;
    default: // Yutou: float
      all.position.y = PIV + 0.5 + Math.sin(T * 3) * 0.12; all.rotation.y = Math.sin(T * 1.5) * 0.8;
      armR.rotation.set(-0.3, 0, 1.0); armL.rotation.set(-0.3, 0, -1.0); legR.rotation.set(0.3, 0, 0.1); legL.rotation.set(0.2, 0, -0.1);
  }
  void t;
}
