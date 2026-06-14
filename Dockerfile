# Hugging Face Spaces (Docker SDK) — Node/Express + Vite SPA
# The official node image already ships a "node" user at UID 1000 (what HF expects).
FROM node:20-slim

WORKDIR /app

# Install dependencies (incl. dev deps needed for the build)
COPY package*.json ./
RUN npm ci

# Copy source and build the client bundle + server bundle
COPY . .
RUN npm run build

# Make the working dir writable for the runtime user (local JSON cache, etc.)
RUN chown -R node:node /app

ENV NODE_ENV=production \
    PORT=7860 \
    HOME=/home/node

USER node

EXPOSE 7860

CMD ["node", "dist/server.cjs"]
