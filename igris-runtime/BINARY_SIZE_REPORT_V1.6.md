## Igris Runtime v1.6 — Binary Size Report

- **Binary**: `target/release/igris-runtime`
- **Size target**: < 18 MB (uncompressed)
- **Measured size**: ~16 MB (release)

### How to reproduce

```bash
cd igris-runtime
cargo build --release
ls -lh target/release/igris-runtime
```


