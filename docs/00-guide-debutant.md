# 00 · Guide débutant

Ce guide couvre tout ce qu'il faut installer et comprendre avant d'écrire la première ligne de code.

## 1. Outils à installer

| Outil | Pourquoi | Où |
|---|---|---|
| **Node.js 24 LTS** | Exécute le serveur et les outils du client (Vite) | https://nodejs.org (bouton « LTS ») |
| **Git** | Historique du code, envoi sur GitHub | déjà installé ✅ |
| **VS Code** | Éditeur de code | https://code.visualstudio.com |
| **Docker Desktop** | **Fait tourner le jeu** (serveur + client) dans des conteneurs | déjà installé ✅ |
| **Chrome ou Edge** | Navigateur de test (bons outils de debug WebRTC/audio) | — |

Extensions VS Code conseillées : *ESLint*, *Prettier*, *Shader languages support* (coloration GLSL).

Pour vérifier l'installation, ouvre un terminal :

```bash
node -v    # doit afficher v24.x
npm -v
git --version
```

## 2. Le vocabulaire en 2 minutes

- **Client :** le code qui tourne dans le navigateur de chaque joueur (affichage 3D, son, clavier).
- **Serveur :** un programme Node.js qui tourne sur l'un des PC. Il est **l'arbitre** : il décide où est le bateau, qui a la parole, etc.
- **WebSocket :** un tuyau toujours ouvert entre le client et le serveur, qui transporte de petits messages (« j'appuie sur la barre à gauche »).
- **WebRTC :** la technologie du navigateur qui envoie **la voix** directement d'un joueur à l'autre.
- **Seed (graine) :** un nombre qui sert de point de départ au hasard. Avec le même seed, on obtient toujours le même labyrinthe. C'est ainsi que les deux joueurs voient le même monde sans l'envoyer par le réseau.
- **Shader :** un petit programme qui tourne sur la carte graphique et calcule la couleur de chaque pixel. C'est lui qui fera le brouillard.
- **Monorepo :** un seul dépôt Git qui contient plusieurs « paquets » (client, serveur, partagé).

## 3. Git au quotidien

Le dépôt : https://github.com/alorthios/phare

```bash
# Récupérer le projet sur un nouveau PC
git clone https://github.com/alorthios/phare.git
cd phare

# Routine de travail
git status                       # qu'est-ce qui a changé ?
git add .                        # préparer tous les changements
git commit -m "Radio : bouton PTT fonctionnel"
git push                         # envoyer sur GitHub

# Récupérer les changements faits ailleurs
git pull
```

Bonnes habitudes :
- **Un commit = une petite étape qui fonctionne.** Mieux vaut 10 petits commits qu'un gros.
- Un message de commit clair, au présent : « Ajoute le filtre low-pass sur la radio ».
- Avant d'essayer une idée risquée, crée une branche : `git switch -c essai-brouillard`. Si ça ne marche pas, tu reviens avec `git switch main`.

## 4. Jouer en réseau local : le piège du micro

Les navigateurs **n'autorisent le micro que sur une page sécurisée** : `https://…` ou `http://localhost`.

- Sur **ton** PC, `http://localhost:5173` fonctionne.
- Sur le **second** PC, `http://192.168.1.42:5173` **ne donnera pas accès au micro**.

Solution prévue : servir le jeu en **HTTPS avec un certificat auto-signé** (plugin `@vitejs/plugin-basic-ssl` de Vite).
Au premier accès, le navigateur affiche « Votre connexion n'est pas privée ». On clique sur *Paramètres avancés*, puis *Continuer*. C'est normal sur un réseau local.

Pour trouver l'adresse IP de ton PC (Windows) :

```powershell
ipconfig   # cherche "Adresse IPv4" de ta carte Wi-Fi/Ethernet, ex: 192.168.1.42
```

Le pare-feu Windows demandera peut-être d'autoriser Node.js sur le réseau **privé** : accepte.

## 5. Comment tester seul à deux joueurs

Pendant le développement, **deux onglets sur le même PC** suffisent dans la plupart des cas :
un onglet Capitaine, un onglet Gardien. Pour la radio, un casque évite l'effet larsen.
Pour un vrai test, le second PC ou un ordinateur portable rejoint la partie via l'IP locale.
