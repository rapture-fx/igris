/**
 * Test setup for Igris-engine JavaScript SDK
 */

import 'jest';

// Setup global test environment
global.fetch = require('cross-fetch');

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string, public protocols?: string[]) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', { data }));
    }, 10);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code, reason }));
    }, 10);
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

// Mock File and Blob for Node.js testing
if (typeof File === 'undefined') {
  // @ts-ignore
  global.File = class MockFile {
    public name: string;
    public size: number;
    public type: string;
    public lastModified: number;

    constructor(
      public data: string[] | ArrayBuffer[] | Blob[],
      name: string,
      options: { type?: string; lastModified?: number } = {}
    ) {
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
      this.size = data.reduce((total, chunk) => {
        if (typeof chunk === 'string') return total + chunk.length;
        if (chunk instanceof ArrayBuffer) return total + chunk.byteLength;
        return total + (chunk as any).size || 0;
      }, 0);
    }
  };
}

if (typeof Blob === 'undefined') {
  // @ts-ignore
  global.Blob = class MockBlob {
    public size: number;
    public type: string;

    constructor(
      public data: string[] | ArrayBuffer[] = [],
      options: { type?: string } = {}
    ) {
      this.type = options.type || '';
      this.size = data.reduce((total, chunk) => {
        if (typeof chunk === 'string') return total + chunk.length;
        if (chunk instanceof ArrayBuffer) return total + chunk.byteLength;
        return total;
      }, 0);
    }
  };
}

// Mock FormData
if (typeof FormData === 'undefined') {
  // @ts-ignore
  global.FormData = class MockFormData {
    private data = new Map<string, string | File>();

    append(name: string, value: string | File): void {
      this.data.set(name, value);
    }

    get(name: string): string | File | null {
      return this.data.get(name) || null;
    }

    entries(): IterableIterator<[string, string | File]> {
      return this.data.entries();
    }
  };
}

// Mock localStorage for browser token storage testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

// @ts-ignore
global.localStorage = localStorageMock;

// Mock navigator for user agent detection
if (typeof navigator === 'undefined') {
  // @ts-ignore
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Node.js Test Environment)'
  };
}

// Mock window for browser detection
if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = undefined;
}

// Test utilities
export const createMockFile = (name: string, content: string, type = 'text/plain') => {
  return new File([content], name, { type });
};

export const createMockBlob = (content: string, type = 'text/plain') => {
  return new Blob([content], { type });
};

export const mockResponse = <T>(data: T, success = true) => ({
  success,
  data,
  message: success ? 'Success' : 'Error',
  timestamp: new Date().toISOString()
});

export const mockApiError = (message: string, statusCode = 400) => ({
  success: false,
  message,
  error_code: 'TEST_ERROR',
  timestamp: new Date().toISOString()
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});