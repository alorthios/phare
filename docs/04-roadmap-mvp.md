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

**C'est fini quand :** `npm run dev`, puis ouvrir http://localhost:5173, affiche la page.

## Jalon 1 · La salle à deux

- ☐ Serveur Colyseus avec une `GameRoom` limitée à 2 joueurs
- ☐ Écran d'accueil : « Créer une partie » (génère un code à 4 lettres) / « Rejoindre » (saisie du code)
- ☐ Choix du rôle : Capitaine ou Gardien (un seul de chaque)
- ☐ Afficher « Ton coéquipier est connecté ✔ »
- ☐ Activer le HTTPS local (`@vitejs/plugin-basic-ssl`) et le proxy WebSocket dans Vite

**C'est fini quand :** deux onglets, ou deux PC du réseau local, se retrouvent dans la même salle avec des rôles différents.

## Jalon 2 · La radio ⭐ (cœur du jeu)

- ☐ Capture du micro (`getUserMedia`) avec l'écran « Autoriser le micro »
- ☐ Connexion WebRTC entre les deux joueurs (messages de *signaling* relayés par la `GameRoom`)
- ☐ Push-to-Talk sur **[Espace]** : `ptt_request` → le serveur accorde → piste activée
- ☐ Semi-duplex : si l'autre parle, mon appui donne un « bip occupé »
- ☐ Chaîne DSP sur la voix reçue (lowpass, bruit, crépitements)
- ☐ **Curseur de debug** « qualité du signal » 0 → 1, pour régler les sons à l'oreille
- ☐ Sons de squelch (début et fin d'émission) et voyant « EN ÉMISSION »

**C'est fini quand :** on se parle d'un PC à l'autre à tour de rôle, et le curseur fait passer la voix de claire à « radio lointaine », et ça sonne bien.

## Jalon 3 · Le bateau sur l'eau

- ☐ Scène Three.js du Capitaine : un plan d'eau, un pont de bateau en boîtes simples, une caméra FPS (souris pour regarder, avec *pointer lock*)
- ☐ Commandes : **Q/D** pour la barre, **Z/S** pour les gaz (clavier AZERTY, avec une option QWERTY)
- ☐ Physique du bateau dans `shared/boatPhysics.ts`, exécutée **par le serveur** (20 ticks/s)
- ☐ Le client interpole la position reçue
- ☐ Vue du Gardien provisoire : un point qui bouge sur un canvas 2D

**C'est fini quand :** le Capitaine navigue, et le Gardien voit le point bouger en même temps.

## Jalon 4 · L'archipel procédural

- ☐ `rng.ts` + `carveMaze` + braiding + entrée et port (voir [doc 03](03-generation-procedurale.md))
- ☐ Page `/debug/levelgen` : carte 2D, champ seed, bouton « Suivant »
- ☐ Champ `waterness` + bruit, grille de collision, vérification de navigabilité
- ☐ Mesh du terrain en 3D chez le Capitaine
- ☐ Collisions côté serveur (le bateau bute sur les côtes)
- ☐ **Carte du Gardien** : la vue 2D devient la carte sur sa table, avec la grille A–F / 1–6

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
- ☐ `Dockerfile` + `docker-compose.yml` : une commande pour héberger une soirée en réseau local
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
