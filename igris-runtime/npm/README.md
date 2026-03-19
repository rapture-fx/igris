# Igris Runtime

Production-ready AI routing engine with automatic local LLM fallback.

## Installation

### Global Install
```bash
npm install -g @igris/runtime
# or
pnpm add -g @igris/runtime
```

### npx (No Install)
```bash
npx @igris/runtime --version
```

## Usage

```bash
# Start the server
igris-runtime serve

# Show version
igris-runtime --version

# Validate config
igris-runtime validate-config --config config.json5

# Get help
igris-runtime --help
```

## Features

- **AI Routing**: Speculative execution, Thompson sampling, council mode
- **Local LLM Fallback**: Automatic failover to on-device models
- **Offline Capable**: Works without internet connection
- **OpenAI Compatible**: Drop-in replacement for OpenAI API
- **Zero Dependencies**: Single static binary

## Supported Platforms

- macOS ARM64 (Apple Silicon M1/M2/M3/M4)
- Linux x64 (Intel/AMD)
- Linux ARM64 (Raspberry Pi, Jetson)

## Quick Start

After installation:

```bash
# Download a model (optional, for offline mode)
cd ~/.igris
wget https://huggingface.co/...model.gguf

# Configure
igris-runtime serve
```

## Documentation

- [Full Documentation](https://github.com/Igris-inertial/system/tree/main/igris-runtime)
- [Configuration Guide](https://github.com/Igris-inertial/system/blob/main/igris-runtime/README.md#configuration-details)
- [API Reference](https://github.com/Igris-inertial/system/blob/main/igris-runtime/README.md#api-endpoints)

## Alternative Installation

Install via shell script:
```bash
curl -fsSL https://igrisinertial.com/install | bash
```

## License

MIT OR Apache-2.0

## Links

- [GitHub](https://github.com/Igris-inertial/system)
- [Website](https://igrisinertial.com)
- [Issues](https://github.com/Igris-inertial/system/issues)
