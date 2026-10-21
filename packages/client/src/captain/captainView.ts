import * as THREE from "three";
import { THROTTLE_STOP, type Level } from "@phare/shared";
import { BoatInterpolator } from "../net/boatInterpolator.ts";
import type { NightRoom } from "../net/connection.ts";
import { h } from "../ui/dom.ts";
import { createBoat } from "./deck.ts";
import { bindHelm } from "./helm.ts";
import { createCaptainHud } from "./hud.ts";
import { createWorld, waveHeight } from "./world.ts";

const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = (75 * Math.PI) / 180;

/**
 * Vue du Capitaine : à la barre, en vue à la première personne.
 * `root` est le conteneur plein écran ; `overlay` contient la radio (ajoutée par l'appelant).
 * Renvoie une fonction de nettoyage.
 */
export function startCaptainView(room: NightRoom, level: Level, root: HTMLElement, overlay: HTMLElement): () => void {
  // --- Rendu 3D ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  root.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2000);
  camera.rotation.order = "YXZ";   // d'abord tourner la tête (lacet), puis lever/baisser (tangage)

  const world = createWorld(scene, level);
  const boat = createBoat();
  boat.group.rotation.order = "YXZ";   // cap dans le monde, puis tangage et roulis dans le repère du bateau
  scene.add(boat.group);
  boat.group.add(camera);
  camera.position.copy(boat.eye);

  // --- Interface ---
  const hud = createCaptainHud();
  overlay.append(
    h("div", { class: "hud-top" }, hud.heading),
    h("div", { class: "hud-bottom-left" }, hud.instruments),
    hud.lockHint,
  );

  // --- Synchronisation avec le serveur ---
  const interpolator = new BoatInterpolator();
  const onState = () => { if (room.state.boat) interpolator.push(room.state.boat); };
  room.onStateChange(onState);
  onState();

  // --- Regard à la souris (pointer lock) ---
  let lookYaw = 0;
  let lookPitch = -0.08;
  const onClick = () => { canvas.requestPointerLock(); };
  const onMouseMove = (ev: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    lookYaw -= ev.movementX * MOUSE_SENSITIVITY;
    lookPitch = THREE.MathUtils.clamp(lookPitch - ev.movementY * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  };
  canvas.addEventListener("click", onClick);
  hud.lockHint.addEventListener("click", onClick);
  document.addEventListener("mousemove", onMouseMove);

  const unbindHelm = bindHelm(room);

  // --- Taille de la fenêtre ---
  const resize = () => {
    const { clientWidth: w, clientHeight: hgt } = root;
    renderer.setSize(w, hgt);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  // --- Boucle d'affichage ---
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    const b = interpolator.sample();

    // Le navire suit la position du serveur et tangue sur les vagues.
    boat.group.position.set(b.x, waveHeight(b.x, b.z, t) * 0.5, b.z);
    boat.group.rotation.set(
      Math.sin(t * 0.9) * 0.015,                     // tangage
      -b.heading,                                    // cap (sens horaire depuis le nord = rotation négative)
      Math.sin(t * 0.7 + 1) * 0.025 - b.rudder * Math.min(1, Math.abs(b.speed) / 6) * 0.04,   // roulis
    );
    boat.setRudder(b.rudder);

    camera.rotation.set(lookPitch, lookYaw, 0);
    world.update(t, b.x, b.z);
    hud.update(b, room.state.boat?.throttle ?? THROTTLE_STOP, document.pointerLockElement === canvas);

    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    unbindHelm();
    room.onStateChange.remove(onState);
    window.removeEventListener("resize", resize);
    document.removeEventListener("mousemove", onMouseMove);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    renderer.dispose();
    canvas.remove();
  };
}
