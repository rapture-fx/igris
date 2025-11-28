/**
 * Performance benchmarks - Rust WASM vs TypeScript
 *
 * Run with: npm run bench
 *
 * Target: Rust WASM should be 3-5× faster than TypeScript
 */

import { BetaSampler, getDefaultBayesianState } from '../bayesian-state';
import { ThompsonRouter } from '../thompson-router';

// Benchmark utilities
function benchmark(name: string, iterations: number, fn: () => void): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const totalMs = end - start;
  const avgMs = totalMs / iterations;

  console.log(`\n${name}:`);
  console.log(`  Iterations: ${iterations.toLocaleString()}`);
  console.log(`  Total time: ${totalMs.toFixed(2)}ms`);
  console.log(`  Avg per iteration: ${avgMs.toFixed(4)}ms`);
  console.log(`  Throughput: ${(iterations / (totalMs / 1000)).toFixed(0)} ops/sec`);

  return avgMs;
}

async function main() {
  console.log('='.repeat(60));
  console.log('EscapeVector Performance Benchmark');
  console.log('Rust WASM vs TypeScript');
  console.log('='.repeat(60));

  const ITERATIONS = 100000;

  // ========================================================================
  // Benchmark 1: Beta Distribution Sampling
  // ========================================================================
  console.log('\n\n[1] Beta Distribution Sampling (α=2, β=3)');
  console.log('-'.repeat(60));

  const tsBetaTime = benchmark(
    'TypeScript Beta Sampler',
    ITERATIONS,
    () => {
      BetaSampler.sample(2.0, 3.0);
    }
  );

  // Note: WASM benchmark would go here after build completes
  console.log('\nNote: Rust WASM benchmark will be added after build completes');
  console.log('Expected: 3-5× faster than TypeScript');

  // ========================================================================
  // Benchmark 2: Thompson Sampling Arm Selection
  // ========================================================================
  console.log('\n\n[2] Thompson Sampling Arm Selection');
  console.log('-'.repeat(60));

  const state = getDefaultBayesianState();
  const router = new ThompsonRouter(state);

  const tsArmSelectionTime = benchmark(
    'TypeScript Arm Selection',
    ITERATIONS / 10, // Fewer iterations for heavier operation
    () => {
      // Simulate arm selection with different alpha/beta values
      state.arms[0].alpha = Math.random() * 10 + 1;
      state.arms[0].beta = Math.random() * 10 + 1;
      state.arms[1].alpha = Math.random() * 10 + 1;
      state.arms[1].beta = Math.random() * 10 + 1;
      state.arms[2].alpha = Math.random() * 10 + 1;
      state.arms[2].beta = Math.random() * 10 + 1;

      // This triggers Thompson Sampling internally
      router.getState();
    }
  );

  console.log('\nNote: Rust WASM benchmark will be added after build completes');
  console.log('Expected: 3-5× faster than TypeScript');

  // ========================================================================
  // Summary
  // ========================================================================
  console.log('\n\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`\nTypeScript Beta Sampling: ${tsBetaTime.toFixed(4)}ms per operation`);
  console.log(`TypeScript Arm Selection: ${tsArmSelectionTime.toFixed(4)}ms per operation`);
  console.log('\nTarget for Rust WASM:');
  console.log(`  Beta Sampling: ${(tsBetaTime / 5).toFixed(4)}ms - ${(tsBetaTime / 3).toFixed(4)}ms per operation (3-5× faster)`);
  console.log(`  Arm Selection: ${(tsArmSelectionTime / 5).toFixed(4)}ms - ${(tsArmSelectionTime / 3).toFixed(4)}ms per operation (3-5× faster)`);
  console.log('\n' + '='.repeat(60));
}

// Run benchmarks
main().catch(console.error);
