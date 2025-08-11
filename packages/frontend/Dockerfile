# 1. Base Image
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Install pnpm
RUN npm install -g pnpm

# 4. Copy root dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 5. Copy app-specific dependency files
COPY packages/frontend/package.json ./packages/frontend/

# 6. Install all dependencies for the workspace
RUN pnpm install

# 7. Copy source code for the app
COPY packages/frontend/ ./packages/frontend/

# 8. Change to the app directory
WORKDIR /app/packages/frontend

# 9. Expose port
EXPOSE 3000

# 10. Start dev server
# The actual command is specified in docker-compose.yml