# Schlep Engine

> **Messy data to ML-Ready in API calls.**

A comprehensive data processing and ML pipeline platform built with FastAPI and Next.js. Transform unstructured data into ML-ready datasets through powerful APIs and an intuitive admin dashboard.

## Project Structure

```
schlep-engine/
├── apps/                          # Applications
│   ├── api/                       # FastAPI backend (Python) - Port 3001
│   ├── web-admin/                 # Admin dashboard (Next.js) - Port 3002
│   ├── web-landing/               # Landing page (Next.js) - Port 3000
│   └── web-docs/                  # Documentation (Next.js) - Port 3003
├── packages/                      # Shared packages
│   ├── ui/                        # Shared UI components
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Shared utilities
├── infrastructure/                # Deployment configurations
│   ├── vultr/                     # Vultr VPS deployment (Production)
│   ├── hybrid/                    # Railway + Supabase setup (Legacy)
│   └── monitoring/                # Observability configs
├── docs/                          # Documentation
│   ├── development/               # Development guides
│   ├── deployment/                # Deployment guides
│   └── architecture/              # Architecture docs
└── scripts/                       # Automation scripts
```

## **Live Production Deployment**

- ** Landing Page**: https://schlep-engine.com
- ** API Backend**: https://api.schlep-engine.com
- ** Admin Dashboard**: https://admin.schlep-engine.com
- ** Documentation**: https://docs.schlep-engine.com

**Infrastructure**: Vultr VPS + Cloudflare CDN + SSL

## Quick Start

### Prerequisites

- **Node.js 18+** and **pnpm** (frontend development)
- **Python 3.11+** and **pip** (backend development)
- **Docker** and **Docker Compose** (deployment)
- **PostgreSQL 15+** and **Redis 7+** (databases)

### Production Deployment (Vultr VPS)

**Ready to deploy?** Follow the complete deployment guide:

```bash
# 1. Set up Cloudflare DNS (already done for schlep-engine.com)
# 2. Deploy to Vultr VPS
scp -r . root@YOUR_VPS_IP:/root/schlep-engine/
ssh root@YOUR_VPS_IP
cd /root/schlep-engine
docker-compose -f infrastructure/vultr/docker-compose.production.yml up -d
```

**Full Guide**: [`DEPLOY_VULTR_CLOUDFLARE.md`](./DEPLOY_VULTR_CLOUDFLARE.md)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-org/schlep-engine.git
   cd schlep-engine
   pnpm install
   ```

2. **Start development servers:**
   ```bash
   # Start all services
   pnpm dev

   # Or start individual services
   pnpm dev:api      # FastAPI backend → localhost:3001
   pnpm dev:admin    # Admin dashboard → localhost:3002
   pnpm dev:landing  # Landing page → localhost:3000
   pnpm dev:docs     # Documentation → localhost:3003
   ```

3. **Using Docker for local development:**
   ```bash
   docker-compose up -d
   ```

## Available Scripts

### Root Level Commands
- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications
- `pnpm start` - Start all applications in production mode
- `pnpm clean` - Clean all build artifacts
- `pnpm lint` - Run linting across all packages
- `pnpm test` - Run tests across all packages
- `pnpm type-check` - Run TypeScript type checking

### Individual Application Commands
- `pnpm dev:api` - Start API backend only
- `pnpm dev:admin` - Start admin dashboard only
- `pnpm dev:landing` - Start landing page only
- `pnpm dev:docs` - Start API documentation only

## Architecture

### 🏗️ Applications (`apps/`)

#### API Backend (`apps/api/`)
- **Framework:** FastAPI (Python 3.11)
- **Port:** 3001 (Production) / 3001 (Development)
- **Features:** JWT Authentication, PostgreSQL + Redis, ML Pipeline, Document Processing
- **URL:** https://api.schlep-engine.com

#### Admin Dashboard (`apps/web-admin/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3002
- **Features:** Custom FastAPI auth integration, User management, System monitoring
- **URL:** https://admin.schlep-engine.com

#### Landing Page (`apps/web-landing/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3000
- **Features:** Marketing site, User onboarding, Product showcase
- **URL:** https://schlep-engine.com

#### Documentation (`apps/web-docs/`)
- **Framework:** Next.js 14 (React 18)
- **Port:** 3003
- **Features:** API docs, Integration guides, Developer resources
- **URL:** https://docs.schlep-engine.com

### Shared Packages (`packages/`)

#### UI Components (`packages/ui/`)
- Shared React components and design system
- Styled with Tailwind CSS and Radix UI

#### Utilities (`packages/utils/`)
- Common utility functions and helpers
- Shared across all applications

#### Types (`packages/types/`)
- Shared TypeScript type definitions
- API interfaces and common types

## Development

### Adding a New Application

1. Create a new directory in `apps/`
2. Initialize with your preferred framework
3. Add to workspace configuration in `pnpm-workspace.yaml`
4. Update root `package.json` scripts if needed

### Adding a New Package

1. Create a new directory in `packages/`
2. Initialize with `pnpm init`
3. Add to workspace configuration in `pnpm-workspace.yaml`
4. Export your package functionality

### Code Style and Standards

- **TypeScript:** Strict mode enabled
- **ESLint:** Standard configuration across all packages
- **Prettier:** Consistent code formatting
- **Husky:** Pre-commit hooks for quality checks

## Deployment

### Production Deployment

**Current Setup**: Vultr VPS + Cloudflare CDN

See deployment guides:

- [Vultr + Cloudflare Deployment](./DEPLOY_VULTR_CLOUDFLARE.md) ⭐ **Current**
- [Alternative: Backend Deployment](./docs/deployment/BACKEND_DEPLOYMENT.md)
- [Alternative: Kubernetes Deployment](./docs/deployment/API_AS_A_SERVICE_DEPLOYMENT.md)

### Infrastructure

- **Vultr VPS:** AMD EPYC processors, NVMe SSD (45.77.44.216)
- **Cloudflare CDN:** Global edge network, SSL, DDoS protection
- **Docker:** Containerization for all services
- **Nginx:** Reverse proxy and load balancing
- **PostgreSQL + Redis:** Database and caching layer

## Documentation

- [Development Guide](./docs/development/DEVELOPMENT.md)
- [API Reference](./docs/api/)
- [Architecture Overview](./docs/architecture/)
- [Deployment Guides](./docs/deployment/)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/schlep-engine/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/schlep-engine/discussions)
# 🚀 CI/CD Pipeline Active - Thu Aug 14 02:54:55 UTC 2025
