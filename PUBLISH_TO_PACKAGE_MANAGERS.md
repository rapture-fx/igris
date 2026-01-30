# Publishing Igris SDKs to Package Managers

All SDKs are now on GitHub. Follow these steps to publish to package registries.

## Python SDK - PyPI

```bash
cd /Users/wira/Desktop/system/igris-python-sdk

# Install publishing tools
pip install build twine

# Build distribution packages
python -m build

# Upload to PyPI (you'll need PyPI credentials)
twine upload dist/*
```

After publishing, users install with:
```bash
pip install schlep-engine
```

## Rust SDK - crates.io

```bash
cd /Users/wira/Desktop/system/igris-rust-sdk

# Login to crates.io (one time)
cargo login YOUR_CRATES_IO_TOKEN

# Publish
cargo publish
```

After publishing, users install with:
```bash
cargo add schlep_engine
```

## JavaScript SDK - npm

```bash
cd /Users/wira/Desktop/system/igris-javascript-sdk

# Login to npm (one time)
npm login

# Publish
npm publish --access public
```

After publishing, users install with:
```bash
npm install @igris-inertial/javascript-sdk
```

## Go SDK - Already Published!

Go packages are published via GitHub. Users can install immediately:
```bash
go get github.com/Igris-inertial/igris-go-sdk
```

No additional steps needed!

## Java SDK - Maven Central

Publishing to Maven Central requires:
1. Sonatype account
2. GPG signing key
3. Configuration in pom.xml

Detailed guide: https://central.sonatype.org/publish/publish-guide/

## C# SDK - NuGet

```bash
cd /Users/wira/Desktop/system/igris-csharp-sdk

# Build package
dotnet pack -c Release

# Publish to NuGet (you'll need NuGet API key)
dotnet nuget push bin/Release/*.nupkg --api-key YOUR_NUGET_KEY --source https://api.nuget.org/v3/index.json
```

After publishing, users install with:
```bash
dotnet add package SchlepEngine.SDK
```

## Ruby SDK - RubyGems

```bash
cd /Users/wira/Desktop/system/igris-ruby-sdk

# Build gem
gem build schlep_engine.gemspec

# Publish to RubyGems (you'll need RubyGems account)
gem push schlep_engine-1.0.0.gem
```

After publishing, users install with:
```bash
gem install schlep_engine
```

## Verification Checklist

After publishing each SDK:

- [ ] Python: Visit https://pypi.org/project/schlep-engine/
- [ ] Rust: Visit https://crates.io/crates/schlep_engine
- [ ] JavaScript: Visit https://www.npmjs.com/package/@igris-inertial/javascript-sdk
- [ ] Go: Test `go get github.com/Igris-inertial/igris-go-sdk`
- [ ] Java: Search Maven Central
- [ ] C#: Visit https://www.nuget.org/packages/SchlepEngine.SDK/
- [ ] Ruby: Visit https://rubygems.org/gems/schlep_engine

## Troubleshooting

**"Package name already taken"**
- Choose a different name or claim the namespace
- Update package.json/Cargo.toml/etc. with new name

**"Authentication failed"**
- Verify you're logged in: `npm whoami`, `cargo login --help`, etc.
- Check API keys are correct

**"Version already exists"**
- Bump version number in package file
- Create new git tag
- Rebuild and republish

## Update Documentation

After publishing, update:
1. Main project README with installation badges
2. Each SDK README with actual package names
3. Documentation website with links to packages
