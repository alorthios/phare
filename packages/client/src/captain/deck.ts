import * as THREE from "three";

/**
 * Le navire en boîtes simples (style low-poly, provisoire).
 * Repère local : l'avant (la proue) est vers -Z, la barre est à l'arrière (+Z).
 */
export function createBoat() {
  const boat = new THREE.Group();

  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.9, flatShading: true });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#3d2a1d", roughness: 0.9, flatShading: true });
  const brass = new THREE.MeshStandardMaterial({ color: "#c9a65a", metalness: 0.6, roughness: 0.4 });

  // Coque et pont
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), darkWood);
  hull.position.y = 0.2;
  boat.add(hull);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 9.8), wood);
  deck.position.y = 1.05;
  boat.add(deck);

  // Proue pointue : un « cylindre » à 3 côtés est un prisme triangulaire ; on tourne sa pointe vers l'avant (-Z).
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.6, 3, 1), darkWood);
  bow.rotation.y = Math.PI;
  bow.scale.set(1, 1, 1.4);
  bow.position.set(0, 0.2, -5.6);
  boat.add(bow);

  // Bastingage (garde-corps)
  const railGeo = new THREE.BoxGeometry(0.12, 0.12, 9.6);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, wood);
    rail.position.set(side * 1.9, 1.95, 0);
    boat.add(rail);
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood);
      post.position.set(side * 1.9, 1.5, -4.5 + i * 1.5);
      boat.add(post);
    }
  }

  // Mât à l'avant, avec une lanterne chaude
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), wood);
  mast.position.set(0, 3.5, -3.5);
  boat.add(mast);
  const lanternGlass = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshBasicMaterial({ color: "#ffd98a" }),
  );
  lanternGlass.position.set(0, 4.2, -3.3);
  boat.add(lanternGlass);
  const lantern = new THREE.PointLight("#ffcf7a", 6, 18, 1.6);
  lantern.position.copy(lanternGlass.position);
  boat.add(lantern);

  // Barre à roue, devant le Capitaine
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 16), brass));
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.15, 0.035), wood);
    spoke.rotation.z = (i * Math.PI) / 8;
    wheel.add(spoke);
  }
  wheel.position.set(0, 1.75, 2.5);
  boat.add(wheel);

  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), wood);
  pedestal.position.set(0, 1.45, 2.65);
  boat.add(pedestal);

  // Habitacle de la boussole, à côté de la barre
  const binnacle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.9, 8), brass);
  binnacle.position.set(0.8, 1.55, 2.5);
  boat.add(binnacle);

  return {
    group: boat,
    /** Place de l'œil du Capitaine, derrière la barre. */
    eye: new THREE.Vector3(0, 2.9, 3.7),
    /** Tourne la barre selon sa position (-1 … 1). */
    setRudder(rudder: number) {
      wheel.rotation.z = -rudder * Math.PI * 1.5;
    },
  };
}
