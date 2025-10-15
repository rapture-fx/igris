# AI Agents Documentation

This document contains guidelines and documentation for AI agents working on the schlep-engine project.

## Project Overview

Schlep-engine is a high-performance, distributed computing platform designed for scalable AI/ML workloads with hybrid architecture support.

## Codebase Structure

- **apps/**: Application services and microservices
- **packages/**: Shared libraries and utilities
- **infrastructure/**: Infrastructure as code and deployment configurations
- **monitoring/**: Observability and logging configurations
- **python_ml/**: Python ML service implementations
- **rust_kernel/**: Rust-based core services
- **go_gateway/**: Go-based gateway implementations
- **tests/**: Test suites and benchmarks

## Development Guidelines

### Architecture Principles
- Maintain hybrid microservice architecture
- Prioritize performance and scalability
- Ensure security best practices
- Follow existing patterns and conventions

### Code Standards
- Use existing libraries and patterns before adding new ones
- Match the coding style of surrounding code
- Add only necessary comments
- Follow language-specific conventions

### Testing
- Run existing test suites before implementing changes
- Verify functionality through benchmarks
- Ensure CI/CD pipeline compatibility
- Test security implications

## Agent Workflow

1. **Discovery**: Understand codebase structure and existing patterns
2. **Analysis**: Identify relevant files and dependencies
3. **Implementation**: Apply changes following established conventions
4. **Validation**: Run tests and verify functionality
5. **Documentation**: Update relevant documentation if needed

## Key Commands

```bash
# Run tests
npm test
pytest tests/

# Build and deploy
npm run build
docker-compose up

# Linting and validation
npm run lint
```

## Security Considerations

- Never expose sensitive data or credentials
- Follow security best practices
- Validate all inputs and outputs
- Use secure communication protocols

## Common Libraries

- **Frontend**: React, Next.js, TypeScript
- **Backend**: Node.js, Python, Rust, Go
- **Infrastructure**: Docker, Kubernetes, Terraform
- **Monitoring**: Prometheus, Grafana, ELK stack

## CI/CD Pipeline

The project uses automated testing and deployment. Ensure all changes pass CI checks before submission.
