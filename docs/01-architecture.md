# 01 · Architecture technique

## Pourquoi le web (et pas Unity)

| Critère | Unity + Photon/Vivox | **Web (choisi)** |
|---|---|---|
| Voix temps réel | SDK tiers, quotas, comptes | **WebRTC** natif et gratuit |
| Effets sur la voix reçue | FMOD + intégration du flux voix, complexe | **Web Audio API** : on branche des filtres sur le flux |
| Lancer une partie | Build à installer | Ouvrir une URL |
| Brouillard dissipé | Natif en HDRP | Shader maison, adapté au style low-poly / cel-shading |

> On n'a pas besoin d'un vrai brouillard volumétrique physique. Un brouillard calculé dans le shader de chaque objet, puis « troué » par le cône du phare, donne l'effet recherché avec de bonnes performances.

## Vue d'ensemble

```
┌────────── Navigateur : CAPITAINE ──────────┐        ┌────────── Navigateur : GARDIEN ───────────┐
│ Three.js : pont, mer, ciel, brouillard     │        │ Three.js : tour, carte, projecteur        │
│ Clavier/souris → commandes (barre, gaz)    │        │ Souris → orientation faisceau, filtres    │
│ Radio : micro ⇄ WebRTC ⇄ DSP               │        │ Radio : micro ⇄ WebRTC ⇄ DSP              │
└───────┬───────────────────────┬────────────┘        └──────┬───────────────────────┬────────────┘
        │ WebSocket (Colyseus)  │◄──── audio WebRTC P2P ────►│                       │
        ▼                       └────────────────────────────┘                       ▼
┌──────────────────────────────── SERVEUR (Node + Colyseus) ──────────────────────────────────────┐
│ GameRoom (1 salle = 1 partie à 2)                                                               │
│  • tire le seed de la nuit, génère le niveau (même code que le client)                           │
│  • simule le bateau (20 fois/s) et gère les collisions avec les côtes                            │
│  • arbitre la radio : qui a la parole (floorHolder)                                              │
│  • calcule signalQuality (bateau dans le faisceau ?)                                             │
│  • relaie les messages d'établissement WebRTC (« signaling »)                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

En réseau local, **aucun serveur TURN n'est nécessaire** : WebRTC relie directement les deux PC. Pour jouer en ligne plus tard, on ajoutera un conteneur `coturn`.

## Organisation du dépôt (monorepo npm workspaces)

```
phare/
├─ packages/
│  ├─ shared/        # code utilisé par le client ET le serveur
│  │  ├─ rng.ts            # générateur aléatoire déterministe (seed)
│  │  ├─ levelgen/         # labyrinthe, côtes, balises, ciel
│  │  ├─ boatPhysics.ts    # mouvement du bateau
│  │  ├─ beam.ts           # test « point dans le faisceau ? »
│  │  └─ messages.ts       # types des messages réseau
│  ├─ server/        # Node + Colyseus
│  │  └─ rooms/GameRoom.ts
│  └─ client/        # Vite + Three.js
│     ├─ net/              # connexion Colyseus, WebRTC
│     ├─ radio/            # PTT, chaîne DSP
│     ├─ captain/          # scène du Capitaine
│     ├─ keeper/           # scène du Gardien
│     └─ shaders/          # brouillard, cel-shading, faisceau
├─ docs/
├─ docker-compose.yml
└─ package.json
```

**Règle d'or :** tout ce qui doit donner le **même résultat** sur les deux machines (génération, physique, test du faisceau) va dans `shared/`.

## Ce qui circule sur le réseau

Grâce au seed, **le monde n'est jamais envoyé**. Seuls de petits messages circulent :

| Message | Sens | Fréquence |
|---|---|---|
| `input { rudder, throttle }` | Capitaine → serveur | à chaque changement |
| `beam { yaw, pitch, filter }` | Gardien → serveur | ~15/s pendant qu'il bouge |
| état `boat { x, z, heading, speed }` | serveur → tous | 20/s |
| état `signalQuality` (0 → 1) | serveur → tous | 20/s |
| `ptt_request` / `ptt_release` | joueur → serveur | à l'appui/relâchement |
| état `floorHolder` | serveur → tous | à chaque changement |
| `rtc_signal { sdp/ice }` | joueur → serveur → autre joueur | au démarrage |

**Le serveur fait autorité.** Le Capitaine envoie des *intentions* (barre à gauche) et non une position. Il ne peut donc pas « tricher » en traversant les rochers.

**Asymétrie de l'information.** La carte n'est affichée que chez le Gardien. Le seed est connu des deux clients, mais le jeu reste coopératif : le risque de triche est faible, et on ne cherche pas à le bloquer pour le MVP.

## La radio Push-to-Talk semi-duplex

### Arbitrage : un seul émetteur à la fois

Le serveur garde une seule variable :

```ts
floorHolder: "" | "captain" | "keeper"   // "" = canal libre
```

```
Joueur appuie sur [ESPACE] ──► ptt_request ──► serveur
                                              │ canal libre ?
                                   oui ◄──────┴──────► non
               floorHolder = joueur              le client joue un « bip occupé »
               (diffusé à tous)
