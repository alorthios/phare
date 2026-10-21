# 04 · Feuille de route MVP

**MVP = la plus petite version où deux personnes passent une vraie nuit ensemble :** le Capitaine part de l'entrée de la baie, se repère grâce aux étoiles, le Gardien le trouve et l'éclaire, et ils atteignent le Port en se parlant par la radio.

**Principe :** chaque jalon se termine par **quelque chose qu'on peut tester**. On commence par ce qui est **le plus risqué et le plus original**, c'est-à-dire la radio. Les graphismes viennent tard : des cubes et des couleurs unies suffisent longtemps.

> Légende : ☐ à faire · ✅ fait. Coche au fur et à mesure dans ce fichier (et commit !).

---

## Jalon 0 · Fondations

- ✅ Installer Node.js 24 LTS (VS Code : à installer de ton côté, voir [guide débutant](00-guide-debutant.md))
- ✅ Créer le monorepo : `packages/shared`, `packages/server`, `packages/client` (npm workspaces + TypeScript)
- ✅ Client Vite qui affiche « Phare & Constel » sur fond bleu nuit
- ✅ Serveur Node qui écrit « serveur prêt » dans le terminal (et répond sur `/api/health`)
- ✅ Un seul `npm run dev` lance les deux
- ✅ Tout tourne dans Docker : `docker compose up --build --watch`, avec rechargement automatique

**C'est fini quand :** `docker compose up --build --watch`, puis ouvrir https://localhost:5173, affiche « Serveur : connecté ✔ ».

## Jalon 1 · La salle à deux

- ✅ Serveur Colyseus 0.18 avec une salle `NightRoom` limitée à 2 joueurs (`packages/server/src/rooms/NightRoom.ts`)
- ✅ Écran d'accueil : « Créer une partie » (génère un code à 4 lettres, qui sert d'identifiant de salle) / « Rejoindre » (saisie du code)
- ✅ Choix du rôle : Capitaine ou Gardien (un seul de chaque, vérifié par le serveur)
- ✅ Afficher « Ton coéquipier est connecté ✔ »
- ✅ HTTPS local (`@vitejs/plugin-basic-ssl`) et proxy `/colyseus` (WebSocket compris) dans Vite

**C'est fini quand :** deux onglets, ou deux PC du réseau local, se retrouvent dans la même salle avec des rôles différents.

## Jalon 2 · La radio ⭐ (cœur du jeu)

