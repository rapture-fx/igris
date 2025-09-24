# Schlep-engine Rust Readiness Assessment Tools

This comprehensive suite of tools helps you identify performance bottlenecks in the Schlep-engine Python codebase and decide whether adding Rust modules will meaningfully improve speed.

## 🚀 Quick Start

**Run the complete audit with one command:**

```bash
python run_complete_audit.py
```

This will execute all profiling tools and generate a comprehensive report with recommendations.

## 📋 Individual Tools

### 1. Performance Profiler (`performance_profiler.py`)
- **CPU profiling** using cProfile to find slowest functions
- **Memory profiling** to identify memory bloat
- **Benchmark key workflows** with different dataset sizes
- **Test Polars** as pandas replacement

```bash
python performance_profiler.py
```

**Output:**
- `profiling_results/rust_readiness_report_YYYYMMDD_HHMMSS.json`
- `profiling_results/rust_readiness_summary_YYYYMMDD_HHMMSS.md`

### 2. Line-by-Line Profiler (`line_profiler_runner.py`)
- **Line-by-line profiling** using kernprof
- **Identifies exact lines** causing bottlenecks
- **Rust candidate identification** at line level

```bash
python line_profiler_runner.py
```

**Requirements:**
- Automatically installs `line_profiler` if needed
- Requires `kernprof` command (installed with line_profiler)

**Output:**
- `line_profiling_results/line_profiling_complete_YYYYMMDD_HHMMSS.json`
- `line_profiling_results/line_profiling_complete_YYYYMMDD_HHMMSS.md`

### 3. Rust Integration Guide (`rust_integration_guide.py`)
- **Complete Rust integration examples** with PyO3
- **Implementation strategies** and roadmaps
- **Decision framework** for when to use Rust
- **Working Rust code examples**

```bash
python rust_integration_guide.py
```

**Output:**
- `rust_integration_guide/complete_rust_integration_guide_YYYYMMDD.md`
- `rust_integration_guide/schlep_rust_module/` (complete Rust project)

### 4. Complete Audit Runner (`run_complete_audit.py`)
- **Orchestrates all tools** in sequence
- **Creates executive summary** with recommendations
- **Comprehensive analysis** and action plan

```bash
python run_complete_audit.py
```

**Output:**
- `rust_readiness_executive_summary_YYYYMMDD_HHMMSS.md` (executive report)
- `rust_readiness_audit_complete_YYYYMMDD_HHMMSS.json` (detailed results)

## 📊 What You'll Get

### Immediate Insights
- **Polars speedup potential**: 2-5x improvement by switching from pandas
- **CPU bottlenecks**: Functions taking >40% of runtime
- **Memory usage patterns**: Identify memory bloat on large datasets
- **Rust candidates**: Specific functions that would benefit from Rust

### Strategic Recommendations
- **Implementation strategy**: Selective replacement vs full migration
- **Timeline**: Week-by-week implementation plan
- **ROI estimate**: Expected performance gains
- **Risk assessment**: Technical complexity and team readiness

### Actionable Outputs
- **Working Rust examples**: Complete PyO3 project ready to build
- **Migration roadmap**: Step-by-step implementation guide
- **Performance benchmarks**: Before/after comparisons
- **Decision framework**: When to use Rust vs alternatives

## 🎯 Decision Tree

```
📊 Run Audit
├── Polars provides 2-3x speedup? → ✅ Start with Polars (2-4 weeks)
├── 2+ high-priority CPU bottlenecks? → ✅ Selective Rust integration (4-8 weeks)
├── Entire pipeline consistently slow? → ✅ Rust microservice (8-16 weeks)
└── Otherwise → ⚠️ Optimize Python first
```

## 📋 Prerequisites

### Required Python Packages
```bash
pip install pandas numpy psutil
```

### Optional (installed automatically)
```bash
pip install polars line_profiler  # Installed by scripts if needed
```

