# Schlep Engine Monorepo

> The Data Schlep Handler. We handle the schlep so you don't have to.

A comprehensive monorepo containing all Schlep Engine applications, packages, and infrastructure.

## 🏗️ Project Structure

```
schlep-engine/
├── apps/                          # All applications
│   ├── api/                       # Main API backend (FastAPI)
│   ├── admin/                     # Admin dashboard (Next.js)
│   ├── landing/                   # Landing page (Next.js)
│   └── docs/                      # API documentation (Next.js)
├── packages/                      # Shared packages and libraries
│   ├── ui/                        # Shared UI components
│   ├── utils/                     # Shared utilities
│   └── types/                     # Shared TypeScript types
├── infrastructure/                # Infrastructure and deployment
│   ├── docker/                    # Docker configurations
│   ├── k8s/                       # Kubernetes manifests
│   ├── terraform/                 # Terraform configurations
│   └── monitoring/                # Monitoring configurations
├── scripts/                       # Build and deployment scripts
│   ├── build/                     # Build scripts
│   ├── deploy/                    # Deployment scripts
│   └── dev/                       # Development scripts
├── docs/                          # Project documentation
│   ├── api/                       # API documentation
│   ├── deployment/                # Deployment guides
│   ├── development/               # Development guides
│   └── architecture/              # Architecture documentation
├── tools/                         # Development tools and utilities
│   ├── generators/                # Code generators
│   └── validators/                # Validation tools
└── .github/                       # GitHub workflows and templates
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.9+ and pip
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd schlep-engine
   pnpm install
   ```

2. **Start the development environment:**
   ```bash
   # Start all services
   pnpm dev
   
   # Or start individual services
   pnpm dev:api      # API backend on :8000
   pnpm dev:admin    # Admin dashboard on :3002
   pnpm dev:landing  # Landing page on :3000
   pnpm dev:docs     # API docs on :3001
   ```

3. **Using Docker:**
   ```bash
   docker-compose up -d
   ```

## 📦 Available Scripts

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

## 🏛️ Architecture

### Applications (`apps/`)

#### API Backend (`apps/api/`)
- **Framework:** FastAPI (Python)
- **Port:** 8000
- **Purpose:** Main API server handling data processing, authentication, and business logic

#### Admin Dashboard (`apps/admin/`)
- **Framework:** Next.js (React)
- **Port:** 3002
- **Purpose:** Administrative interface for managing users, data, and system configuration

#### Landing Page (`apps/landing/`)
- **Framework:** Next.js (React)
- **Port:** 3000
- **Purpose:** Public-facing marketing website and user onboarding

#### API Documentation (`apps/docs/`)
- **Framework:** Next.js (React)
- **Port:** 3001
- **Purpose:** Interactive API documentation and developer resources

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

## 🛠️ Development

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

## 🚀 Deployment

### Production Deployment

See `docs/deployment/` for detailed deployment guides:

- [Vercel Deployment](./docs/deployment/VERCEL_DEPLOYMENT.md)
- [Backend Deployment](./docs/deployment/BACKEND_DEPLOYMENT.md)
- [Kubernetes Deployment](./docs/deployment/API_AS_A_SERVICE_DEPLOYMENT.md)

### Infrastructure

- **Docker:** Containerization for all services
- **Kubernetes:** Production orchestration
- **Terraform:** Infrastructure as Code
- **Monitoring:** Prometheus, Grafana, and custom metrics

## 📚 Documentation

- [Development Guide](./docs/development/DEVELOPMENT.md)
- [API Reference](./docs/api/)
- [Architecture Overview](./docs/architecture/)
- [Deployment Guides](./docs/deployment/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/schlep-engine/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/schlep-engine/discussions)
