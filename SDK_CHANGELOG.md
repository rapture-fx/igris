# Schlep-Engine SDK Changelog

This document tracks version releases across all official SDKs.

## Version Alignment Policy

All SDKs follow semantic versioning (MAJOR.MINOR.PATCH) and are released in sync when possible. SDK versions align with platform API versions.

**Current Stable Version:** 1.0.0 (Released: 2025-01-15)

---

## v1.0.0 - Initial Stable Release (2025-01-15)

### All SDKs
**Status:** ✅ Available
**API Compatibility:** v1.x

#### Python SDK
- **Version:** 1.0.0
- **Package:** `schlep-engine` on PyPI
- **Repository:** `packages/python-sdk/`
- **Installation:** `pip install schlep-engine`

#### JavaScript/TypeScript SDK
- **Version:** 1.0.0
- **Package:** `@schlep-engine/client` on npm
- **Repository:** `packages/javascript-sdk/`
- **Installation:** `npm install @schlep-engine/client`

#### Ruby SDK
- **Version:** 1.0.0
- **Gem:** `schlep_engine` on RubyGems
- **Repository:** `packages/ruby-sdk/`
- **Installation:** `gem install schlep_engine`

#### Go SDK
- **Version:** 1.0.0
- **Module:** `github.com/schlep-engine/go-sdk`
- **Repository:** `packages/go-sdk/`
- **Installation:** `go get github.com/schlep-engine/go-sdk`

#### Java SDK
- **Version:** 1.0.0
- **Artifact:** `io.schlepengine:schlep-engine-sdk`
- **Repository:** `packages/java-sdk/`
- **Installation:** Maven/Gradle

#### Rust SDK
- **Version:** 1.0.0
- **Crate:** `schlep-engine` on crates.io
- **Repository:** `packages/rust-sdk/`
- **Installation:** `cargo add schlep-engine`

#### C# SDK
- **Version:** 1.0.0
- **NuGet:** `SchlepEngine.SDK`
- **Repository:** `packages/csharp-sdk/`
- **Installation:** `dotnet add package SchlepEngine.SDK`

#### CLI Tool
- **Version:** 1.0.0
- **Package:** `schlep-cli` on PyPI
- **Repository:** `packages/cli/`
- **Installation:** `pip install schlep-cli`

### Features (All SDKs)
- ✅ Authentication (JWT, OAuth)
- ✅ Data processing endpoints
- ✅ ML pipeline management
- ✅ Document extraction
- ✅ Real-time streaming (WebSocket support)
- ✅ Comprehensive error handling
- ✅ Async/await support (where applicable)
- ✅ Type safety (TypeScript, Rust, Go, C#)
- ✅ Full API coverage

### Breaking Changes
- Initial release - no breaking changes

---

## Upcoming Releases

### v1.1.0 - Enhanced Streaming (Planned: 2025-Q2)
- Enhanced WebSocket reconnection logic
- Kafka streaming support
- Redis pub/sub integration
- Stream-to-webhook bridge
- Advanced error recovery

### v1.2.0 - Industry Solutions (Planned: 2025-Q2)
- Financial services APIs
- E-commerce optimization
- Manufacturing analytics
- Pre-built industry templates

### v2.0.0 - Major Update (Planned: 2025-Q3)
- GraphQL support
- Advanced caching strategies
- Batch processing APIs
- Enhanced monitoring & telemetry

---

## SDK-Specific Release Notes

### Python SDK v1.0.0
- Full type hints with mypy support
- Async client with `asyncio` support
- Comprehensive test coverage (pytest)
- Detailed docstrings
- Example scripts in `examples/`

### JavaScript/TypeScript SDK v1.0.0
- Full TypeScript definitions
- ESM and CommonJS support
- Browser and Node.js compatible
- Promise-based API
- Tree-shakeable exports

### Ruby SDK v1.0.0
- Ruby 2.7+ support
- RSpec test suite
- Idiomatic Ruby patterns
- Comprehensive YARD documentation

### Go SDK v1.0.0
- Go 1.19+ support
- Context-aware APIs
- Concurrent request handling
- Comprehensive godoc
- Example applications

### Java SDK v1.0.0
- Java 11+ support
- Maven Central distribution
- Lombok integration
- JUnit 5 test suite
- Javadoc coverage

### Rust SDK v1.0.0
- Rust 2021 edition
- Async runtime (tokio)
- Strong type safety
- Comprehensive docs.rs
- Example binaries

### C# SDK v1.0.0
- .NET 6+ support
- async/await patterns
- NuGet distribution
- XML documentation
- xUnit test coverage

### CLI Tool v1.0.0
- Interactive mode
- Batch operations
- Configuration profiles
- Shell completions (bash, zsh, fish)
- Pipeline-friendly output

---

## Version Support Policy

### Active Support
- **Current major version:** 1.x - Full support
- **Security updates:** All stable versions
- **Bug fixes:** Last 2 minor versions

### End of Life
- SDKs marked EOL will receive 6 months notice
- Security patches only after EOL announcement
- Migration guides provided for major version updates

---

## Migration Guides

### From v0.x to v1.0.0
Not applicable - v1.0.0 is the first stable release.

---

## Reporting Issues

### Per-SDK Issues
Report language-specific issues in the respective repository or via:
- **GitHub Issues:** https://github.com/schlep-engine/[sdk-name]/issues
- **Email:** support@schlep-engine.com

### General SDK Issues
For cross-SDK bugs or feature requests:
- **GitHub Issues:** https://github.com/schlep-engine/schlep-engine/issues
- **Email:** sdk@schlep-engine.com

---

## Release Process

1. **Feature Development:** Work in feature branches
2. **Testing:** Comprehensive test suite + CI/CD validation
3. **Version Bump:** Semantic versioning (coordinated across SDKs)
4. **Changelog:** Update this file with release notes
5. **Tag & Release:** Git tags + package registry publication
6. **Documentation:** Update docs site and README files
7. **Announcement:** Blog post + email notification

---

*Last Updated: 2025-09-30*
*For latest SDK documentation: https://docs.schlep-engine.com/sdks*