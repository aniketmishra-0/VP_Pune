# Hugging Face Spaces (Docker SDK) — Node/Express + Vite SPA
FROM node:20-slim

# Non-root user (Hugging Face runs Spaces as uid 1000)
RUN useradd -m -u 1000 user

WORKDIR /app

# Install dependencies (incl. dev deps needed for the build)
COPY package*.json ./
RUN npm ci

# Copy source and build the client bundle + server bundle
COPY . .
RUN npm run build

# Make the working dir writable for the runtime user (local JSON cache, etc.)
RUN chown -R user:user /app

ENV NODE_ENV=production \
    PORT=7860 \
    HOME=/home/user

USER user

EXPOSE 7860

CMD ["node", "dist/server.cjs"]
