import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildCharacter, applyPose, Rig } from "../game/models";
import { CHARS, Move, MOVE_ORDER } from "../game/data";
import { audio } from "../game/audio";

function movePose(m: Move, t: number) {
  const tot = m.st + m.ac + m.rc;
  if (t < m.st) return { phase: "st" as const, p: m.st > 0 ? t / m.st : 1, tot };
  if (t < m.st + m.ac) return { phase: "ac" as const, p: (t - m.st) / m.ac, tot };
  return { phase: "rc" as const, p: Math.min(1, (t - m.st - m.ac) / Math.max(0.01, tot - m.st - m.ac)), tot };
}

export interface Cmd { id: number; kind: "win" | "move" | "taunt"; key?: string }

/** Large rotating 3D preview of one character. Drag to rotate, click to play a demo move. */
export function CharViewer({ charId, cmd, className = "", cycle = true }: { charId: number; cmd?: Cmd; className?: string; cycle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ rig: Rig | null; scene: THREE.Scene; demo: { m: Move | null; t: number; win: number }; yaw: number; drag: boolean; lastX: number; born: number; ring: THREE.Mesh; idx: number; charId: number }>(null as never);

  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa59cc0, 1.5));
    const d = new THREE.DirectionalLight(0xffffff, 1.3); d.position.set(3, 6, 8); scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.3, 9.2); cam.lookAt(0, 1.0, 0);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.18, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    ring.position.y = -0.1; scene.add(ring);
    const s = { rig: null as Rig | null, scene, demo: { m: null as Move | null, t: 0, win: 0 }, yaw: 0.45, drag: false, lastX: 0, born: 0, ring, idx: 0, charId: -1 };
    st.current = s;
    const resize = () => {
      const w = el.clientWidth || 300, h = el.clientHeight || 400;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.position.z = w / h < 0.7 ? 11.5 : 9.2;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0, last = performance.now(), T = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
      const rig = s.rig;
      if (rig) {
        s.born += dt;
        if (!s.drag) s.yaw += dt * 0.35 * (s.demo.m || s.demo.win > 0 ? 0 : 1);
        rig.root.rotation.y = s.yaw;
        const sc = Math.min(1, s.born * 4);
        rig.root.position.y = (1 - sc) * 0.5;
        let state = "idle", p: { phase?: "st" | "ac" | "rc"; p?: number } = {}, anim: string | undefined;
        if (s.demo.m) {
          s.demo.t += dt;
          const mp = movePose(s.demo.m, s.demo.t);
          if (s.demo.t >= mp.tot + 0.25) s.demo.m = null;
          else { state = "attack"; anim = s.demo.m.anim; p = mp; }
        } else if (s.demo.win > 0) { s.demo.win -= dt; state = "win"; }
        applyPose(rig, { state, t: T, time: T, vx: 0, vy: 0, onGround: true, anim, phase: p.phase, p: p.p });
      }
      ring.rotation.y += dt * 0.5;
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: PointerEvent) => { s.drag = true; s.lastX = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); };
    const move = (e: PointerEvent) => { if (s.drag) { s.yaw += (e.clientX - s.lastX) * 0.012; s.lastX = e.clientX; } };
    let moved = 0;
    const down2 = (e: PointerEvent) => { moved = e.clientX; down(e); };
    const up = (e: PointerEvent) => {
      s.drag = false;
      if (Math.abs(e.clientX - moved) < 5 && cycle) trigger(s);
    };
    renderer.domElement.addEventListener("pointerdown", down2);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* noop */ }
      renderer.domElement.remove();
    };
  }, [cycle]);

  useEffect(() => {
    const s = st.current;
    if (!s) return;
    if (s.rig) s.scene.remove(s.rig.root);
    const rig = buildCharacter(charId);
    s.rig = rig; s.scene.add(rig.root); s.born = 0; s.charId = charId; s.demo = { m: null, t: 0, win: 0 };
    (s.ring.material as THREE.MeshBasicMaterial).color.setHex(CHARS[charId].color);
  }, [charId]);

  useEffect(() => {
    const s = st.current;
    if (!s || !cmd) return;
    if (cmd.kind === "win") { s.demo.win = 2.5; s.demo.m = null; audio.voice(charId, "win"); }
    else if (cmd.kind === "move" && cmd.key) { play(s, cmd.key); }
  }, [cmd, charId]);

  function trigger(s: NonNullable<typeof st.current>) {
    const seq = [...MOVE_ORDER.map((m) => m[0]), "win"];
    const k = seq[s.idx++ % seq.length];
    if (k === "win") { s.demo.win = 2.2; s.demo.m = null; audio.voice(s.charId, "win"); audio.sfx("win"); }
    else play(s, k);
  }
  function play(s: NonNullable<typeof st.current>, k: string) {
    const m = CHARS[s.charId].moves[k];
    if (!m) return;
    s.demo.m = m; s.demo.t = 0; s.demo.win = 0;
    audio.sfx(m.sfx); audio.voice(s.charId, m.ult ? "ult" : "atk");
  }
  return <div ref={ref} className={className} style={{ cursor: "grab" }} />;
}

/** Menu background: all six characters on a colourful stage */
export function Showcase({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a0d0, 1.5));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(-4, 8, 10); scene.add(dl);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const rigs: Rig[] = CHARS.map((c) => buildCharacter(c.id));
    const spots: [number, number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [i * 2.15, 0, i % 2 ? 0.7 : -0.4]);
    rigs.forEach((r, i) => {
      r.root.position.set(...spots[i]);
      scene.add(r.root);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.2, 14), new THREE.MeshBasicMaterial({ color: CHARS[i].color, transparent: true, opacity: 0.7 }));
      base.position.set(spots[i][0], -0.12, spots[i][2]); scene.add(base);
    });
    const cubes: THREE.Mesh[] = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: CHARS[i % 6].color }));
      m.scale.setScalar(0.3 + Math.random() * 0.7);
      m.position.set((Math.random() - 0.5) * 30, Math.random() * 12 - 1, -4 - Math.random() * 10);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      scene.add(m); cubes.push(m);
    }
    const resize = () => {
      const w = el.clientWidth || 800, h = el.clientHeight || 450;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      const z = Math.min(40, Math.max(13, (17 * 1.78) / cam.aspect)); cam.position.set(2.2, 3.0, z); cam.lookAt(2.2, 1.3, 0);
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0, last = performance.now(), T = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
      rigs.forEach((r, i) => {
        const win = Math.floor(T / 2.4) % 6 === i && (T % 2.4) < 2.0;
        applyPose(r, { state: win ? "win" : "idle", t: T, time: T + i, vx: 0, vy: 0, onGround: true });
        r.root.rotation.y = (i < 3 ? 0.35 : -0.35) + Math.sin(T * 0.5 + i) * 0.12;
        if (win) r.root.rotation.y = 0;
      });
      cubes.forEach((c, i) => { c.rotation.x += dt * 0.4; c.rotation.y += dt * 0.3; c.position.y += Math.sin(T + i) * dt * 0.3; });
      cam.position.x = 2.2 + Math.sin(T * 0.2) * 0.8;
      cam.lookAt(2.2, 1.3, 0);
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* noop */ } renderer.domElement.remove(); };
  }, []);
  return <div ref={ref} className={className} />;
}
