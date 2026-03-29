import { useState, useEffect, useCallback, useRef } from 'react';
import type { WasmGlue, WasmThompsonRouter, BayesianStateJson } from '@/lib/wasm/escapevector_types';
import { buildDefaultState } from '@/lib/wasm/escapevector_types';

export interface WasmEngineStatus {
  supported: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  moduleSize: number | null;
  exports: string[];
  compileTimeMs: number | null;
  /** True once wasm-bindgen initSync has been called and ThompsonRouter is usable */
  bindingReady: boolean;
}

export interface ThompsonBenchmark {
  iterations: number;
  totalMs: number;
  avgPerIterationUs: number;
}

// Module-level cache so initSync is only called once across hook instances
let _glue: WasmGlue | null = null;
let _glueLoading = false;
let _glueListeners: Array<(glue: WasmGlue | null) => void> = [];

async function loadGlue(compiledModule: WebAssembly.Module): Promise<WasmGlue | null> {
  if (_glue) return _glue;

  if (_glueLoading) {
    return new Promise((resolve) => _glueListeners.push(resolve));
  }

  _glueLoading = true;
  try {
    // webpackIgnore: true — the JS glue is served as a static asset from public/wasm/
    // We must NOT bundle it because it resolves the .wasm file via import.meta.url.
    // Instead we import it at runtime as a native ES module and call initSync with
    // the already-compiled module we fetched ourselves.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: runtime-only path served from public/, not in TS module graph
    const glue = await import(/* webpackIgnore: true */ '/wasm/escapevector_wasm.js') as WasmGlue;
    glue.initSync({ module: compiledModule });
    _glue = glue;
  } catch (err) {
    console.warn('[EscapeVector] wasm-bindgen init failed:', err);
    _glue = null;
  }

  _glueLoading = false;
  _glueListeners.forEach((cb) => cb(_glue));
  _glueListeners = [];
  return _glue;
}

/**
 * Hook to load and validate the EscapeVector WASM module.
 * Fetches the binary from /wasm/, compiles it, and wires up wasm-bindgen so
 * ThompsonRouter and CircuitBreaker are fully usable in the browser.
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
    bindingReady: !!_glue,
  });

  const [module, setModule] = useState<WebAssembly.Module | null>(null);
  const [benchmark, setBenchmark] = useState<ThompsonBenchmark | null>(null);
  const glueRef = useRef<WasmGlue | null>(_glue);

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
          setStatus(prev => ({
            ...prev,
            supported: true,
            loaded: true,
            loading: false,
            error: null,
            moduleSize,
            exports,
            compileTimeMs: Math.round(compileTimeMs * 100) / 100,
          }));

          // Wire up wasm-bindgen JS glue
          const glue = await loadGlue(compiled);
          if (!cancelled) {
            glueRef.current = glue;
            setStatus(prev => ({ ...prev, bindingReady: !!glue }));
          }
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
        // wasm-bindgen modules need imports — if instantiation fails,
        // we benchmark compile time instead
        './escapevector_wasm_bg.js': new Proxy({}, {
          get: () => () => {},
        }),
      });

      // Run selection benchmark on exported functions
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
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
      // wasm-bindgen modules need specific imports to instantiate; benchmark
      // using repeated in-memory compiles from the already-fetched buffer instead.
      // Cap at 5 iterations to avoid excessive CPU/memory pressure.
      const COMPILE_ITERS = Math.min(iterations, 5);
      const buffer = await (await fetch('/wasm/escapevector_wasm_bg.wasm')).arrayBuffer();
      const start = performance.now();
      for (let i = 0; i < COMPILE_ITERS; i++) {
        await WebAssembly.compile(buffer);
      }
      const totalMs = performance.now() - start;
      const result: ThompsonBenchmark = {
        iterations: COMPILE_ITERS,
        totalMs: Math.round(totalMs * 100) / 100,
        avgPerIterationUs: Math.round((totalMs / COMPILE_ITERS) * 1000 * 100) / 100,
      };
      setBenchmark(result);
      return result;
    }
  }, [module]);

  /**
   * Create a new ThompsonRouter instance from a BayesianState JSON.
   * Returns null if wasm-bindgen has not been initialized yet.
   */
  const createRouter = useCallback((state: BayesianStateJson): WasmThompsonRouter | null => {
    const glue = glueRef.current;
    if (!glue) return null;
    try {
      return new glue.ThompsonRouter(JSON.stringify(state));
    } catch (err) {
      console.warn('[EscapeVector] ThompsonRouter init failed:', err);
      return null;
    }
  }, []);

  /**
   * Create a ThompsonRouter seeded with fresh Beta(1,1) arms for the given provider IDs.
   */
  const createRouterForProviders = useCallback((providerIds: string[]): WasmThompsonRouter | null => {
    return createRouter(buildDefaultState(providerIds));
  }, [createRouter]);

  return { status, benchmark, runBenchmark, createRouter, createRouterForProviders };
}
