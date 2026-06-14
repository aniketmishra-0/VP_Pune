# Use official Node.js runtime as parent image
FROM node:20-slim

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build Vite frontend and esbuild server backend
RUN npm run build

# Expose port (Hugging Face expects port 7860 by default)
EXPOSE 7860

# Set environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Run the app
CMD ["node", "dist/server.cjs"]
