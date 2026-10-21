# 02 · Scripts clés

Les extraits ci-dessous sont en **TypeScript** (client et serveur) et en **GLSL** (shaders). Ce sont des **squelettes commentés** : ils montrent la structure et la logique, et seront complétés au fil des jalons.

---

## A. Le faisceau du phare (`shared/beam.ts`)

Ce module est utilisé par le **serveur** (qualité radio) et par le **client** (affichage). Pour que le gameplay reste lisible, on raisonne **en 2D, vu du dessus** (plan X/Z) :

- `yaw` : direction du faisceau (0 = nord, en radians) ;
- `pitch` : inclinaison. Plus le faisceau est relevé, plus il porte loin, c'est le « réglage de portée » du Gardien.

```ts
// packages/shared/src/beam.ts
export type LightFilter = "white" | "red" | "blue";

export interface BeamState {
  yaw: number;        // radians, 0 = +Z (nord)
  pitch: number;      // radians, négatif = vers la mer
  filter: LightFilter;
}

export interface Vec2 { x: number; z: number; }

export const BEAM = {
  halfAngle: (7 * Math.PI) / 180,      // demi-ouverture du cône (zone 100 % claire)
  falloffAngle: (25 * Math.PI) / 180,  // au-delà, la radio se dégrade progressivement
  minPitch: (-20 * Math.PI) / 180,     // braqué au pied du phare
  maxPitch: (-2 * Math.PI) / 180,      // presque à l'horizon
  minRange: 60,
  maxRange: 520,
  minQuality: 0.15,                    // jamais 0 : jeu cozy
};

/** Portée du faisceau en mètres, déduite de l'inclinaison. */
export function beamRange(pitch: number): number {
  const t = (pitch - BEAM.minPitch) / (BEAM.maxPitch - BEAM.minPitch);
  return BEAM.minRange + clamp01(t) * (BEAM.maxRange - BEAM.minRange);
}

/** 0 → 1 : à quel point le point p est éclairé (1 = en plein dans le cône). */
export function beamMask(p: Vec2, lighthouse: Vec2, beam: BeamState): number {
  const dx = p.x - lighthouse.x;
  const dz = p.z - lighthouse.z;
  const dist = Math.hypot(dx, dz);
  const range = beamRange(beam.pitch);
  if (dist > range) return 0;

  const angleToPoint = Math.atan2(dx, dz);
  const delta = Math.abs(wrapAngle(angleToPoint - beam.yaw));
  const cone = 1 - smoothstep(BEAM.halfAngle, BEAM.halfAngle * 1.6, delta);
  const reach = 1 - smoothstep(range * 0.85, range, dist);
  return cone * reach;
}

/** Qualité radio : 1 dans le faisceau, décroît avec l'écart angulaire. */
export function signalQuality(boat: Vec2, lighthouse: Vec2, beam: BeamState): number {
  if (beamMask(boat, lighthouse, beam) > 0.5) return 1;

  const dx = boat.x - lighthouse.x, dz = boat.z - lighthouse.z;
  const delta = Math.abs(wrapAngle(Math.atan2(dx, dz) - beam.yaw));
  const t = smoothstep(BEAM.halfAngle, BEAM.halfAngle + BEAM.falloffAngle, delta);
  return lerp(1, BEAM.minQuality, t);
}

// --- petits utilitaires ---
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export function wrapAngle(a: number) {           // ramène dans [-π, π]
  return Math.atan2(Math.sin(a), Math.cos(a));
}
```

> 💡 La même fonction `beamMask` existe en GLSL dans le shader. Si on change une valeur, on la change **aux deux endroits** (ou on envoie les constantes au shader via des *uniforms*, c'est ce qu'on fait plus bas).

---

## B. Brouillard dissipé par le projecteur (shader)

### Principe

Pour chaque pixel d'un objet (mer, rochers, îles) :

1. on calcule **l'épaisseur de brouillard** selon la distance à la caméra : c'est très dense, et on ne voit qu'à quelques mètres ;
2. on calcule **`beamMask`** à la position de ce pixel dans le monde ;
3. là où le faisceau éclaire, on **retire** le brouillard et on ajoute une teinte dorée ;
4. un petit **halo** autour du bateau (sa lanterne de pont) permet de toujours voir le pont et l'eau juste devant.

On n'a pas de vrai volume de brouillard, et c'est voulu : c'est léger, stylisé et rapide.

