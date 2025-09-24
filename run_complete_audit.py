#!/usr/bin/env python3
"""
Complete Rust Readiness Audit for Schlep-engine
===============================================

Orchestrates the complete performance audit including:
1. CPU profiling with cProfile
2. Line-by-line profiling with kernprof
3. Memory profiling with psutil
4. Polars vs pandas benchmarking
5. Rust integration recommendations

Run this script to get a comprehensive assessment of whether
adding Rust modules will meaningfully improve performance.
"""

import os
import sys
import time
import subprocess
import logging
from pathlib import Path
from datetime import datetime
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'complete_audit_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def print_banner():
    """Print audit banner"""
    banner = """
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SCHLEP-ENGINE RUST READINESS AUDIT                        ║
║                                                                              ║
║  🔍 CPU Profiling          🧠 Memory Analysis        📊 Benchmarking        ║
║  📏 Line-by-Line Profiling 🦀 Rust Recommendations  ⚡ Polars Testing     ║
║                                                                              ║
║  Goal: Identify performance bottlenecks and assess Rust integration ROI     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
    print(banner)

def run_audit_component(component_name: str, script_path: str, description: str) -> dict:
    """Run an individual audit component"""
    logger.info(f"🚀 Starting {component_name}...")
    logger.info(f"   Description: {description}")

    start_time = time.time()

    try:
        # Check if script exists
        if not Path(script_path).exists():
            logger.error(f"❌ Script not found: {script_path}")
            return {'status': 'error', 'error': f'Script not found: {script_path}'}

        # Run the script
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )

        end_time = time.time()
        duration = end_time - start_time

        if result.returncode == 0:
            logger.info(f"✅ {component_name} completed successfully in {duration:.1f}s")

            # Try to find and load results JSON if it exists
            results_data = None
            for results_dir in ['profiling_results', 'line_profiling_results', 'rust_integration_guide']:
                results_path = Path(results_dir)
                if results_path.exists():
                    # Find the most recent JSON file
                    json_files = list(results_path.glob('*.json'))
                    if json_files:
                        latest_file = max(json_files, key=lambda p: p.stat().st_mtime)
                        try:
                            with open(latest_file, 'r') as f:
                                results_data = json.load(f)
                            logger.info(f"   📄 Results loaded from: {latest_file}")
                            break
                        except Exception as e:
                            logger.warning(f"   ⚠️  Could not load results: {e}")

            return {
                'status': 'success',
                'duration': duration,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'results_data': results_data
            }
        else:
            logger.error(f"❌ {component_name} failed with return code {result.returncode}")
            logger.error(f"   Error: {result.stderr[:500]}...")
            return {
                'status': 'error',
                'error': result.stderr,
                'stdout': result.stdout,
                'duration': duration
            }

    except subprocess.TimeoutExpired:
        logger.error(f"⏰ {component_name} timed out after 10 minutes")
        return {'status': 'timeout', 'error': 'Process timed out'}

    except Exception as e:
        logger.error(f"💥 {component_name} failed with exception: {e}")
        return {'status': 'error', 'error': str(e)}

def summarize_audit_results(results: dict) -> dict:
    """Create comprehensive summary of all audit results"""
    logger.info("📊 Creating comprehensive audit summary...")

    summary = {
        'audit_metadata': {
            'timestamp': datetime.now().isoformat(),
            'total_components': len(results),
            'successful_components': len([r for r in results.values() if r.get('status') == 'success']),
            'total_duration_minutes': sum(r.get('duration', 0) for r in results.values()) / 60
        },
        'component_status': {},
        'performance_insights': {},
        'rust_readiness_assessment': {},
        'recommendations': {}
    }

    # Component status summary
    for component, result in results.items():
        summary['component_status'][component] = {
            'status': result.get('status', 'unknown'),
            'duration': result.get('duration', 0),
            'has_results': result.get('results_data') is not None
        }

    # Extract key insights from successful components
    successful_results = [r for r in results.values() if r.get('status') == 'success' and r.get('results_data')]

    if successful_results:
        # Try to extract performance profiling insights
        for result in successful_results:
            data = result.get('results_data', {})

            # CPU profiling insights
            if 'cpu_profiling' in data:
                cpu_data = data['cpu_profiling']
                rust_candidates = []
                for dataset, dataset_results in cpu_data.items():
                    candidates = dataset_results.get('rust_candidates', [])
                    rust_candidates.extend(candidates)

                summary['performance_insights']['cpu_bottlenecks'] = {
                    'total_rust_candidates': len(rust_candidates),
                    'high_priority_candidates': len([c for c in rust_candidates if c.get('priority') == 'HIGH']),
                    'top_candidates': rust_candidates[:5]  # Top 5
                }

            # Polars comparison insights
            if 'polars_comparison' in data:
                polars_data = data['polars_comparison']
                speedups = [r['speedup'] for r in polars_data.values() if isinstance(r, dict) and 'speedup' in r]

                if speedups:
                    avg_speedup = sum(speedups) / len(speedups)
                    summary['performance_insights']['polars_performance'] = {
                        'average_speedup': avg_speedup,
                        'max_speedup': max(speedups),
                        'datasets_tested': len(speedups),
                        'recommendation': 'HIGH_PRIORITY' if avg_speedup > 2.0 else 'MEDIUM_PRIORITY' if avg_speedup > 1.5 else 'LOW_PRIORITY'
                    }

            # Memory profiling insights
            if 'memory_profiling' in data:
                memory_data = data['memory_profiling']
                memory_growth = [r.get('memory_growth_mb', 0) for r in memory_data.values() if isinstance(r, dict)]

                if memory_growth:
                    summary['performance_insights']['memory_efficiency'] = {
                        'average_memory_growth_mb': sum(memory_growth) / len(memory_growth),
                        'max_memory_growth_mb': max(memory_growth),
                        'memory_per_row_mb': sum(r.get('memory_per_row', 0) for r in memory_data.values() if isinstance(r, dict)) / len(memory_growth),
                        'assessment': 'GOOD' if max(memory_growth) < 100 else 'NEEDS_IMPROVEMENT'
                    }

            # Rust recommendations
            if 'recommendations' in data:
                recommendations = data['recommendations']
                summary['rust_readiness_assessment'] = {
                    'readiness_score': recommendations.get('overall_assessment', {}).get('rust_readiness_score', 0),
                    'strategy': recommendations.get('integration_strategy', {}).get('strategy', 'UNKNOWN'),
                    'priority_actions': recommendations.get('priority_actions', [])
                }

    # Generate final recommendations
    insights = summary['performance_insights']

    polars_benefit = insights.get('polars_performance', {}).get('recommendation', 'LOW_PRIORITY')
    cpu_candidates = insights.get('cpu_bottlenecks', {}).get('high_priority_candidates', 0)

    if polars_benefit == 'HIGH_PRIORITY' and cpu_candidates >= 2:
        recommendation = "HYBRID_APPROACH"
        rationale = "High Polars benefits + significant CPU bottlenecks → Polars first, then selective Rust"
    elif polars_benefit == 'HIGH_PRIORITY':
        recommendation = "POLARS_FIRST"
        rationale = "Polars provides significant gains → Start with Polars migration"
    elif cpu_candidates >= 3:
        recommendation = "RUST_FOCUSED"
        rationale = "Multiple high-priority CPU bottlenecks → Direct Rust integration"
    elif cpu_candidates >= 1:
        recommendation = "SELECTIVE_RUST"
        rationale = "Some CPU bottlenecks identified → Targeted Rust implementation"
    else:
        recommendation = "OPTIMIZE_PYTHON"
        rationale = "Limited performance bottlenecks → Focus on Python optimization first"

    summary['recommendations'] = {
        'primary_recommendation': recommendation,
        'rationale': rationale,
        'immediate_actions': [
            "Review detailed profiling reports",
            "Test Polars on representative datasets" if polars_benefit != 'LOW_PRIORITY' else "Profile code more thoroughly",
            "Implement top-priority optimization",
            "Set up performance monitoring"
        ]
    }

    return summary

def create_executive_report(summary: dict, output_path: str):
    """Create executive summary report"""
    logger.info("📝 Creating executive summary report...")

    report = f"""# Schlep-engine Rust Readiness Audit - Executive Summary

