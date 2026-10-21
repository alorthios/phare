import * as THREE from "three";
import { generateTestWorld } from "@phare/shared";

export const COLORS = {
  night: new THREE.Color("#0b1630"),
  water: new THREE.Color("#12304f"),
  rock: new THREE.Color("#3a4a63"),
};

/** Hauteur des vagues en un point du monde : quelques sinusoïdes superposées. */
export function waveHeight(x: number, z: number, t: number): number {
  return 0.22 * Math.sin(0.15 * x + t * 0.8)
    + 0.16 * Math.sin(0.12 * z - t * 0.6)
    + 0.08 * Math.sin((x + z) * 0.3 + t * 1.7);
}

const WATER_SIZE = 600;
const WATER_SEGMENTS = 100;
const WATER_STEP = WATER_SIZE / WATER_SEGMENTS;

/**
 * La mer, les bouées, les rochers et le ciel étoilé.
 * Renvoie une fonction `update(t, boatX, boatZ)` à appeler à chaque image.
 */
export function createWorld(scene: THREE.Scene, seed: number) {
  scene.background = COLORS.night;
  // Brume légère provisoire : la vraie brume dissipée par le phare arrive au jalon 5.
  scene.fog = new THREE.FogExp2(COLORS.night, 0.012);

  // --- Lumières ---
  scene.add(new THREE.HemisphereLight("#3a5a8c", "#0b1630", 0.9));
  const moon = new THREE.DirectionalLight("#b8c7e6", 0.7);
  moon.position.set(-80, 120, -60);
  scene.add(moon);

  // --- La mer : une grille low-poly qui suit le bateau, animée par les vagues ---
  const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
  waterGeo.rotateX(-Math.PI / 2);   // à plat : les sommets sont maintenant dans le plan X/Z
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: COLORS.water, roughness: 0.55, metalness: 0.1, flatShading: true,
  }));
  scene.add(water);
  const basePositions = Float32Array.from(waterGeo.attributes.position.array);

  // --- Bouées et rochers (mêmes positions que sur la carte du Gardien) ---
  const world = generateTestWorld(seed);
  const buoyMats = {
    red: new THREE.MeshStandardMaterial({ color: "#c8463c", emissive: "#5a1410", flatShading: true }),
    green: new THREE.MeshStandardMaterial({ color: "#3c9a5a", emissive: "#103a1c", flatShading: true }),
  };
  const buoyGeo = new THREE.ConeGeometry(0.6, 2.2, 6);
  const buoys = world.buoys.map((b) => {
    const mesh = new THREE.Mesh(buoyGeo, buoyMats[b.color]);
    mesh.position.set(b.x, 0.8, b.z);
    scene.add(mesh);
    return mesh;
  });

  const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 1, flatShading: true });
  for (const r of world.rocks) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r.size, 0), rockMat);
    rock.position.set(r.x, r.size * 0.3, r.z);
    rock.rotation.set(r.x, r.z, 0);   // orientation « aléatoire » mais stable
    rock.scale.y = 0.7;
    scene.add(rock);
  }

  // --- Ciel étoilé (provisoire : les vraies constellations arrivent au jalon 6) ---
  const starCount = 1500;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Point au hasard sur la demi-sphère supérieure
    const theta = Math.random() * Math.PI * 2;
    const y = 0.05 + Math.random() * 0.95;
    const r = Math.sqrt(1 - y * y);
    starPositions.set([Math.cos(theta) * r * 900, y * 900, Math.sin(theta) * r * 900], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: "#fff6dd", size: 2, sizeAttenuation: false, fog: false,
  }));
  scene.add(stars);

  function update(t: number, boatX: number, boatZ: number) {
    // La grille d'eau suit le bateau, par pas entiers pour que les vagues ne « glissent » pas.
    water.position.x = Math.round(boatX / WATER_STEP) * WATER_STEP;
    water.position.z = Math.round(boatZ / WATER_STEP) * WATER_STEP;

    const pos = waterGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = basePositions[i * 3] + water.position.x;
      const z = basePositions[i * 3 + 2] + water.position.z;
      pos.setY(i, waveHeight(x, z, t));
    }
    pos.needsUpdate = true;

    for (const buoy of buoys) {
      buoy.position.y = 0.8 + waveHeight(buoy.position.x, buoy.position.z, t);
    }

    // Le ciel est « à l'infini » : il suit le bateau.
    stars.position.set(boatX, 0, boatZ);
  }

  return { update };
}
