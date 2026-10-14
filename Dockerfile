# Serveur de jeu (Colyseus) en conteneur, pour Railway ou tout hébergeur Docker.
# Render ne s'en sert pas : render.yaml impose le runtime Node.
# Le client n'est pas construit ici (il est publié sur GitHub Pages) ; le serveur lit le TypeScript via tsx.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Manifestes d'abord : l'installation reste en cache tant que les dépendances ne changent pas.
# npm ci exige le package.json de chaque espace de travail, client compris.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --no-audit --no-fund

COPY shared shared
COPY server server

# L'hébergeur fournit le port dans PORT (2567 par défaut, voir server/src/index.ts).
EXPOSE 2567
CMD ["npm", "start"]