**Audit Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Total Analysis Time:** {summary['audit_metadata']['total_duration_minutes']:.1f} minutes

## 🎯 Executive Summary

**Primary Recommendation:** {summary['recommendations']['primary_recommendation']}

**Rationale:** {summary['recommendations']['rationale']}

## 📊 Key Findings

### Component Status
- **Total Components Analyzed:** {summary['audit_metadata']['total_components']}
- **Successful Analyses:** {summary['audit_metadata']['successful_components']}
- **Success Rate:** {(summary['audit_metadata']['successful_components'] / summary['audit_metadata']['total_components'] * 100):.1f}%

### Performance Insights

#### CPU Performance Analysis
"""

    cpu_insights = summary['performance_insights'].get('cpu_bottlenecks', {})
    if cpu_insights:
        report += f"""
- **Total Rust Candidates Identified:** {cpu_insights['total_rust_candidates']}
- **High Priority Bottlenecks:** {cpu_insights['high_priority_candidates']}
- **Top Function Candidates:**
"""
        for i, candidate in enumerate(cpu_insights.get('top_candidates', [])[:3], 1):
            report += f"  {i}. {candidate.get('function', 'Unknown')} - {candidate.get('priority', 'UNKNOWN')} priority\n"
    else:
        report += "\n- CPU profiling data not available or no significant bottlenecks found\n"

    polars_insights = summary['performance_insights'].get('polars_performance', {})
    if polars_insights:
        report += f"""
