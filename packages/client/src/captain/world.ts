import * as THREE from "three";
import { createNoise2D, createRng, type Level } from "@phare/shared";

export const COLORS = {
  night: new THREE.Color("#0b1630"),
  water: new THREE.Color("#12304f"),
  seabed: new THREE.Color("#3a3a33"),
  sand: new THREE.Color("#8a7b5a"),
  grass: new THREE.Color("#33503d"),
  rock: new THREE.Color("#4a5568"),
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
 * L'archipel en 3D : terrain, mer, balisage, port et ciel étoilé.
 * Renvoie une fonction `update(t, boatX, boatZ)` à appeler à chaque image.
 */
export function createWorld(scene: THREE.Scene, level: Level) {
  scene.background = COLORS.night;
  // Brume légère provisoire : la vraie brume dissipée par le phare arrive au jalon 5.
  scene.fog = new THREE.FogExp2(COLORS.night, 0.012);

  // --- Lumières ---
  scene.add(new THREE.HemisphereLight("#3a5a8c", "#0b1630", 0.9));
  const moon = new THREE.DirectionalLight("#b8c7e6", 0.8);
  moon.position.set(-80, 120, -60);
  scene.add(moon);

  scene.add(createTerrain(level));

  // --- La mer : une grille low-poly qui suit le bateau, animée par les vagues ---
  const waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
  waterGeo.rotateX(-Math.PI / 2);   // à plat : les sommets sont maintenant dans le plan X/Z
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: COLORS.water, roughness: 0.55, metalness: 0.1, flatShading: true,
  }));
  scene.add(water);
  const basePositions = Float32Array.from(waterGeo.attributes.position.array);

  const buoys = createEntryBuoys(scene, level);
  createPort(scene, level);

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
      buoy.rotation.z = Math.sin(t * 1.3 + buoy.position.x) * 0.08;
    }

    // Le ciel est « à l'infini » : il suit le bateau.
    stars.position.set(boatX, 0, boatZ);
  }

  return { update };
}

/**
 * Terrain : une grille dont chaque sommet correspond à une case du champ « eau / terre ».
 * Terre (champ < 0.5) → collines ; eau → fond marin (caché sous la mer).
 */
function createTerrain(level: Level): THREE.Mesh {
  const { fieldCols: cols, fieldRows: rows, field } = level;
  const res = level.params.fieldRes;
  const geo = new THREE.PlaneGeometry((cols - 1) * res, (rows - 1) * res, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);   // la ligne 0 de la grille se retrouve au nord (-Z), comme le champ

  const hills = createNoise2D(createRng(level.seed ^ 0x5eed));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let k = 0; k < pos.count; k++) {
    const d = 0.5 - field[k];   // > 0 : terre, < 0 : eau
    let height: number;
    if (d > 0) {
      const inland = Math.min(1, d * 5);   // les collines poussent loin du rivage
      height = 0.4 + d * 14 + inland * (1.5 + 3.5 * hills(pos.getX(k) * 0.03, pos.getZ(k) * 0.03));
    } else {
      height = Math.max(-5, d * 14);
    }
    pos.setY(k, height);

    if (height < -0.2) color.copy(COLORS.seabed);
    else if (height < 1.3) color.copy(COLORS.sand);
    else if (height < 5.5) color.copy(COLORS.grass);
    else color.copy(COLORS.rock);
    colors.set([color.r, color.g, color.b], k * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, flatShading: true,
  }));
}

/** Deux bouées marquent l'entrée de la baie : rouge à gauche (bâbord), verte à droite (tribord). */
function createEntryBuoys(scene: THREE.Scene, level: Level): THREE.Mesh[] {
  const mazeBottom = level.grid.originZ + level.grid.rows * level.grid.sectorSize;
  const z = mazeBottom - level.params.tileSize / 2;
  const geo = new THREE.ConeGeometry(0.6, 2.2, 6);
  return [
    { x: level.spawn.x - 7, color: "#c8463c", glow: "#5a1410" },
    { x: level.spawn.x + 7, color: "#3c9a5a", glow: "#103a1c" },
  ].map((b) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color, emissive: b.glow, flatShading: true }));
    mesh.position.set(b.x, 0.8, z);
    scene.add(mesh);
    return mesh;
  });
}

/** Le Port : un ponton de bois et deux lanternes chaudes, visibles de loin. */
function createPort(scene: THREE.Scene, level: Level) {
  const port = new THREE.Group();
  port.position.set(level.port.x, 0, level.port.z);

  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.9, flatShading: true });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 3), wood);
  deck.position.y = 0.7;
  port.add(deck);

  const glass = new THREE.MeshBasicMaterial({ color: "#ffd98a" });
  for (const x of [-4.2, 4.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), wood);
    post.position.set(x, 1.9, 0);
    port.add(post);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), glass);
    lamp.position.set(x, 3.2, 0);
    port.add(lamp);
  }
  const light = new THREE.PointLight("#ffcf7a", 10, 40, 1.4);
  light.position.set(0, 3.5, 0);
  port.add(light);

  scene.add(port);
}