### Uniforms partagés (`client/shaders/fogUniforms.ts`)

Un seul objet d'uniforms partagé par **tous** les matériaux. Quand le Gardien bouge le faisceau, on met à jour cet objet une fois, et tout le décor suit.

```ts
import * as THREE from "three";

export const fogUniforms = {
  uLighthousePos:  { value: new THREE.Vector2(0, 0) },  // x, z
  uBeamDir:        { value: new THREE.Vector2(0, 1) },  // direction normalisée (x, z)
  uBeamCosInner:   { value: Math.cos((7 * Math.PI) / 180) },
  uBeamCosOuter:   { value: Math.cos((11 * Math.PI) / 180) },
  uBeamRange:      { value: 300 },
  uBeamColor:      { value: new THREE.Color("#ffd98a") },  // doré
  uFogColor:       { value: new THREE.Color("#0b1630") },  // bleu nuit
  uFogDensity:     { value: 0.09 },                        // ~10-15 m de visibilité
  uBoatPos:        { value: new THREE.Vector2(0, 0) },
  uLanternRadius:  { value: 9 },
};

export function updateBeamUniforms(beam: { yaw: number; pitch: number }, range: number) {
  fogUniforms.uBeamDir.value.set(Math.sin(beam.yaw), Math.cos(beam.yaw));
  fogUniforms.uBeamRange.value = range;
}
```

### Injection dans les matériaux Three.js (`client/shaders/applyPhareFog.ts`)

On garde les matériaux standards de Three.js (`MeshToonMaterial` pour le cel-shading) et on **remplace** leurs morceaux de code de brouillard grâce à `onBeforeCompile`.

```ts
import * as THREE from "three";
import { fogUniforms } from "./fogUniforms";

const FOG_PARS_VERTEX = /* glsl */ `
  varying vec3 vFogWorldPos;
  varying float vFogDepth;
`;
const FOG_VERTEX = /* glsl */ `
  vFogWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vFogDepth = -mvPosition.z;
`;
const FOG_PARS_FRAGMENT = /* glsl */ `
  uniform vec2  uLighthousePos;
  uniform vec2  uBeamDir;
  uniform float uBeamCosInner;
  uniform float uBeamCosOuter;
  uniform float uBeamRange;
  uniform vec3  uBeamColor;
  uniform vec3  uFogColor;
  uniform float uFogDensity;
  uniform vec2  uBoatPos;
  uniform float uLanternRadius;
  varying vec3  vFogWorldPos;
  varying float vFogDepth;

  float beamMask(vec2 p) {
    vec2 toP = p - uLighthousePos;
    float d = length(toP);
    float cosA = dot(toP / max(d, 0.001), uBeamDir);
    float cone  = smoothstep(uBeamCosOuter, uBeamCosInner, cosA);
    float reach = 1.0 - smoothstep(uBeamRange * 0.85, uBeamRange, d);
    return cone * reach;
  }
`;
const FOG_FRAGMENT = /* glsl */ `
  // 1. brouillard ambiant (exponentiel au carré : très opaque au-delà de quelques mètres)
  float fogAmount = 1.0 - exp(-pow(uFogDensity * vFogDepth, 2.0));

  // 2. le faisceau perce le brouillard
  float lit = beamMask(vFogWorldPos.xz);
  fogAmount *= 1.0 - 0.93 * lit;

  // 3. halo de la lanterne du bateau
  float lantern = 1.0 - smoothstep(uLanternRadius * 0.6, uLanternRadius, distance(vFogWorldPos.xz, uBoatPos));
  fogAmount *= 1.0 - 0.8 * lantern;

  gl_FragColor.rgb += uBeamColor * lit * 0.25;           // reflet doré
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(fogAmount, 0.0, 1.0));
`;

export function applyPhareFog(material: THREE.Material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fogUniforms);   // mêmes objets → mise à jour globale
    shader.vertexShader = shader.vertexShader
      .replace("#include <fog_pars_vertex>", FOG_PARS_VERTEX)
      .replace("#include <fog_vertex>", FOG_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <fog_pars_fragment>", FOG_PARS_FRAGMENT)
      .replace("#include <fog_fragment>", FOG_FRAGMENT);
  };
  return material;
}

// Utilisation :
// const rockMat = applyPhareFog(new THREE.MeshToonMaterial({ color: "#3a4a63" }));
```