Client voit floorHolder == moi ──► active sa piste micro (track.enabled = true)
Joueur relâche ──► coupe sa piste immédiatement + ptt_release ──► floorHolder = ""
```

- Le micro est capturé une seule fois au début (`getUserMedia`), puis la piste reste **coupée** (`enabled = false`). Elle n'est activée **qu'après confirmation du serveur**. Même avec de la latence, deux joueurs ne peuvent jamais émettre ensemble.
- Sécurité : si un joueur se déconnecte en tenant le canal, le serveur le libère. Une émission est aussi limitée à 30 s maximum.
- Habillage sonore cozy : un *clic* et un souffle de squelch à l'ouverture et à la fermeture du canal, un voyant « EN ÉMISSION » sur le poste radio du bateau ou de la tour.

### Dégradation du signal

Le serveur calcule `signalQuality` à partir de la position du bateau et du faisceau (voir `beam.ts` dans [02 · Scripts clés](02-scripts-cles.md)) :

- `1.0` : le bateau est dans le cône de lumière ;
- de `1.0` à `0.15` : la qualité baisse avec l'écart angulaire au faisceau et la distance au phare ;
- on ne descend jamais à 0, pour que la communication reste toujours possible (c'est un jeu cozy).

**Chaque client dégrade la voix qu'il reçoit**, pas celle qu'il envoie. Le micro part propre, et c'est le haut-parleur qui grésille. Les deux joueurs entendent la même chose.

### Chaîne DSP (Web Audio API)

```
voix reçue (WebRTC)
   │
   ▼
[MediaStreamSource] → [Highpass 300 Hz] → [Lowpass f(q)] → [WaveShaper saturation(q)] → [Gain voix] ─┐
                                                                                                   ├─► [Master] → haut-parleurs
[Bruit rose en boucle] → [Bandpass 2 kHz] → [Gain bruit g(q)] ─────────────────────────────────────┘
[Crépitements aléatoires] ────────────────────────────────────────────────────────────────────────┘
```

| Paramètre | Signal parfait (q=1) | Signal faible (q=0.15) |
|---|---|---|
| Fréquence de coupure du lowpass | 8000 Hz | 900 Hz |
| Saturation | 0 | légère |
| Volume du bruit | 0.02 (souffle à peine audible, ambiance) | 0.35 |
| Crépitements | aucun | 2 à 4 par seconde |
| Voix | 1.0 | 0.8 |

Toutes les valeurs changent avec `setTargetAtTime(valeur, now, 0.15)` : la transition est douce, sans « clic ».

> ⚠️ Piège Chrome connu : un flux WebRTC branché sur la Web Audio API peut rester muet si aucun élément `<audio>` ne le lit. Astuce : créer un `<audio muted autoplay>` avec ce flux **en plus** du `MediaStreamSource`.

### Pourquoi WebRTC et pas « la voix par le WebSocket »

On pourrait enregistrer des morceaux de voix et les envoyer au serveur, mais la latence et la qualité seraient mauvaises. WebRTC gère la compression (Opus), la gigue et l'écho. Le serveur Colyseus sert seulement d'« entremetteur » au moment de la connexion (le *signaling*).

## Boucle de jeu côté serveur (20 Hz)

```
à chaque tick (50 ms) :
  1. appliquer les inputs du Capitaine → boatPhysics.step(boat, input, dt, collisionGrid)
  2. si courant marin sous le bateau → ajouter la dérive
  3. signalQuality = beam.quality(boat, beamState, lighthouse)
  4. tester les balises proches → événements sonores (le client joue le son en 3D)
  5. si bateau dans la zone du Port → état "arrived" → fin de nuit
```

Les clients **interpolent** entre deux états reçus (affichage à 60 images/s), ce qui donne un mouvement fluide malgré seulement 20 mises à jour par seconde.

## Docker

- **En développement :** pas de Docker. On lance `npm run dev`, qui démarre le serveur et Vite en même temps, avec rechargement automatique.
- **Pour une soirée de jeu en réseau local :** `docker compose up`, qui lance un conteneur `server` servant aussi les fichiers du client déjà compilés, en HTTPS.
- **Plus tard, en ligne :** ajout d'un conteneur `coturn` et d'un vrai certificat.