#### Polars vs Pandas Analysis
- **Average Speedup:** {polars_insights['average_speedup']:.2f}x
- **Maximum Speedup:** {polars_insights['max_speedup']:.2f}x
- **Recommendation Priority:** {polars_insights['recommendation']}
- **Datasets Tested:** {polars_insights['datasets_tested']}
"""

    memory_insights = summary['performance_insights'].get('memory_efficiency', {})
    if memory_insights:
        report += f"""
#### Memory Usage Analysis
- **Average Memory Growth:** {memory_insights['average_memory_growth_mb']:.1f} MB
- **Memory per Row:** {memory_insights['memory_per_row_mb']:.4f} MB
- **Assessment:** {memory_insights['assessment']}
"""

    rust_assessment = summary.get('rust_readiness_assessment', {})
    if rust_assessment:
        report += f"""
#### Rust Readiness Assessment
- **Readiness Score:** {rust_assessment['readiness_score']}/100
- **Recommended Strategy:** {rust_assessment['strategy']}
- **Priority Actions:** {len(rust_assessment.get('priority_actions', []))} identified
"""

    report += f"""
## 🚀 Immediate Action Items

{chr(10).join(f"1. {action}" if i == 0 else f"{i+1}. {action}" for i, action in enumerate(summary['recommendations']['immediate_actions']))}

## 📋 Component Details

| Component | Status | Duration | Results Available |
|-----------|--------|----------|-------------------|
"""

    for component, status in summary['component_status'].items():
        status_icon = "✅" if status['status'] == 'success' else "❌" if status['status'] == 'error' else "⏰"
        results_icon = "📄" if status['has_results'] else "📭"
        report += f"| {component.replace('_', ' ').title()} | {status_icon} {status['status']} | {status['duration']:.1f}s | {results_icon} |\n"

    report += f"""
## 🎯 Next Steps

### If Recommendation is "{summary['recommendations']['primary_recommendation']}":

"""

    if summary['recommendations']['primary_recommendation'] == 'POLARS_FIRST':
        report += """1. **Week 1-2:** Install Polars and test on sample datasets
2. **Week 3-4:** Migrate key data processing pipelines to Polars
3. **Week 5-6:** Measure performance improvements and identify remaining bottlenecks
4. **Week 7+:** Consider selective Rust integration for remaining issues"""

    elif summary['recommendations']['primary_recommendation'] == 'RUST_FOCUSED':
        report += """1. **Week 1-2:** Set up Rust development environment and team training
