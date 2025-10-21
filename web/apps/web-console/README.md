# Schlep-engine Developer Console

A production-grade web application for managing your Schlep-engine AI inference infrastructure.

## Features

- **Authentication**: Secure login and registration with JWT
- **Dashboard**: Real-time metrics and analytics visualization
- **Vault Management**: Securely manage API keys for LLM providers
- **Usage Analytics**: Detailed insights with interactive charts
- **Policy Configuration**: Set budget limits and usage policies
- **Settings**: Account management and preferences

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + ShadCN
- **Data Fetching**: TanStack React Query
- **Charts**: Recharts
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Update the API URL in .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8081
```

### Development

```bash
# Start development server
pnpm dev

# The app will be available at http://localhost:3001
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8081
NEXT_PUBLIC_APP_NAME=Schlep-engine Developer Console
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Project Structure

```
/web/apps/web-console/
├── app/                      # Next.js app router pages
│   ├── auth/                # Authentication pages
│   ├── dashboard/           # Dashboard pages
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                  # ShadCN UI components
│   ├── layout/              # Layout components
│   ├── charts/              # Chart components
│   └── modals/              # Modal components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility libraries
│   ├── apiClient.ts         # API client with JWT
│   └── auth.ts              # Authentication utilities
├── styles/                  # Global styles
├── utils/                   # Helper functions
└── public/                  # Static assets
```

## API Integration

The console integrates with the Schlep-engine backend API:

- **Authentication**: `/v1/auth/login`, `/v1/auth/register`
- **Tenants**: `/v1/tenants`
- **Vault**: `/v1/vault/keys`
- **Usage**: `/v1/usage`, `/v1/usage/summary`
- **Policy**: `/v1/policy`
- **Inference**: `/v1/infer`

## Design System

The console uses the same design system as the Schlep-engine landing page:

- **Colors**:
  - Background: `#f7f7f3`
  - Primary Blue: `#114dcd`
  - Button Blue: `#1f53d0`
  - Accent Teal: `#299a93`
- **Fonts**: Inter (sans-serif), Space Mono (monospace)
- **Components**: Consistent with landing page aesthetics

## Security

- All API keys are masked in the UI
- JWT tokens stored in HttpOnly cookies
- Automatic token refresh on expiration
- HTTPS enforced in production
- CSRF protection on state-changing operations

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker

```bash
# Build Docker image
docker build -t schlep-console .

# Run container
docker run -p 3001:3001 schlep-console
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - Schlep-engine
