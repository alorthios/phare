# Phare & Constel

Jeu coopératif à 2 joueurs, dans le navigateur, autour d'une radio talkie-walkie et de la navigation aux étoiles.

- **Le Capitaine** (vue à la première personne) barre un navire perdu dans la brume. Il ne dispose d'aucune carte, seulement le ciel, des sons et sa radio.
- **Le Gardien du Phare** (vue de la tour) possède la carte de l'archipel. Il doit déduire où se trouve le bateau et le guider avec son projecteur.

Un seul joueur peut parler à la fois (Push-to-Talk). Plus le bateau s'éloigne de la lumière, plus la radio grésille.

Ambiance : nocturne, poétique et cozy. Pas de mort, pas de monstre, seulement de la coopération.

## État du projet

📐 **Phase de conception.** La documentation est écrite, le code n'a pas encore commencé.
Prochaine étape : **Jalon 0** de la [feuille de route](docs/04-roadmap-mvp.md).

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