### For Rust Integration (Phase 2)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Python-Rust build tools
pip install maturin
```

## 🔍 Sample Output

### Performance Profiler Results
```
🚀 RUST READINESS ASSESSMENT SUMMARY
====================================
Readiness Score: 75/100
Strategy: SELECTIVE_RUST_INTEGRATION
High Priority Bottlenecks: 3
Polars Speedup: 2.4x
```

### Executive Summary Example
```
Primary Recommendation: HYBRID_APPROACH
Rationale: High Polars benefits + significant CPU bottlenecks

Immediate Actions:
1. Test Polars on representative datasets (2-3x immediate gain)
2. Set up Rust development environment
3. Implement fast_fillna Rust module (5-10x speedup)
4. Migrate groupby operations to Rust (3-8x speedup)
```

## 📈 Expected Performance Gains

| Optimization | Timeline | Expected Speedup | Complexity |
|-------------|----------|------------------|------------|
| **Polars Migration** | 2-4 weeks | 2-5x | LOW |
| **Selective Rust** | 4-8 weeks | 3-10x (targeted) | MEDIUM |
| **Full Rust Pipeline** | 8-16 weeks | 10-50x | HIGH |
| **Hybrid Approach** | 6-12 weeks | 15-30x | MEDIUM-HIGH |

## 🛠️ Troubleshooting

### Common Issues

**1. `kernprof` not found**
```bash
pip install line_profiler
# Restart terminal or run: hash -r
```

**2. Permission errors**
```bash
chmod +x *.py
```

**3. Import errors from apps/api**
```bash
# Ensure you're running from the schlep-engine root directory
cd /path/to/schlep-engine
python run_complete_audit.py
```

**4. Rust build failures**
```bash
# Install Rust development tools
rustup component add rustfmt clippy
```

### Performance Tips

**For faster auditing:**
- Run on smaller datasets first (`--small-datasets` flag if available)
- Skip line profiling for initial assessment
- Use SSD storage for temporary files

**For production use:**
- Profile with production-like data volumes
- Test during low-traffic periods
- Implement gradual rollouts with feature flags

## 📚 Deep Dive Guides

### Understanding CPU Profiling Results
Look for functions with:
- **>20% cumulative time**: High-impact optimization targets
- **>10,000 calls**: Frequently executed code
- **Pandas/NumPy operations**: Good Rust candidates

### Memory Profiling Interpretation
- **>100MB growth**: Memory optimization needed
- **>1MB per 1K rows**: Inefficient data structures
- **Poor cleanup efficiency**: Memory leaks possible

### Polars Migration Priority
- **CSV reading**: Usually 2-5x faster
- **Aggregations**: 3-8x speedup with lazy evaluation
- **Joins**: 5-15x faster for large datasets
- **String operations**: 2-4x improvement

## 🚀 Next Steps

### Week 1: Quick Wins
1. Run complete audit: `python run_complete_audit.py`
2. Test Polars on sample data
3. Identify top 3 bottlenecks

### Week 2-4: Polars Migration
1. Replace `pd.read_csv()` with `pl.read_csv()`
2. Convert aggregations to lazy evaluation
3. Benchmark improvements

### Week 5-8: Selective Rust (if needed)
1. Build first Rust module from provided examples
2. Implement `fast_fillna()` function
3. Measure performance gains

### Week 9+: Scale and Optimize
1. Add monitoring and feature flags
2. Expand Rust modules based on results
3. Document learnings for team

## 📞 Support

- **Detailed logs**: Check `complete_audit_YYYYMMDD_HHMMSS.log`
- **Profiling issues**: Review component output directories
- **Rust setup**: Follow build scripts in `rust_integration_guide/`
- **Strategy questions**: Use decision framework in executive summary

---

**🎯 Goal**: Achieve 5-50x performance improvement through strategic Python-Rust integration

**⏱️ Time Investment**: 1 day for assessment, 2-16 weeks for implementation based on chosen strategy

**📊 Success Metrics**: Measurable improvement in end-to-end processing time, throughput, and resource efficiency