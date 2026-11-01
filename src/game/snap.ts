// Generates portrait + arena thumbnails by rendering the 3D models/arenas once at startup
import * as THREE from "three";
import { buildCharacter, applyPose } from "./models";
import { buildArena } from "./arenas";
import { CHARS, ARENAS } from "./data";

export const portraits: string[] = [];
export const thumbs: string[] = [];
export const fullShots: string[] = [];
export let assetsReady = false;

export async function generateAssets(onProgress: (p: number) => void) {
  if (assetsReady) return;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    const total = CHARS.length + ARENAS.length;
    let done = 0;
    for (const c of CHARS) {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8fb0, 1.5));
      const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(3, 6, 8); scene.add(d);
      const rig = buildCharacter(c.id);
      applyPose(rig, { state: "idle", t: 0, time: 0, vx: 0, vy: 0, onGround: true });
      rig.root.rotation.y = 0.5;
      scene.add(rig.root);
      // head shot
      renderer.setSize(256, 256);
      const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
      cam.position.set(0.9, 1.75, 4.2); cam.lookAt(0, 1.4, 0);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, cam);
      portraits[c.id] = renderer.domElement.toDataURL("image/png");
      // full body
      renderer.setSize(300, 420);
      const cam2 = new THREE.PerspectiveCamera(30, 300 / 420, 0.1, 50);
      cam2.position.set(1.4, 1.5, 6.4); cam2.lookAt(0, 1.0, 0);
      renderer.render(scene, cam2);
      fullShots[c.id] = renderer.domElement.toDataURL("image/png");
      done++; onProgress(done / total);
      await new Promise((r) => setTimeout(r, 10));
    }
    for (const a of ARENAS) {
      const scene = new THREE.Scene();
      const rt = buildArena(a.id);
      scene.add(rt.group);
      scene.background = new THREE.Color(rt.bg);
      scene.fog = new THREE.Fog(rt.fog[0], rt.fog[1], rt.fog[2]);
      rt.update(1.2, 0.016);
      renderer.setSize(480, 270);
      const cam = new THREE.PerspectiveCamera(40, 480 / 270, 0.1, 400);
      cam.position.set(0, 5.5, 32); cam.lookAt(0, 3, 0);
      renderer.render(scene, cam);
      thumbs[a.id] = renderer.domElement.toDataURL("image/jpeg", 0.85);
      done++; onProgress(done / total);
      await new Promise((r) => setTimeout(r, 10));
    }
  } catch (e) {
    console.warn("asset snapshot failed", e);
  } finally {
    try { renderer?.dispose(); renderer?.forceContextLoss(); } catch { /* noop */ }
    assetsReady = true;
  }
}
