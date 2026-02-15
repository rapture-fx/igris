# OpenAPI Client Generator Usage Guide

This guide covers how to use the OpenAPI Client Generator system to create, validate, and maintain multi-language client libraries for the Igris-engine API.

## Table of Contents

- [Quick Start](#quick-start)
- [System Overview](#system-overview)
- [Configuration](#configuration)
- [Generation Process](#generation-process)
- [Validation and Testing](#validation-and-testing)
- [Publishing](#publishing)
- [SDK Integration](#sdk-integration)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Quick Start

### Prerequisites

Before using the client generator, ensure you have:

```bash
# Required tools
node --version    # >= 18.0.0
python3 --version # >= 3.8.0
git --version     # >= 2.0.0

# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Or use Docker (alternative)
docker pull openapitools/openapi-generator-cli
```

### Basic Usage

```bash
# Generate all client libraries with validation
./generate-all-clients.sh --validate

# Generate specific languages
./generate-all-clients.sh --languages python,typescript --validate

# Full pipeline: generate, validate, sync with existing SDKs
./generate-all-clients.sh --validate --sync-sdks

# Publish to test registries
./generate-all-clients.sh --publish --test-publish
```

## System Overview

The OpenAPI Client Generator is a comprehensive system that:

1. **Extracts** OpenAPI specifications from FastAPI applications
2. **Generates** client libraries in multiple programming languages
3. **Validates** generated clients for quality and functionality
4. **Tests** clients with integration test suites
5. **Syncs** with existing hand-crafted SDKs
6. **Publishes** to package registries (PyPI, NPM, etc.)
7. **Automates** the entire process via CI/CD

### Supported Languages

| Language | Generator | Package Registry | Status |
|----------|-----------|------------------|---------|
| Python | openapi-generator | PyPI | ✅ Production |
| TypeScript/JavaScript | typescript-axios | NPM | ✅ Production |
| Go | go | Go Modules | ✅ Production |
| Java | java | Maven Central | ✅ Production |
| C# | csharp | NuGet | ✅ Production |
| Ruby | ruby | RubyGems | 🚧 Beta |
| PHP | php | Packagist | 🚧 Beta |
| Rust | rust | Crates.io | 🚧 Beta |
| Swift | swift5 | Swift PM | 🚧 Beta |

## Configuration

### Language-Specific Configurations

Each language has its own configuration file in `configs/`:

```yaml
# configs/python.yaml
generator-name: python
input-spec: "../../apps/api/openapi.json"
output-dir: "./generated/python"
package-name: "igris-inertial-client"
package-version: "2.0.0"

additional-properties:
  packageName: igris_overture_client
  packageVersion: 2.0.0
  packageUrl: https://github.com/igris-inertial/python-client
  packageDescription: "Python client library for Igris-engine API"
  
  # Python-specific settings
  pythonAttr: true
  library: urllib3
  packageTyping: true
```

### Environment Variables

Set these environment variables for enhanced functionality:

```bash
# Publishing credentials
export PYPI_TOKEN="your_pypi_token"
export NPM_TOKEN="your_npm_token" 
export NUGET_API_KEY="your_nuget_key"

# Notification settings
export SLACK_WEBHOOK_URL="your_slack_webhook"
export NOTIFICATION_EMAIL="admin@example.com"

# API configuration
export DATABASE_URL="postgresql://user:pass@host/db"
export SECRET_KEY="your_secret_key"
```

## Generation Process

### 1. Extract OpenAPI Specification

The system automatically extracts the OpenAPI spec from your FastAPI application:

```bash
# Manual extraction
cd apps/api
python3 -c "
from app.main import app
import json
spec = app.openapi()
with open('openapi.json', 'w') as f:
    json.dump(spec, f, indent=2)
"
```

### 2. Generate Clients

Use the generation script for individual languages:

```bash
# Generate Python client
./scripts/generate.sh --language python --validate

# Generate with custom config
./scripts/generate.sh --language python --config configs/python-custom.yaml

# Generate all languages
./scripts/generate.sh --all
```

### 3. Post-Processing

Generated clients are automatically enhanced with:
- Custom authentication handling
- Enhanced error messages
- Type safety improvements
- Additional utility functions

## Validation and Testing

### Quality Validation

The validation system checks:

```bash
# Run all validation types
./scripts/validate.sh --all

# Specific validation types
./scripts/validate.sh python --type lint
./scripts/validate.sh typescript --type test
./scripts/validate.sh go --type security
```

Validation includes:
- **Linting**: Code style and quality checks
- **Type Checking**: Static type analysis
- **Building**: Compilation and build verification
- **Security**: Vulnerability scanning
- **Testing**: Unit and integration tests

### Integration Tests

Integration tests verify client functionality:

```python
# Python integration test example
def test_authentication():
    client = IgrisClient(api_key="test_key")
    response = client.health_check()
    assert response.status == "healthy"
```

```typescript
// TypeScript integration test example
test('should authenticate correctly', async () => {
  const client = new IgrisClient({ apiKey: 'test_key' });
  const response = await client.healthCheck();
  expect(response.status).toBe('healthy');
});
```

## Publishing

### Package Registries

Clients can be published to various registries:

```bash
# Publish all to production registries
./scripts/publish.sh --all

# Publish to test registries
./scripts/publish.sh --all --test

# Publish specific languages
./scripts/publish.sh python typescript

# Dry run (show what would be published)
./scripts/publish.sh --all --dry-run
```

### Version Management

The system automatically manages versions:
- **Semantic versioning** based on API changes
- **Automatic incrementing** for patch releases
- **Manual override** for major/minor versions
- **Git tagging** for release tracking

## SDK Integration

### Hybrid Approach

The system supports a hybrid approach combining generated and hand-crafted SDKs:

```bash
# Sync generated clients with existing SDKs
./scripts/sync-with-existing-sdks.sh --all --merge --backup

# Preserve custom code while updating generated parts
./scripts/sync-with-existing-sdks.sh python --merge
```

### Integration Benefits

1. **Generated Benefits**: Always up-to-date, type-safe, complete coverage
2. **Hand-crafted Benefits**: Better UX, custom features, optimizations
3. **Combined**: Best of both worlds with automated synchronization

## Troubleshooting

### Common Issues

**1. OpenAPI Spec Generation Fails**
```bash
# Check FastAPI app startup
cd apps/api
python3 -c "from app.main import app; print('App loads successfully')"

# Check for missing dependencies
pip install -r requirements.txt
```

**2. Client Generation Fails**
```bash
# Check OpenAPI Generator version
openapi-generator-cli version

# Use Docker as fallback
docker run --rm -v "$(pwd):/workspace" openapitools/openapi-generator-cli version
```

**3. Validation Fails**
```bash
# Check specific language tools
python3 -m flake8 --version  # Python linting
npm list -g eslint            # TypeScript linting
go version                    # Go compilation
```

**4. Publishing Fails**
```bash
# Check authentication
npm whoami                    # NPM
twine check dist/*           # PyPI
dotnet nuget list source     # NuGet
```

### Debug Mode

Enable verbose logging:

```bash
# Set debug environment
export DEBUG=true
export VERBOSE=true

# Run with debug output
./generate-all-clients.sh --validate --dry-run
```

## Advanced Usage

### Custom Templates

Create custom templates for enhanced client generation:

```mustache
<!-- templates/python/custom_client.mustache -->
class {{classname}}:
    def __init__(self, api_key: str, base_url: str = "{{basePath}}"):
        self.api_key = api_key
        self.base_url = base_url
        # Custom initialization logic
```

### CI/CD Integration

The system includes GitHub Actions workflows:

```yaml
# .github/workflows/client-generation.yml
name: Generate Clients
on:
  push:
    paths: ['apps/api/**']
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate clients
        run: ./tools/openapi-client-generator/generate-all-clients.sh --validate --publish
```

### Custom Hooks

Add custom processing hooks:

```bash
# hooks/post-generate-python.sh
#!/bin/bash
echo "Adding custom Python enhancements..."
# Custom post-processing logic
```

### Monitoring and Alerts

Set up monitoring for the generation pipeline:

```yaml
# monitoring/alerts.yml
alerts:
  - name: client-generation-failure
    condition: pipeline_status == "failed"
    notification: slack
    message: "Client generation pipeline failed"
```

## Best Practices

### Development Workflow

1. **API First**: Design OpenAPI spec before implementation
2. **Incremental**: Generate clients frequently during development
3. **Testing**: Always validate generated clients before publishing
4. **Documentation**: Keep client documentation up-to-date
5. **Versioning**: Use semantic versioning for breaking changes

### Quality Assurance

1. **Validation**: Run all validation types before publishing
2. **Testing**: Maintain comprehensive integration test suites
3. **Security**: Regular security scanning of generated code
4. **Performance**: Monitor client performance and optimize
5. **Compatibility**: Test across different language versions

### Maintenance

1. **Regular Updates**: Update OpenAPI Generator regularly
2. **Dependency Management**: Keep dependencies up-to-date
3. **Security Patches**: Apply security updates promptly
4. **Documentation**: Update documentation with API changes
5. **Monitoring**: Monitor usage and performance metrics

## Resources

- [OpenAPI Generator Documentation](https://openapi-generator.tech/docs/)
- [FastAPI OpenAPI Guide](https://fastapi.tiangolo.com/tutorial/metadata/)
- [Igris-engine API Documentation](https://docs.igris-inertial.com)
- [SDK Comparison Report](../SDK_COMPARISON_REPORT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)