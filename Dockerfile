# Image de développement commune au serveur et au client.
FROM node:24-alpine AS dev
WORKDIR /app

# 1. On copie d'abord uniquement les package.json : tant qu'ils ne changent pas,
#    Docker réutilise le cache et ne refait pas le "npm ci" (beaucoup plus rapide).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci

# 2. Puis le code source.
COPY tsconfig.base.json ./
COPY packages ./packages