2. **Week 3-6:** Implement Rust modules for top 2-3 CPU bottlenecks
3. **Week 7-8:** Integration testing and performance validation
4. **Week 9+:** Gradual rollout and monitoring"""

    elif summary['recommendations']['primary_recommendation'] == 'HYBRID_APPROACH':
        report += """1. **Week 1-2:** Start Polars migration for immediate gains
2. **Week 3-4:** Set up Rust development environment
3. **Week 5-8:** Implement Rust modules for remaining bottlenecks
4. **Week 9-10:** Integration testing and performance validation"""

    else:
        report += """1. **Week 1:** Profile code more thoroughly to identify bottlenecks
2. **Week 2:** Optimize Python algorithms and data structures
3. **Week 3:** Implement caching and other Python-native optimizations
4. **Week 4+:** Re-evaluate for Rust integration if needed"""

    report += f"""

## 📞 Support

For questions about this audit:
- Review detailed reports in component output directories
- Check audit log file for detailed execution information
- Use the provided profiling scripts for deeper analysis

---

*Generated by Schlep-engine Rust Readiness Audit*
*Audit completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

    with open(output_path, 'w') as f:
        f.write(report)

    logger.info(f"📄 Executive report saved to: {output_path}")

def main():
    """Main audit orchestration function"""
    print_banner()
    logger.info("🚀 Starting comprehensive Rust readiness audit...")

    # Define audit components
    components = {
        'performance_profiling': {
            'script': 'performance_profiler.py',
            'description': 'CPU profiling, memory analysis, and benchmarking'
        },
        'line_profiling': {
            'script': 'line_profiler_runner.py',
            'description': 'Line-by-line performance analysis'
        },
        'rust_integration_guide': {
            'script': 'rust_integration_guide.py',
            'description': 'Rust integration strategies and recommendations'
        }
    }

    # Run each component
    results = {}
    total_start_time = time.time()

    for component_name, component_info in components.items():
        results[component_name] = run_audit_component(
            component_name,
            component_info['script'],
            component_info['description']
        )

        # Brief pause between components
        time.sleep(1)

    total_duration = time.time() - total_start_time

    # Create comprehensive summary
    summary = summarize_audit_results(results)
    summary['audit_metadata']['total_audit_duration'] = total_duration

    # Save detailed results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Save JSON summary
    json_output = f"rust_readiness_audit_complete_{timestamp}.json"
    with open(json_output, 'w') as f:
        json.dump(summary, f, indent=2, default=str)

    # Create executive report
    report_output = f"rust_readiness_executive_summary_{timestamp}.md"
    create_executive_report(summary, report_output)

    # Print final summary
    print(f"\n{'='*80}")
    print("🎉 AUDIT COMPLETE!")
    print(f"{'='*80}")
    print(f"📊 Total Duration: {total_duration/60:.1f} minutes")
    print(f"✅ Successful Components: {summary['audit_metadata']['successful_components']}/{summary['audit_metadata']['total_components']}")
    print(f"🎯 Primary Recommendation: {summary['recommendations']['primary_recommendation']}")
    print(f"📄 Executive Summary: {report_output}")
    print(f"📋 Detailed Results: {json_output}")

    # Print key insights
    insights = summary['performance_insights']
    if 'polars_performance' in insights:
        polars = insights['polars_performance']
        print(f"⚡ Polars Potential: {polars['average_speedup']:.2f}x average speedup")

    if 'cpu_bottlenecks' in insights:
        cpu = insights['cpu_bottlenecks']
        print(f"🔍 CPU Bottlenecks: {cpu['high_priority_candidates']} high-priority candidates")

    rust_assessment = summary.get('rust_readiness_assessment', {})
    if rust_assessment:
        print(f"🦀 Rust Readiness: {rust_assessment['readiness_score']}/100")

    print(f"\n🚀 Next Step: {summary['recommendations']['immediate_actions'][0]}")
    print(f"{'='*80}")

    logger.info("✅ Comprehensive Rust readiness audit completed successfully!")
    return summary

if __name__ == "__main__":
    try:
        audit_results = main()
        sys.exit(0)
    except KeyboardInterrupt:
        logger.info("⏹️  Audit interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Audit failed with error: {e}")
        sys.exit(1)