> ⚠️ Pour des objets *instanciés* (`InstancedMesh`, pratique pour des centaines de rochers), il faudra ajouter `instanceMatrix` dans le calcul de `vFogWorldPos`. On verra ça plus tard.

### Le rayon visible

Le shader ci-dessus éclaire **là où le faisceau touche**. Pour voir **le rayon lui-même** traverser la nuit (très important pour l'ambiance, surtout du côté du Gardien), on ajoute un mesh :

- un `ConeGeometry` long et ouvert, attaché à la lanterne du phare et orienté selon `yaw`/`pitch` ;
- un `ShaderMaterial` transparent en **blending additif**, avec une opacité qui baisse le long du cône et sur les bords (effet de Fresnel) ;
- `depthWrite: false` pour qu'il ne masque rien.

### Filtres de couleur : révéler les couches cachées

Certains éléments n'existent visuellement **que sous un filtre précis** :

| Filtre | Révèle | Mesh concerné |
|---|---|---|
| Blanc | les côtes et récifs (normal) | — |
| Rouge | les **courants marins** (flèches animées sur l'eau) | `currentsMesh` |
| Bleu | les **hauts-fonds** (zones trop peu profondes) | `shallowsMesh` |

Ces meshes utilisent un shader dont l'opacité vaut `beamMask(pos) * uFilterActive`, où `uFilterActive` vaut 1 si le bon filtre est sélectionné, et 0 sinon. Hors du faisceau ou sous le mauvais filtre, ils sont invisibles.

### Plus tard (V2) : la « mémoire » de la lumière

Pour que les zones éclairées ne retombent pas instantanément dans le noir, on pourra peindre le faisceau dans une **texture vue de dessus** (256×256 sur toute la carte) qui s'estompe lentement (×0.98 par image). Le shader lira cette texture au lieu de recalculer `beamMask`. Cela rend aussi possible de « balayer » une zone pour la révéler.

---

## C. Étoiles et déduction de position

### Le principe de jeu

On s'inspire de la **vraie navigation astronomique**, en simplifiée :

| Ce que voit le Capitaine | Ce que ça indique | Analogie réelle |
|---|---|---|
| **La constellation au zénith** (juste au-dessus de sa tête) | la **colonne** (A → F) | la longitude |
| **La hauteur de l'Étoile Polaire** au-dessus de l'horizon (mesurée au sextant) | la **ligne** (1 → 6) | la latitude |
| **Les balises sonores** entendues | confirmation, ou affinage dans le secteur | les phares et bouées réels |

Le Capitaine **ne connaît pas le nom** des constellations : il les **décrit** (« un genre de cerf-volant, 5 étoiles, une rouge en bas »).
Le Gardien dispose du **Registre** : une page par constellation avec son dessin et sa colonne, plus la table « hauteur de la Polaire → ligne ».

Tout le jeu de communication est là : décrire une forme à quelqu'un qui ne la voit pas, par une radio qui grésille.

### Structures de données (`shared/sky.ts`)

```ts
export type StarColor = "white" | "gold" | "red" | "blue";

export interface Star {
  x: number; y: number;        // position dans le dessin de la constellation (-1..1)
  magnitude: number;           // 1 = très brillante, 3 = faible
  color: StarColor;
}

export interface Constellation {
  id: string;                  // "c0".."c5"
  name: string;                // nom poétique généré : "La Lanterne Basse" (visible chez le Gardien seulement)
  stars: Star[];
  lines: [number, number][];   // indices des étoiles reliées
}

export interface SkyModel {
  constellations: Constellation[];
  zenithByColumn: string[];          // zenithByColumn[col] = id de constellation
  polarisElevationByRow: number[];   // degrés, ex: [22, 30, 38, 46, 54, 62]
}

export interface Grid {
  cols: number; rows: number;        // 6 × 6
  sectorSize: number;                // mètres
  originX: number; originZ: number;  // coin nord-ouest de la carte
}

export interface Sector { col: number; row: number; }
export const sectorLabel = (s: Sector) => `${"ABCDEFGH"[s.col]}-${s.row + 1}`;   // "C-4"

export function sectorAt(x: number, z: number, g: Grid): Sector {
  const col = Math.floor((x - g.originX) / g.sectorSize);
  const row = Math.floor((z - g.originZ) / g.sectorSize);
  return {
    col: Math.min(g.cols - 1, Math.max(0, col)),
    row: Math.min(g.rows - 1, Math.max(0, row)),
  };
}
```

### Ce que le Capitaine voit dans le ciel (`captain/skyView.ts`)

Le ciel est **continu** : en avançant vers l'est, les constellations « glissent » vers l'ouest, et la Polaire monte progressivement quand on va vers le nord. La constellation au zénith est celle de la colonne la plus proche.

```ts
const DEG_PER_METER_X = 0.25;   // décalage du ciel quand on se déplace en X

/** Position (azimut, élévation) de chaque constellation vue depuis (boatX, boatZ). */
export function visibleSky(boatX: number, boatZ: number, sky: SkyModel, g: Grid) {
  const placed = sky.zenithByColumn.map((id, col) => {
    const colCenterX = g.originX + (col + 0.5) * g.sectorSize;
    const hourAngle = (colCenterX - boatX) * DEG_PER_METER_X;     // 0° = pile au-dessus
    return {
      id,
      azimuthDeg: hourAngle >= 0 ? 90 : 270,                      // à l'est ou à l'ouest
      elevationDeg: 90 - Math.abs(hourAngle),                     // < 0 → sous l'horizon, invisible
    };
  });

  // Polaire : interpolation continue entre les lignes
  const rowF = (boatZ - g.originZ) / g.sectorSize - 0.5;
  const polarisElevationDeg = interpolate(sky.polarisElevationByRow, rowF);

  return { placed, polaris: { azimuthDeg: 0, elevationDeg: polarisElevationDeg } };
}

/** Convertit (azimut, élévation) en point sur le dôme céleste (rayon R) pour Three.js. */
export function skyToVector(azDeg: number, elDeg: number, R = 900) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return { x: R * Math.cos(el) * Math.sin(az), y: R * Math.sin(el), z: R * Math.cos(el) * Math.cos(az) };
}
```

**Le sextant** (clic droit maintenu) : la caméra zoome, une graduation s'affiche, et le Capitaine aligne la Polaire pour lire « 41° ». On arrondit l'affichage au degré, et la mesure peut osciller de ±1° avec la houle, ce qui ajoute un peu d'incertitude.

### Ce que le Gardien utilise : le Registre et la table de décodage

```ts
export interface RegisterPage {
  constellation: Constellation;   // dessin affiché
  column: number;                 // « Au zénith au-dessus de la colonne C »
}

export interface DecodeInput {
  columnGuess: number | null;            // constellation que le Gardien pense reconnaître
  polarisElevationDeg: number | null;    // valeur annoncée par le Capitaine
  beaconHeard: BeaconPattern | null;     // « une cloche toutes les 4 s »
}

/** Renvoie les secteurs compatibles : surlignés sur la carte du Gardien. */
export function candidateSectors(input: DecodeInput, sky: SkyModel, level: LevelData): Sector[] {
  const cols = input.columnGuess !== null ? [input.columnGuess] : range(level.grid.cols);
  const rows = input.polarisElevationDeg !== null
    ? nearestRows(sky.polarisElevationByRow, input.polarisElevationDeg, 4)   // tolérance ±4°
    : range(level.grid.rows);

  let result = cols.flatMap((col) => rows.map((row) => ({ col, row })));
  if (input.beaconHeard) {
    result = result.filter((s) => level.beacons.some(
      (b) => b.pattern === input.beaconHeard && isNear(b.sector, s, 1)));
  }
  return result;
}
```

Le Gardien remplit lui-même cet outil (sélection de la page du Registre, saisie des degrés). Le jeu se contente de **surligner** les secteurs possibles : **c'est lui qui déduit**. On ne donne jamais la réponse.

### Génération des constellations (dans `levelgen`, avec le seed)

1. Pour chaque colonne, on tire de 4 à 7 étoiles dans un carré (-1..1), avec une distance minimale entre elles.
2. On les relie par un **arbre couvrant minimal** (Prim), plus éventuellement une arête supplémentaire. On obtient ainsi des formes « dessinables ».
3. Une étoile reçoit une **couleur remarquable** (rouge, bleu ou or), pour donner un repère facile à décrire.
4. **Contrôle de lisibilité :** deux constellations d'une même nuit ne doivent pas avoir à la fois le même nombre d'étoiles **et** la même couleur remarquable. Sinon, on retire au sort.
5. Un nom poétique combine deux listes : « La / Le » + [Lanterne, Mouette, Ancre, Harpe…] + [Basse, du Nord, Endormie…].
