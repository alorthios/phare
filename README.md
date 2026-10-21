# Phare & Constel

Jeu coopératif à 2 joueurs, dans le navigateur, autour d'une radio talkie-walkie et de la navigation aux étoiles.

- **Le Capitaine** (vue à la première personne) barre un navire perdu dans la brume. Il ne dispose d'aucune carte, seulement le ciel, des sons et sa radio.
- **Le Gardien du Phare** (vue de la tour) possède la carte de l'archipel. Il doit déduire où se trouve le bateau et le guider avec son projecteur.

Un seul joueur peut parler à la fois (Push-to-Talk). Plus le bateau s'éloigne de la lumière, plus la radio grésille.

Ambiance : nocturne, poétique et cozy. Pas de mort, pas de monstre, seulement de la coopération.

## État du projet

⛵ **Jalon 3 terminé** : le Capitaine navigue en 3D (physique calculée par le serveur), le Gardien suit le bateau sur sa carte, et la radio fonctionne pendant la navigation.
Prochaine étape : **Jalon 4 · L'archipel procédural** de la [feuille de route](docs/04-roadmap-mvp.md).

## Commandes en jeu

| Touche | Capitaine | Gardien |
|---|---|---|
| Clic sur la vue | prendre la barre (la souris regarde autour) | — |
| Z / S (ou ↑ / ↓) | télégraphe de la machine + / − | — |
| Q / D (ou ← / →) | barre à gauche / à droite (maintenir) | — |
| Espace (maintenir) | parler à la radio | parler à la radio |
| Échap | libérer la souris | — |

## Lancer le projet

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/) **démarré**.

```bash
docker compose up --build --watch
```

Ouvre ensuite **https://localhost:5173**. Le navigateur affiche un avertissement de sécurité, car le certificat est auto-signé : clique sur *Paramètres avancés*, puis *Continuer*.
La page doit afficher « Serveur : connecté ✔ ». Depuis un autre PC du réseau local : `https://<IP de ton PC>:5173` (voir le [guide](docs/00-guide-debutant.md#4-jouer-en-réseau-local--le-piège-du-micro)).
Quand tu sauvegardes un fichier dans `packages/`, il est recopié dans le conteneur et l'application se recharge toute seule.
Pour arrêter, tape `Ctrl + C`, puis `docker compose down`.

| Commande | Effet |
|---|---|
| `docker compose up --build --watch` | lance serveur et client (port 5173) dans Docker, avec rechargement automatique |
| `docker compose down` | arrête et supprime les conteneurs |
| `docker compose logs -f server` | affiche les messages du serveur |

Sans Docker, si Node.js 24 est installé : `npm install` puis `npm run dev`. `npm run typecheck` vérifie les types TypeScript.

## Organisation du code

```
packages/
├─ shared/   code commun client + serveur : rôles, état synchronisé (schema),
│            physique du bateau (boat.ts), hasard reproductible (rng.ts)
├─ server/   serveur de jeu Colyseus : rooms/NightRoom.ts = une partie à 2
└─ client/   le jeu dans le navigateur (Vite)
             net/ = connexion + interpolation, ui/ = écrans et HUD,
             radio/ = micro, WebRTC, Push-to-Talk, effets sonores,
             captain/ = vue 3D du Capitaine (Three.js), keeper/ = carte du Gardien
```

## Documentation

| Doc | Contenu |
|---|---|
| [00 · Guide débutant](docs/00-guide-debutant.md) | Outils à installer, Git au quotidien, jouer en réseau local |
| [01 · Architecture](docs/01-architecture.md) | Vue d'ensemble technique, réseau, radio Push-to-Talk, audio |
| [02 · Scripts clés](docs/02-scripts-cles.md) | Brouillard et projecteur, étoiles et déduction (structures de données + code) |
| [03 · Génération procédurale](docs/03-generation-procedurale.md) | Labyrinthe maritime, côtes, récifs, balises, seed |
| [04 · Feuille de route MVP](docs/04-roadmap-mvp.md) | Les jalons jusqu'au premier prototype jouable à 2 |

## Stack technique (prévue)

- **Client :** TypeScript, [Vite](https://vitejs.dev), [Three.js](https://threejs.org), Web Audio API, WebRTC
- **Serveur :** Node.js et [Colyseus](https://colyseus.io) (salles multijoueur)
- **Code partagé :** génération procédurale déterministe à partir d'un *seed*
- **Lancement :** `npm` en développement, Docker Compose pour une partie en réseau local

## Cible actuelle

- Navigateur de bureau (Chrome, Edge ou Firefox), clavier et souris
- Deux PC sur le **même réseau local**
