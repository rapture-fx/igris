# OpenAPI Client Generator

Multi-language OpenAPI client generation system for Schlep-engine API with automatic CI/CD integration.

## Features

- **Multi-language Support**: Python, JavaScript/TypeScript, Go, Java, C#, Ruby, PHP, Rust, Swift
- **Automatic Generation**: CI/CD integration for automatic client generation on API changes
- **Version Management**: Semantic versioning and release management for generated clients
- **Quality Assurance**: Automated testing and validation of generated clients
- **Template Customization**: Custom templates and configuration options
- **Publishing Automation**: Automatic package publishing to NPM, PyPI, etc.

## Supported Languages

| Language | Generator | Package Manager | Status |
|----------|-----------|----------------|--------|
| Python | openapi-generator | PyPI | ✅ Active |
| JavaScript/TypeScript | openapi-generator | NPM | ✅ Active |
| Go | openapi-generator | Go Modules | ✅ Active |
| Java | openapi-generator | Maven Central | ✅ Active |
| C# | openapi-generator | NuGet | ✅ Active |
| Ruby | openapi-generator | RubyGems | ✅ Active |
| PHP | openapi-generator | Composer | ✅ Active |
| Rust | openapi-generator | Crates.io | ✅ Active |
| Swift | openapi-generator | Swift Package Manager | ✅ Active |

## Directory Structure

```
tools/openapi-client-generator/
├── configs/                    # Language-specific configurations
│   ├── python.yaml
│   ├── typescript.yaml
│   ├── go.yaml
│   └── ...
├── templates/                  # Custom templates
│   ├── python/
│   ├── typescript/
│   └── ...
├── scripts/                    # Generation and automation scripts
│   ├── generate.sh
│   ├── validate.sh
│   └── publish.sh
├── ci/                        # CI/CD configurations
│   ├── github-actions/
│   └── gitlab-ci/
├── generated/                 # Generated client outputs
│   ├── python/
│   ├── typescript/
│   └── ...
├── tests/                     # Validation tests
│   ├── integration/
│   └── unit/
└── docs/                      # Documentation
    ├── usage.md
    └── customization.md
```

## Quick Start

### Prerequisites

- Docker (recommended)
- OpenAPI Generator CLI
- Node.js (for validation)
- Python 3.8+ (for validation)

### Installation

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Or use Docker
docker pull openapitools/openapi-generator-cli
```

### Generate Clients

```bash
# Generate all supported language clients
./scripts/generate.sh --all

# Generate specific language client
./scripts/generate.sh --language python

# Generate with custom config
./scripts/generate.sh --language python --config configs/python-custom.yaml
```

### Validate Generated Clients

```bash
# Run validation tests
./scripts/validate.sh --all

# Test specific language client
./scripts/validate.sh --language python
```

## Configuration

Each language has its own configuration file in `configs/` directory. These files define:

- Generator options
- Template customizations
- Package metadata
- Publishing settings
- Validation rules

## CI/CD Integration

The system includes automated workflows for:

1. **API Change Detection**: Monitor FastAPI schema changes
2. **Client Generation**: Automatic generation on schema updates
3. **Quality Assurance**: Automated testing and validation
4. **Version Management**: Semantic versioning based on changes
5. **Publishing**: Automatic package publishing to registries

## Usage Examples

### Python

```python
from igris_overture_client import SchlepEngineClient

client = SchlepEngineClient(api_key="your_key", base_url="https://api.igris-inertial.com")
response = client.upload_file("data.csv")
```

### TypeScript

```typescript
import { SchlepEngineClient } from '@igris-inertial/client';

const client = new SchlepEngineClient({ apiKey: 'your_key' });
const response = await client.uploadFile('data.csv');
```

### Go

```go
import "github.com/igris-inertial/go-client"

client := schlepengine.NewClient("your_key")
response, err := client.UploadFile("data.csv")
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on customizing templates and adding new language support.

## License

MIT License - see [LICENSE](LICENSE) file for details.