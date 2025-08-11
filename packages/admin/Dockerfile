# 1. Base Image
FROM node:20-alpine

# 2. Set working directory
WORKDIR /app

# 3. Install pnpm
RUN npm install -g pnpm

# 4. Copy root dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 5. Copy app-specific dependency files
COPY packages/admin/package.json ./packages/admin/

# 6. Install all dependencies for the workspace
RUN pnpm install

# 7. Copy source code for the app
COPY packages/admin/ ./packages/admin/

# 8. Change to the app directory
WORKDIR /app/packages/admin

# 9. Expose port
EXPOSE 3002

# 10. Start dev server
# The actual command is specified in docker-compose.yml 