- ✅ Capture du micro (`getUserMedia`) au clic sur « 📻 Allumer la radio », avec des messages d'erreur clairs
- ✅ Connexion WebRTC entre les deux joueurs (messages de *signaling* relayés par la `NightRoom`, le Capitaine initie)
- ✅ Push-to-Talk sur **[Espace]** ou bouton : `ptt_request` → le serveur accorde → piste activée (30 s max)
- ✅ Semi-duplex : si l'autre parle, mon appui donne un « bip occupé »
- ✅ Chaîne DSP sur la voix reçue (passe-haut, passe-bas, saturation, bruit rose, crépitements), dans `client/src/radio/receiver.ts`
- ✅ **Curseur de debug** « qualité du signal », synchronisé entre les deux joueurs
- ✅ Sons de squelch (début et fin d'émission), voyant « EN ÉMISSION / RÉCEPTION », vumètre du micro
- ✅ Test à deux : liaison établie, voix et effets OK

**C'est fini quand :** on se parle d'un PC à l'autre à tour de rôle, et le curseur fait passer la voix de claire à « radio lointaine », et ça sonne bien.

## Jalon 3 · Le bateau sur l'eau

- ✅ Scène Three.js du Capitaine : mer low-poly animée, ciel étoilé, pont et barre à roue, caméra FPS (souris + *pointer lock*)
- ✅ Commandes : **Q/D** (maintenir) pour la barre, **Z/S** pour le télégraphe à 5 crans, ou les flèches. On lit `event.code`, donc ZQSD en AZERTY et WASD en QWERTY sans réglage
- ✅ Physique du bateau (inertie, giration seulement en mouvement) dans `shared/src/boat.ts`, exécutée **par le serveur** (20 ticks/s)
- ✅ Le client interpole la position reçue (100 ms de retard, `client/src/net/boatInterpolator.ts`)
- ✅ Vue du Gardien provisoire : carte 2D avec le bateau, son cap et son sillage
- ✅ Monde de test (bouées et rochers, sans collisions) généré à partir du seed, identique chez les deux joueurs
- ✅ La radio reste disponible en surimpression pendant la navigation

> Repère du monde : **+X = est, −Z = nord**. Le cap est mesuré dans le sens horaire depuis le nord (0 = N, π/2 = E). Sur la carte du Gardien, le nord est en haut.

**C'est fini quand :** le Capitaine navigue, et le Gardien voit le point bouger en même temps.

## Jalon 4 · L'archipel procédural

- ✅ `rng.ts` + `carveMaze` + braiding + entrée et port, dans `packages/shared/src/levelgen/` (voir [doc 03](03-generation-procedurale.md))
- ✅ Page **`/debug/levelgen`** : carte 2D, champ seed, ← → pour feuilleter, chemin le plus court, zone navigable
- ✅ Champ « eau » : tuiles lissées + **déformation du domaine** (couloirs sinueux) + bruit fin (rivages découpés)
- ✅ Chenal d'entrée rectiligne, grille de collision (rayon du bateau), vérification de navigabilité. En cas d'échec, on recommence avec seed + 1 : environ 1,2 essai en moyenne, 0 départ bloqué sur 300 archipels testés
- ✅ Terrain 3D chez le Capitaine (plages, herbe, collines low-poly), bouées d'entrée, ponton éclairé au port
- ✅ Collisions côté serveur : le centre et la proue doivent rester en eau navigable, sinon léger rebond
- ✅ **Carte du Gardien** avec la grille A–F / 1–6 et le secteur du bateau (vue de la table en 3D au jalon 5)
- ✅ Seed transmis en entier 32 bits exact (`t.uint32()`) : avec `t.number()`, il était arrondi et le client générait un autre monde

> ⚠️ `levelgen/` ne doit utiliser que de l'arithmétique simple : pas de `Math.random`, ni de `Math.sin`, `cos`, `exp` ou `hypot`. Leurs derniers chiffres peuvent varier d'un moteur JavaScript à l'autre, et les deux joueurs n'auraient alors plus le même archipel.

**C'est fini quand :** chaque nouvelle partie donne un archipel différent, identique chez les deux joueurs, et on ne peut pas traverser la terre.

## Jalon 5 · Le phare et la brume

- ☐ Scène du Gardien en 3D : sommet de la tour, table avec la carte, projecteur
- ☐ Contrôle du faisceau à la souris : glisser pour le `yaw`, molette pour la portée (`pitch`)
- ☐ `shared/beam.ts` : calcul de `signalQuality` par le serveur, **qui remplace le curseur de debug**
- ☐ Shader de brouillard + `applyPhareFog` sur tous les matériaux du Capitaine
- ☐ Le rayon visible (cône additif)
- ☐ **Le Gardien ne voit pas le bateau** sur sa carte. Il ne le voit que s'il est dans le faisceau (une silhouette apparaît alors)

**C'est fini quand :** dans la brume, le Capitaine ne voit rien ; quand le Gardien braque le faisceau sur lui, les rochers apparaissent et la radio devient claire.

## Jalon 6 · Le ciel et les balises

- ☐ Génération des constellations + modèle `SkyModel` (voir [doc 02](02-scripts-cles.md))
- ☐ Ciel étoilé du Capitaine (dôme, étoiles en `Points`, constellations qui glissent selon la position)
- ☐ L'Étoile Polaire + le **sextant** (clic droit maintenu, lecture en degrés)
- ☐ Le **Registre** du Gardien (un livre sur la table : dessins des constellations et table des hauteurs)
- ☐ L'outil de décodage qui surligne les secteurs possibles
- ☐ 4 balises sonores spatialisées, indiquées sur la carte du Gardien

**C'est fini quand :** sans tricher, le Gardien retrouve le secteur du Capitaine uniquement grâce à ses descriptions.

## Jalon 7 · Une nuit complète 🎉 (= MVP)

- ☐ Arrivée au Port, puis écran de fin (durée de la nuit, nombre de messages radio)
- ☐ Bouton « Nuit suivante », qui lance un nouveau seed avec les mêmes joueurs
- ☐ Reconnexion si un joueur recharge la page
- ☐ Service Docker « production » (client compilé + serveur, HTTPS) : une commande pour héberger une soirée en réseau local
- ☐ Session de test avec quelqu'un qui ne connaît pas le jeu, en notant ce qui bloque

**C'est fini quand :** une personne extérieure termine une nuit et a envie d'en refaire une.

---

## Après le MVP (dans l'ordre conseillé)

1. **Filtres de couleur** rouge (courants) et bleu (hauts-fonds), avec les mécaniques associées
2. **Direction artistique :** cel-shading, palette bleu nuit et doré, mer animée, lucioles de lumière dans le faisceau
3. **Audio d'ambiance :** piano, ressac, mouettes lointaines, grincements du bateau
4. **Mémoire de la lumière** (texture de dissipation qui s'estompe lentement)
5. **Progression** des nuits (taille, mécaniques débloquées), journal de bord
6. **Jeu en ligne** : hébergement sur un VPS, serveur TURN (`coturn`), vrai certificat HTTPS
7. Accessibilité : sous-titres des balises sonores, option PTT en bascule, daltonisme pour les filtres

## Risques identifiés

| Risque | Parade |
|---|---|
| Micro bloqué sur le second PC (pas de HTTPS) | HTTPS auto-signé dès le jalon 1 |
| Voix WebRTC muette quand elle passe par Web Audio (Chrome) | élément `<audio muted>` en parallèle (voir doc 01) |
| Larsen quand on teste sur un seul PC | casque, plus `echoCancellation: true` dans `getUserMedia` |
| Brouillard trop sombre ou trop clair | uniforms réglables depuis un petit panneau de debug ([lil-gui](https://lil-gui.georgealways.com/)) |
| Déduction trop dure ou trop facile | paramètres centralisés (`DEFAULT_PARAMS`), tests avec de vrais joueurs |
| Se décourager sur un gros morceau | jalons courts, commits fréquents, « laid mais jouable » d'abord |
