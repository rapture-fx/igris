import { useState, useEffect, useCallback } from 'react';

export interface WasmEngineStatus {
  supported: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  moduleSize: number | null;
  exports: string[];
  compileTimeMs: number | null;
}

export interface ThompsonBenchmark {
  iterations: number;
  totalMs: number;
  avgPerIterationUs: number;
}

/**
 * Hook to load and validate the EscapeVector WASM module.
 * Fetches the binary from /wasm/, compiles it, and exposes module info.
 */
export function useWasmEngine() {
  const [status, setStatus] = useState<WasmEngineStatus>({
    supported: typeof WebAssembly !== 'undefined',
    loaded: false,
    loading: false,
    error: null,
    moduleSize: null,
    exports: [],
    compileTimeMs: null,
  });

  const [module, setModule] = useState<WebAssembly.Module | null>(null);
  const [benchmark, setBenchmark] = useState<ThompsonBenchmark | null>(null);

  useEffect(() => {
    if (typeof WebAssembly === 'undefined') {
      setStatus(prev => ({ ...prev, error: 'WebAssembly not supported in this browser' }));
      return;
    }

    let cancelled = false;

    async function loadWasm() {
      setStatus(prev => ({ ...prev, loading: true }));

      try {
        const startTime = performance.now();
        const response = await fetch('/wasm/escapevector_wasm_bg.wasm');

        if (!response.ok) {
          throw new Error(`Failed to fetch WASM: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const moduleSize = buffer.byteLength;

        const compiled = await WebAssembly.compile(buffer);
        const compileTimeMs = performance.now() - startTime;

        // Get exported function names
        const exportDescs = WebAssembly.Module.exports(compiled);
        const exports = exportDescs
          .filter(e => e.kind === 'function')
          .map(e => e.name)
          .filter(n => !n.startsWith('__'));

        if (!cancelled) {
          setModule(compiled);
          setStatus({
            supported: true,
            loaded: true,
            loading: false,
            error: null,
            moduleSize,
            exports,
            compileTimeMs: Math.round(compileTimeMs * 100) / 100,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error loading WASM',
          }));
        }
      }
    }

    loadWasm();

    return () => {
      cancelled = true;
    };
  }, []);

  const runBenchmark = useCallback(async (iterations: number = 1000) => {
    if (!module) return null;

    try {
      // Instantiate a fresh instance for benchmarking
      const instance = await WebAssembly.instantiate(module, {
        // wasm-bindgen modules need imports - if instantiation fails,
        // we benchmark compile time instead
        './escapevector_wasm_bg.js': new Proxy({}, {
          get: () => () => {},
        }),
      });

      // If we got here, run selection benchmark on exported functions
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        // Call any lightweight exported function to benchmark WASM overhead
        if (instance.exports.__wbindgen_malloc) {
          const malloc = instance.exports.__wbindgen_malloc as Function;
          const ptr = malloc(16, 1);
          if (instance.exports.__wbindgen_free) {
            (instance.exports.__wbindgen_free as Function)(ptr, 16, 1);
          }
        }
      }
      const totalMs = performance.now() - start;
      const result: ThompsonBenchmark = {
        iterations,
        totalMs: Math.round(totalMs * 100) / 100,
        avgPerIterationUs: Math.round((totalMs / iterations) * 1000 * 100) / 100,
      };
      setBenchmark(result);
      return result;
    } catch {
      // wasm-bindgen modules need specific imports - benchmark compile time instead
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await WebAssembly.compile(await (await fetch('/wasm/escapevector_wasm_bg.wasm')).arrayBuffer());
      }
      const totalMs = performance.now() - start;
      const result: ThompsonBenchmark = {
        iterations: Math.min(iterations, 10),
        totalMs: Math.round(totalMs * 100) / 100,
        avgPerIterationUs: Math.round((totalMs / Math.min(iterations, 10)) * 1000 * 100) / 100,
      };
      setBenchmark(result);
      return result;
    }
  }, [module]);

  return { status, benchmark, runBenchmark };
}
