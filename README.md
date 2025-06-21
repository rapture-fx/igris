# Pollarbase AI - Powered Data Intelligence Platform

This repository contains the source code for the Pollarbase AI-Powered Data Intelligence Platform, a full-stack application designed for enterprise data analysis and workflow automation.

## Overview

The project is structured as a monorepo managed by `pnpm` workspaces. It consists of two main packages:

-   **`packages/frontend`**: A **Next.js** application that serves as the web interface for the platform. It's built with TypeScript and styled with Tailwind CSS.
-   **`packages/backend`**: A **Python FastAPI** application that provides the core business logic, API endpoints, and handles database interactions.

## Project Structure

The repository is organized as a monorepo with a clear separation between the frontend and backend applications.                                           

```
pollarbase/
├── packages/
│   ├── frontend/
│   │   ├── src/                  # Next.js application source code
│   │   ├── public/               # Static assets
│   │   ├── next.config.js        # Next.js configuration
│   │   ├── tailwind.config.js    # Tailwind CSS configuration
│   │   └── package.json          # Frontend dependencies
│   │
│   └── backend/
│       ├── app/                  # FastAPI application source code
│       ├── alembic/              # Database migration scripts
│       ├── working_server.py     # FastAPI application entry point                 
│       ├── requirements.txt      # Python dependencies
│       └── alembic.ini           # Alembic configuration
│
├── .gitignore                    # Git ignore rules
├── pnpm-workspace.yaml           # pnpm workspace configuration
└── README.md                     # This file
```

## Key Features

-   **Decoupled Architecture**: Clear separation between the frontend and backend for independent development and deployment.
-   **AI-Powered Insights**: Core functionality for data processing, cleaning, and generating intelligent insights.
-   **User Authentication**: Secure JWT-based authentication flow.
-   **Data Source Management**: Tools for connecting to and managing various data sources.
-   **Interactive Dashboards**: Rich data visualizations and analytics powered by Recharts.

## Getting Started

### Prerequisites

-   Node.js (v18+)
-   pnpm (v8+)
-   Python (v3.10+)
-   PostgreSQL

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Install dependencies for all packages:**
    ```bash
    pnpm install
    ```

3.  **Setup the Backend:**
    -   Navigate to the backend directory: `cd packages/backend`
    -   Create and activate a virtual environment: `python3 -m venv venv && source venv/bin/activate`
    -   Install Python dependencies: `pip install -r requirements.txt`
    -   Set up your `.env` file based on `environment.env`.
    -   Run the database migrations.
    -   Start the backend server: `uvicorn working_server:app --reload`

4.  **Setup the Frontend:**
    -   In a new terminal, navigate to the frontend directory: `cd packages/frontend`
    -   Set up your `.env.local` file based on `env.example`.
    -   Start the frontend development server: `pnpm run dev`

5.  **Access the application:**
    -   Frontend: `http://localhost:3000`
    -   Backend API Docs: `http://localhost:8000/docs`

## Deployment

The frontend is configured for deployment on **Vercel**. The backend can be containerized using the provided `Dockerfile` and deployed to any cloud provider (e.g., AWS, GCP, Render). 

Start cd packages/frontend && pnpm run dev

# Install all dependencies
pnpm install

# Run frontend development server
pnpm --filter pollarbase-web dev

# Run backend development server  
pnpm --filter pollarbase-backend dev

# Build frontend for production
pnpm --filter pollarbase-web build

# Clean and fresh install
pnpm --filter pollarbase-web fresh-install