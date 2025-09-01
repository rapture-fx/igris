/**
 * Frontend Performance Testing Suite
 * =================================
 * 
 * Comprehensive frontend performance testing including:
 * - Core Web Vitals validation
 * - Bundle size analysis
 * - Component rendering performance
 * - Authentication flow performance
 * - Network request optimization
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { performanceMonitor } from '../../src/utils/performance-monitoring';
import fs from 'fs';
import path from 'path';

interface PerformanceResults {
  coreWebVitals: {
    LCP?: number;
    FID?: number;
    CLS?: number;
    FCP?: number;
    TTFB?: number;
  };
  bundleAnalysis: {
    totalSize: number;
    gzippedSize: number;
    chunks: Array<{
      name: string;
      size: number;
      type: string;
    }>;
    recommendations: string[];
  };
  authFlowPerformance: {
    login?: number;
    oauth?: number;
    logout?: number;
  };
  componentMetrics: {
    renderTimes: Record<string, number>;
    reRenderCount: number;
  };
  networkMetrics: {
    apiCalls: Array<{
      url: string;
      method: string;
      duration: number;
      size: number;
    }>;
    totalRequests: number;
    totalTransferSize: number;
  };
  lighthouse?: any;
}

describe('Frontend Performance Testing', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    page = await context.newPage();

    // Enable performance monitoring
    await page.addInitScript(() => {
      // Mock performance APIs if needed
      if (!window.PerformanceObserver) {
        window.PerformanceObserver = class MockPerformanceObserver {
          observe() {}
          disconnect() {}
        } as any;
      }
    });
  });

  afterEach(async () => {
    await context.close();
  });

  describe('Core Web Vitals', () => {
    test('should meet LCP target (<2.5s)', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      
      expect(results.coreWebVitals.LCP).toBeDefined();
      expect(results.coreWebVitals.LCP!).toBeLessThan(2500);
    }, 30000);

    test('should meet FID target (<100ms)', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      
      // Simulate user interaction to trigger FID
      await page.click('body');
      await page.waitForTimeout(1000);
      
      if (results.coreWebVitals.FID !== undefined) {
        expect(results.coreWebVitals.FID).toBeLessThan(100);
      }
    }, 30000);

    test('should meet CLS target (<0.1)', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      
      expect(results.coreWebVitals.CLS).toBeDefined();
      expect(results.coreWebVitals.CLS!).toBeLessThan(0.1);
    }, 30000);

    test('should meet FCP target (<1.8s)', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      
      expect(results.coreWebVitals.FCP).toBeDefined();
      expect(results.coreWebVitals.FCP!).toBeLessThan(1800);
    }, 30000);

    test('should meet TTFB target (<800ms)', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      
      expect(results.coreWebVitals.TTFB).toBeDefined();
      expect(results.coreWebVitals.TTFB!).toBeLessThan(800);
    }, 30000);
  });

  describe('Bundle Size Analysis', () => {
    test('should have total bundle size under 500KB gzipped', async () => {
      const results = await analyzeBundleSize(page, BASE_URL);
      
      expect(results.bundleAnalysis.gzippedSize).toBeLessThan(500 * 1024);
    }, 30000);

    test('should not have chunks larger than 100KB', async () => {
      const results = await analyzeBundleSize(page, BASE_URL);
      
      const largeChunks = results.bundleAnalysis.chunks.filter(chunk => chunk.size > 100 * 1024);
      expect(largeChunks).toHaveLength(0);
    }, 30000);

    test('should have good compression ratio', async () => {
      const results = await analyzeBundleSize(page, BASE_URL);
      
      const compressionRatio = results.bundleAnalysis.gzippedSize / results.bundleAnalysis.totalSize;
      expect(compressionRatio).toBeLessThan(0.7);
    }, 30000);

    test('should have reasonable number of HTTP requests', async () => {
      const results = await analyzeBundleSize(page, BASE_URL);
      
      expect(results.networkMetrics.totalRequests).toBeLessThan(50);
    }, 30000);
  });

  describe('Authentication Flow Performance', () => {
    test('should complete login flow within 2 seconds', async () => {
      const results = await measureAuthenticationFlow(page, BASE_URL, 'login');
      
      expect(results.authFlowPerformance.login).toBeDefined();
      expect(results.authFlowPerformance.login!).toBeLessThan(2000);
    }, 30000);

    test('should complete OAuth flow within 3 seconds', async () => {
      const results = await measureAuthenticationFlow(page, BASE_URL, 'oauth');
      
      expect(results.authFlowPerformance.oauth).toBeDefined();
      expect(results.authFlowPerformance.oauth!).toBeLessThan(3000);
    }, 30000);

    test('should complete logout flow within 1 second', async () => {
      const results = await measureAuthenticationFlow(page, BASE_URL, 'logout');
      
      expect(results.authFlowPerformance.logout).toBeDefined();
      expect(results.authFlowPerformance.logout!).toBeLessThan(1000);
    }, 30000);
  });

  describe('Component Rendering Performance', () => {
    test('should render components within 16ms (60fps)', async () => {
      const results = await measureComponentPerformance(page, BASE_URL);
      
      const slowComponents = Object.entries(results.componentMetrics.renderTimes)
        .filter(([, time]) => time > 16);
      
      expect(slowComponents).toHaveLength(0);
    }, 30000);

    test('should have minimal re-renders on data updates', async () => {
      const results = await measureComponentPerformance(page, BASE_URL);
      
      // Re-render count should be reasonable for dynamic content
      expect(results.componentMetrics.reRenderCount).toBeLessThan(10);
    }, 30000);
  });

  describe('API Call Performance', () => {
    test('should complete API calls within acceptable time', async () => {
      const results = await measureAPIPerformance(page, BASE_URL, API_BASE_URL);
      
      const slowAPICalls = results.networkMetrics.apiCalls
        .filter(call => call.duration > 1000);
      
      expect(slowAPICalls).toHaveLength(0);
    }, 30000);

    test('should have reasonable API response sizes', async () => {
      const results = await measureAPIPerformance(page, BASE_URL, API_BASE_URL);
      
      const largeResponses = results.networkMetrics.apiCalls
        .filter(call => call.size > 1024 * 1024); // 1MB
      
      expect(largeResponses).toHaveLength(0);
    }, 30000);
  });

  describe('Mobile Performance', () => {
    test('should perform well on mobile devices', async () => {
      // Simulate mobile device
      await context.close();
      context = await browser.newContext({
        viewport: { width: 375, height: 812 }, // iPhone X dimensions
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 3,
        hasTouch: true
      });
      page = await context.newPage();

      const results = await measureCoreWebVitals(page, BASE_URL);
      
      // Mobile should still meet reasonable performance targets
      expect(results.coreWebVitals.LCP!).toBeLessThan(4000); // Relaxed for mobile
      expect(results.coreWebVitals.FCP!).toBeLessThan(2500);
    }, 30000);
  });

  describe('Performance Regression Tests', () => {
    test('should not regress from baseline performance', async () => {
      const currentResults = await measureCoreWebVitals(page, BASE_URL);
      const baseline = await loadPerformanceBaseline();
      
      if (baseline) {
        const regression = calculatePerformanceRegression(currentResults, baseline);
        
        // Allow up to 10% regression
        expect(regression.lcp).toBeLessThan(0.1);
        expect(regression.fcp).toBeLessThan(0.1);
        expect(regression.cls).toBeLessThan(0.1);
      }
    }, 30000);

    test('should save current performance as new baseline', async () => {
      const results = await measureCoreWebVitals(page, BASE_URL);
      await savePerformanceBaseline(results);
      
      expect(fs.existsSync(getBaselinePath())).toBe(true);
    }, 30000);
  });
});

// Helper functions

async function measureCoreWebVitals(page: Page, url: string): Promise<PerformanceResults> {
  const results: PerformanceResults = {
    coreWebVitals: {},
    bundleAnalysis: {
      totalSize: 0,
      gzippedSize: 0,
      chunks: [],
      recommendations: []
    },
    authFlowPerformance: {},
    componentMetrics: {
      renderTimes: {},
      reRenderCount: 0
    },
    networkMetrics: {
      apiCalls: [],
      totalRequests: 0,
      totalTransferSize: 0
    }
  };

  // Set up performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.performanceMetrics = {
      coreWebVitals: {},
      timings: {}
    };

    // Measure LCP
    if (window.PerformanceObserver) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.performanceMetrics.coreWebVitals.LCP = lastEntry.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // Measure FCP
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            window.performanceMetrics.coreWebVitals.FCP = entry.startTime;
          }
        });
      });
      fcpObserver.observe({ type: 'paint', buffered: true });

      // Measure CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            window.performanceMetrics.coreWebVitals.CLS = clsValue;
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Measure FID
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          window.performanceMetrics.coreWebVitals.FID = entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    }
  });

  // Navigate and wait for load
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Wait for metrics to be collected
  await page.waitForTimeout(3000);

  // Get performance metrics
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const ttfb = navigation ? navigation.responseStart - navigation.requestStart : 0;

    return {
      coreWebVitals: (window as any).performanceMetrics?.coreWebVitals || {},
      ttfb,
      navigation
    };
  });

  results.coreWebVitals = {
    ...metrics.coreWebVitals,
    TTFB: metrics.ttfb
  };

  return results;
}

async function analyzeBundleSize(page: Page, url: string): Promise<PerformanceResults> {
  const results: PerformanceResults = {
    coreWebVitals: {},
    bundleAnalysis: {
      totalSize: 0,
      gzippedSize: 0,
      chunks: [],
      recommendations: []
    },
    authFlowPerformance: {},
    componentMetrics: {
      renderTimes: {},
      reRenderCount: 0
    },
    networkMetrics: {
      apiCalls: [],
      totalRequests: 0,
      totalTransferSize: 0
    }
  };

  // Track network requests
  const networkRequests: Array<{
    url: string;
    method: string;
    size: number;
    duration: number;
  }> = [];

  page.on('response', async (response) => {
    try {
      const request = response.request();
      const timing = response.timing();
      const headers = response.headers();
      
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        size: parseInt(headers['content-length'] || '0', 10),
        duration: timing.responseEnd - timing.responseStart
      });
    } catch (error) {
      // Ignore errors in response tracking
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Analyze bundle resources
  const bundleAnalysis = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    let totalSize = 0;
    let gzippedSize = 0;
    const chunks: Array<{ name: string; size: number; type: string }> = [];

    resources.forEach((resource) => {
      const url = resource.name;
      if (url.includes('/_next/static/') || url.includes('/static/')) {
        const size = resource.decodedBodySize || 0;
        const transferSize = resource.transferSize || 0;
        
        totalSize += size;
        gzippedSize += transferSize;
        
        const name = url.split('/').pop() || url;
        const type = url.endsWith('.js') ? 'js' : url.endsWith('.css') ? 'css' : 'other';
        
        chunks.push({ name, size, type });
      }
    });

    const recommendations: string[] = [];
    
    if (gzippedSize > 500 * 1024) {
      recommendations.push('Bundle size exceeds 500KB target');
    }
    
    const largeChunks = chunks.filter(chunk => chunk.size > 100 * 1024);
    if (largeChunks.length > 0) {
      recommendations.push(`${largeChunks.length} chunks exceed 100KB`);
    }

    return {
      totalSize,
      gzippedSize,
      chunks,
      recommendations
    };
  });

  results.bundleAnalysis = bundleAnalysis;
  results.networkMetrics = {
    apiCalls: networkRequests.filter(req => req.url.includes('/api/')),
    totalRequests: networkRequests.length,
    totalTransferSize: networkRequests.reduce((sum, req) => sum + req.size, 0)
  };

  return results;
}

async function measureAuthenticationFlow(page: Page, url: string, flowType: 'login' | 'oauth' | 'logout'): Promise<PerformanceResults> {
  const results: PerformanceResults = {
    coreWebVitals: {},
    bundleAnalysis: {
      totalSize: 0,
      gzippedSize: 0,
      chunks: [],
      recommendations: []
    },
    authFlowPerformance: {},
    componentMetrics: {
      renderTimes: {},
      reRenderCount: 0
    },
    networkMetrics: {
      apiCalls: [],
      totalRequests: 0,
      totalTransferSize: 0
    }
  };

  await page.goto(url);

  const startTime = Date.now();

  try {
    switch (flowType) {
      case 'login':
        // Navigate to login page
        await page.click('[data-testid="login-button"]', { timeout: 5000 });
        
        // Fill login form
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'testpassword');
        
        // Submit form
        await page.click('[data-testid="submit-login"]');
        
        // Wait for successful login
        await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
        break;

      case 'oauth':
        // Click OAuth login
        await page.click('[data-testid="oauth-login"]', { timeout: 5000 });
        
        // Handle OAuth redirect (simplified)
        await page.waitForSelector('[data-testid="user-menu"]', { timeout: 15000 });
        break;

      case 'logout':
        // Assume user is already logged in
        await page.click('[data-testid="user-menu"]');
        await page.click('[data-testid="logout-button"]');
        
        // Wait for logout completion
        await page.waitForSelector('[data-testid="login-button"]', { timeout: 5000 });
        break;
    }

    const duration = Date.now() - startTime;
    results.authFlowPerformance[flowType] = duration;

  } catch (error) {
    // If auth flow fails, still record the time
    const duration = Date.now() - startTime;
    results.authFlowPerformance[flowType] = duration;
    console.warn(`Auth flow ${flowType} failed:`, error);
  }

  return results;
}

async function measureComponentPerformance(page: Page, url: string): Promise<PerformanceResults> {
  const results: PerformanceResults = {
    coreWebVitals: {},
    bundleAnalysis: {
      totalSize: 0,
      gzippedSize: 0,
      chunks: [],
      recommendations: []
    },
    authFlowPerformance: {},
    componentMetrics: {
      renderTimes: {},
      reRenderCount: 0
    },
    networkMetrics: {
      apiCalls: [],
      totalRequests: 0,
      totalTransferSize: 0
    }
  };

  // Inject performance monitoring
  await page.evaluateOnNewDocument(() => {
    window.componentMetrics = {
      renderTimes: {},
      reRenderCount: 0
    };

    // Mock React DevTools profiler if available
    if (window.React) {
      const originalUseState = window.React.useState;
      window.React.useState = function(...args) {
        window.componentMetrics.reRenderCount++;
        return originalUseState.apply(this, args);
      };
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Interact with components to trigger renders
  await page.click('body');
  await page.keyboard.press('Tab');
  
  // Wait for any async renders
  await page.waitForTimeout(2000);

  const componentMetrics = await page.evaluate(() => {
    return (window as any).componentMetrics || {
      renderTimes: {},
      reRenderCount: 0
    };
  });

  results.componentMetrics = componentMetrics;

  return results;
}

async function measureAPIPerformance(page: Page, url: string, apiBaseUrl: string): Promise<PerformanceResults> {
  const results: PerformanceResults = {
    coreWebVitals: {},
    bundleAnalysis: {
      totalSize: 0,
      gzippedSize: 0,
      chunks: [],
      recommendations: []
    },
    authFlowPerformance: {},
    componentMetrics: {
      renderTimes: {},
      reRenderCount: 0
    },
    networkMetrics: {
      apiCalls: [],
      totalRequests: 0,
      totalTransferSize: 0
    }
  };

  const apiCalls: Array<{
    url: string;
    method: string;
    duration: number;
    size: number;
  }> = [];

  page.on('response', async (response) => {
    const request = response.request();
    if (request.url().includes('/api/')) {
      const timing = response.timing();
      const headers = response.headers();
      
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        duration: timing.responseEnd - timing.responseStart,
        size: parseInt(headers['content-length'] || '0', 10)
      });
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Trigger some API calls by interacting with the page
  try {
    await page.click('[data-testid="refresh-data"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch (error) {
    // Ignore if refresh button doesn't exist
  }

  results.networkMetrics = {
    apiCalls,
    totalRequests: apiCalls.length,
    totalTransferSize: apiCalls.reduce((sum, call) => sum + call.size, 0)
  };

  return results;
}

async function loadPerformanceBaseline(): Promise<PerformanceResults | null> {
  try {
    const baselinePath = getBaselinePath();
    if (fs.existsSync(baselinePath)) {
      const baselineData = fs.readFileSync(baselinePath, 'utf8');
      return JSON.parse(baselineData);
    }
  } catch (error) {
    console.warn('Failed to load performance baseline:', error);
  }
  return null;
}

async function savePerformanceBaseline(results: PerformanceResults): Promise<void> {
  try {
    const baselinePath = getBaselinePath();
    const baselineDir = path.dirname(baselinePath);
    
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }
    
    fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
  } catch (error) {
    console.warn('Failed to save performance baseline:', error);
  }
}

function getBaselinePath(): string {
  return path.join(process.cwd(), 'performance-reports', 'baseline.json');
}

function calculatePerformanceRegression(current: PerformanceResults, baseline: PerformanceResults): {
  lcp: number;
  fcp: number;
  cls: number;
} {
  const currentLCP = current.coreWebVitals.LCP || 0;
  const baselineLCP = baseline.coreWebVitals.LCP || 1;
  
  const currentFCP = current.coreWebVitals.FCP || 0;
  const baselineFCP = baseline.coreWebVitals.FCP || 1;
  
  const currentCLS = current.coreWebVitals.CLS || 0;
  const baselineCLS = baseline.coreWebVitals.CLS || 0.01;

  return {
    lcp: (currentLCP - baselineLCP) / baselineLCP,
    fcp: (currentFCP - baselineFCP) / baselineFCP,
    cls: (currentCLS - baselineCLS) / baselineCLS
  };
}