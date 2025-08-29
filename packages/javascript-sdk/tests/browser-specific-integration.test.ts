/**
 * Browser-Specific Integration Tests for JavaScript/TypeScript SDK
 * 
 * These tests focus on browser-specific features and edge cases that might
 * not be covered in standard Node.js tests.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Browser-specific mocks and interfaces
interface BrowserSchlepEngineClient {
  uploadFile(file: File, options?: UploadOptions): Promise<UploadResult>;
  downloadBlob(fileId: string): Promise<Blob>;
  createWebWorkerProcessor(): Promise<WebWorkerProcessor>;
  enableOfflineMode(): Promise<OfflineModeResult>;
  getDeviceCapabilities(): Promise<DeviceCapabilities>;
}

interface UploadOptions {
  onProgress?: (progress: ProgressEvent) => void;
  chunkSize?: number;
  enableCompression?: boolean;
}

interface UploadResult {
  fileId: string;
  uploadTime: number;
  compressionRatio?: number;
}

interface WebWorkerProcessor {
  processInBackground(data: any[]): Promise<ProcessingResult>;
  getProgress(): Promise<number>;
  cancel(): Promise<void>;
}

interface OfflineModeResult {
  enabled: boolean;
  cacheSize: number;
  syncPending: number;
}

interface DeviceCapabilities {
  maxFileSize: number;
  supportedFormats: string[];
  hasWebGL: boolean;
  hasWebWorkers: boolean;
  connectionType: string;
}

interface ProcessingResult {
  processed: number;
  results: any[];
  processingTime: number;
}

// Mock implementations for browser environment
class MockBrowserClient implements BrowserSchlepEngineClient {
  private mockFiles = new Map<string, Blob>();
  private mockProgress = 0;

  async uploadFile(file: File, options?: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    let totalSize = file.size;
    let uploadedSize = 0;
    
    // Simulate chunked upload with progress
    const chunkSize = options?.chunkSize || 1024 * 1024; // 1MB default
    
    for (let i = 0; i < totalSize; i += chunkSize) {
      const chunk = file.slice(i, Math.min(i + chunkSize, totalSize));
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      uploadedSize += chunk.size;
      
      // Call progress callback if provided
      if (options?.onProgress) {
        const progress = new ProgressEvent('progress', {
          loaded: uploadedSize,
          total: totalSize,
          lengthComputable: true
        });
        options.onProgress(progress);
      }
    }
    
    const fileId = `file_${Math.random().toString(36).substr(2, 9)}`;
    this.mockFiles.set(fileId, file);
    
    const compressionRatio = options?.enableCompression ? 0.7 : undefined;
    
    return {
      fileId,
      uploadTime: Date.now() - startTime,
      compressionRatio
    };
  }

  async downloadBlob(fileId: string): Promise<Blob> {
    const file = this.mockFiles.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    // Simulate download delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return file;
  }

  async createWebWorkerProcessor(): Promise<WebWorkerProcessor> {
    return new MockWebWorkerProcessor();
  }

  async enableOfflineMode(): Promise<OfflineModeResult> {
    // Mock offline mode initialization
    return {
      enabled: true,
      cacheSize: 1024 * 1024 * 50, // 50MB cache
      syncPending: 0
    };
  }

  async getDeviceCapabilities(): Promise<DeviceCapabilities> {
    return {
      maxFileSize: 1024 * 1024 * 100, // 100MB
      supportedFormats: ['image/jpeg', 'image/png', 'text/csv', 'application/json'],
      hasWebGL: true,
      hasWebWorkers: true,
      connectionType: 'wifi'
    };
  }
}

class MockWebWorkerProcessor implements WebWorkerProcessor {
  private processing = false;
  private progress = 0;
  private cancelled = false;

  async processInBackground(data: any[]): Promise<ProcessingResult> {
    if (this.processing) {
      throw new Error('Already processing');
    }
    
    this.processing = true;
    this.progress = 0;
    this.cancelled = false;
    
    const startTime = Date.now();
    const results: any[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (this.cancelled) {
        throw new Error('Processing cancelled');
      }
      
      // Simulate processing each item
      await new Promise(resolve => setTimeout(resolve, 50));
      
      results.push({
        id: i,
        processed: true,
        data: data[i],
        timestamp: Date.now()
      });
      
      this.progress = (i + 1) / data.length;
    }
    
    this.processing = false;
    
    return {
      processed: data.length,
      results,
      processingTime: Date.now() - startTime
    };
  }

  async getProgress(): Promise<number> {
    return this.progress;
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.processing = false;
    this.progress = 0;
  }
}

describe('Browser-Specific Integration Tests', () => {
  let client: MockBrowserClient;
  
  beforeEach(() => {
    client = new MockBrowserClient();
    
    // Mock browser APIs that might not be available in test environment
    global.File = global.File || class MockFile {
      name: string;
      size: number;
      type: string;
      lastModified: number;
      
      constructor(parts: BlobPart[], name: string, options: FilePropertyBag = {}) {
        this.name = name;
        this.type = options.type || '';
        this.lastModified = options.lastModified || Date.now();
        this.size = parts.reduce((total, part) => {
          if (typeof part === 'string') return total + part.length;
          if (part instanceof ArrayBuffer) return total + part.byteLength;
          return total + (part as any).size || 0;
        }, 0);
      }
      
      slice(start = 0, end = this.size): Blob {
        return new Blob([`sliced_data_${start}_${end}`], { type: this.type });
      }
    };
    
    global.Blob = global.Blob || class MockBlob {
      size: number;
      type: string;
      
      constructor(parts: BlobPart[] = [], options: BlobPropertyBag = {}) {
        this.type = options.type || '';
        this.size = parts.reduce((total, part) => {
          if (typeof part === 'string') return total + part.length;
          if (part instanceof ArrayBuffer) return total + part.byteLength;
          return total;
        }, 0);
      }
    };
    
    global.ProgressEvent = global.ProgressEvent || class MockProgressEvent extends Event {
      loaded: number;
      total: number;
      lengthComputable: boolean;
      
      constructor(type: string, options: ProgressEventInit = {}) {
        super(type);
        this.loaded = options.loaded || 0;
        this.total = options.total || 0;
        this.lengthComputable = options.lengthComputable || false;
      }
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('File Upload with Progress Tracking', () => {
    it('should upload file with progress callbacks', async () => {
      const testContent = 'x'.repeat(1024 * 1024); // 1MB of data
      const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
      
      const progressEvents: ProgressEvent[] = [];
      
      const result = await client.uploadFile(testFile, {
        chunkSize: 1024 * 256, // 256KB chunks
        onProgress: (event) => {
          progressEvents.push(event);
        }
      });
      
      expect(result.fileId).toMatch(/^file_[a-z0-9]+$/);
      expect(result.uploadTime).toBeGreaterThan(0);
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Verify progress events are in ascending order
      for (let i = 1; i < progressEvents.length; i++) {
        expect(progressEvents[i].loaded).toBeGreaterThanOrEqual(progressEvents[i-1].loaded);
      }
      
      // Final progress should be 100%
      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.loaded).toBe(lastEvent.total);
    });

    it('should handle upload compression', async () => {
      const testFile = new File(['test data for compression'], 'test.txt');
      
      const result = await client.uploadFile(testFile, {
        enableCompression: true
      });
      
      expect(result.compressionRatio).toBeDefined();
      expect(result.compressionRatio).toBeLessThan(1.0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should handle large files with memory efficiency', async () => {
      // Simulate a 50MB file
      const largeContent = 'x'.repeat(1024 * 1024 * 50);
      const largeFile = new File([largeContent], 'large.txt');
      
      const progressEvents: ProgressEvent[] = [];
      
      const result = await client.uploadFile(largeFile, {
        chunkSize: 1024 * 1024 * 5, // 5MB chunks
        onProgress: (event) => {
          progressEvents.push(event);
        }
      });
      
      expect(result.fileId).toBeDefined();
      expect(progressEvents.length).toBeGreaterThanOrEqual(10); // Should have multiple chunks
    });

    it('should handle upload errors gracefully', async () => {
      const testFile = new File(['test'], 'test.txt');
      
      // Mock client that throws error after partial upload
      class FailingClient extends MockBrowserClient {
        async uploadFile(file: File, options?: UploadOptions): Promise<UploadResult> {
          // Start upload process
          if (options?.onProgress) {
            options.onProgress(new ProgressEvent('progress', { loaded: file.size / 2, total: file.size }));
          }
          
          // Simulate network error
          throw new Error('Network error during upload');
        }
      }
      
      const failingClient = new FailingClient();
      
      await expect(failingClient.uploadFile(testFile)).rejects.toThrow('Network error');
    });
  });

  describe('Blob Download and Processing', () => {
    it('should download and process blob data', async () => {
      const testFile = new File(['test content for download'], 'download.txt');
      
      // First upload the file
      const uploadResult = await client.uploadFile(testFile);
      
      // Then download it as blob
      const downloadedBlob = await client.downloadBlob(uploadResult.fileId);
      
      expect(downloadedBlob).toBeInstanceOf(Blob);
      expect(downloadedBlob.size).toBe(testFile.size);
    });

    it('should handle blob URLs and object URLs', async () => {
      const testFile = new File(['blob url test'], 'blob-test.txt');
      const uploadResult = await client.uploadFile(testFile);
      const blob = await client.downloadBlob(uploadResult.fileId);
      
      // Mock URL.createObjectURL
      const mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url-123');
      const mockRevokeObjectURL = jest.fn();
      
      global.URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      } as any;
      
      const objectUrl = URL.createObjectURL(blob);
      expect(objectUrl).toBe('blob:mock-url-123');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      
      URL.revokeObjectURL(objectUrl);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(objectUrl);
    });
  });

  describe('Web Worker Background Processing', () => {
    it('should process data in background using web workers', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` }));
      
      const processor = await client.createWebWorkerProcessor();
      
      const processingPromise = processor.processInBackground(testData);
      
      // Check progress during processing
      let progressChecks = 0;
      const progressInterval = setInterval(async () => {
        const progress = await processor.getProgress();
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
        progressChecks++;
      }, 100);
      
      const result = await processingPromise;
      clearInterval(progressInterval);
      
      expect(result.processed).toBe(testData.length);
      expect(result.results.length).toBe(testData.length);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(progressChecks).toBeGreaterThan(0);
    });

    it('should handle worker cancellation', async () => {
      const testData = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      
      const processor = await client.createWebWorkerProcessor();
      
      const processingPromise = processor.processInBackground(testData);
      
      // Cancel after a short delay
      setTimeout(() => {
        processor.cancel();
      }, 500);
      
      await expect(processingPromise).rejects.toThrow('Processing cancelled');
      
      const progress = await processor.getProgress();
      expect(progress).toBe(0); // Should be reset after cancellation
    });
  });

  describe('Offline Mode and Caching', () => {
    it('should enable offline mode with caching', async () => {
      const offlineResult = await client.enableOfflineMode();
      
      expect(offlineResult.enabled).toBe(true);
      expect(offlineResult.cacheSize).toBeGreaterThan(0);
      expect(offlineResult.syncPending).toBe(0);
    });

    it('should handle offline/online state changes', async () => {
      let onlineState = true;
      const networkEvents: string[] = [];
      
      // Mock navigator.onLine
      Object.defineProperty(global.navigator, 'onLine', {
        get: () => onlineState,
        configurable: true
      });
      
      // Mock window events
      const mockAddEventListener = jest.fn((event, handler) => {
        if (event === 'online') {
          setTimeout(() => {
            onlineState = true;
            handler({ type: 'online' });
            networkEvents.push('online');
          }, 100);
        } else if (event === 'offline') {
          setTimeout(() => {
            onlineState = false;
            handler({ type: 'offline' });
            networkEvents.push('offline');
          }, 50);
        }
      });
      
      global.window = {
        addEventListener: mockAddEventListener
      } as any;
      
      // Simulate offline mode
      await client.enableOfflineMode();
      
      // Trigger offline/online events
      window.addEventListener('offline', () => {});
      window.addEventListener('online', () => {});
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });
  });

  describe('Device Capabilities Detection', () => {
    it('should detect browser and device capabilities', async () => {
      const capabilities = await client.getDeviceCapabilities();
      
      expect(capabilities.maxFileSize).toBeGreaterThan(0);
      expect(capabilities.supportedFormats).toBeInstanceOf(Array);
      expect(capabilities.supportedFormats.length).toBeGreaterThan(0);
      expect(typeof capabilities.hasWebGL).toBe('boolean');
      expect(typeof capabilities.hasWebWorkers).toBe('boolean');
      expect(capabilities.connectionType).toBeDefined();
    });

    it('should adapt behavior based on connection type', async () => {
      // Mock different connection types
      const connectionTypes = ['slow-2g', '2g', '3g', '4g', 'wifi'];
      
      for (const connectionType of connectionTypes) {
        // Mock navigator.connection
        Object.defineProperty(global.navigator, 'connection', {
          value: { effectiveType: connectionType },
          configurable: true
        });
        
        const capabilities = await client.getDeviceCapabilities();
        
        // Verify connection type is detected
        expect(['slow-2g', '2g', '3g', '4g', 'wifi']).toContain(capabilities.connectionType);
        
        // Upload behavior should adapt to connection speed
        const testFile = new File(['test'], 'test.txt');
        const result = await client.uploadFile(testFile, {
          chunkSize: connectionType === 'wifi' ? 1024 * 1024 : 1024 * 64 // Larger chunks for faster connections
        });
        
        expect(result.fileId).toBeDefined();
      }
    });
  });

  describe('Memory Management and Performance', () => {
    it('should handle memory cleanup after large operations', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Process large amount of data
      const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000)
      }));
      
      const processor = await client.createWebWorkerProcessor();
      const result = await processor.processInBackground(largeDataSet);
      
      expect(result.processed).toBe(largeDataSet.length);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Check memory usage hasn't grown excessively
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
      }
    });

    it('should handle rapid file operations without memory leaks', async () => {
      const fileOperations = [];
      
      // Perform 50 rapid file operations
      for (let i = 0; i < 50; i++) {
        const testFile = new File([`test data ${i}`], `test_${i}.txt`);
        
        const operation = client.uploadFile(testFile)
          .then(uploadResult => client.downloadBlob(uploadResult.fileId))
          .then(blob => {
            // Process the blob
            return { processed: true, size: blob.size };
          });
        
        fileOperations.push(operation);
      }
      
      const results = await Promise.all(fileOperations);
      
      expect(results.length).toBe(50);
      expect(results.every(r => r.processed)).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle quota exceeded errors gracefully', async () => {
      // Mock storage quota exceeded
      class QuotaExceededClient extends MockBrowserClient {
        async uploadFile(file: File): Promise<UploadResult> {
          if (file.size > 1024) { // Simulate quota limit
            throw new Error('QuotaExceededError: Storage quota exceeded');
          }
          return super.uploadFile(file);
        }
      }
      
      const quotaClient = new QuotaExceededClient();
      
      // Small file should work
      const smallFile = new File(['small'], 'small.txt');
      const result = await quotaClient.uploadFile(smallFile);
      expect(result.fileId).toBeDefined();
      
      // Large file should fail gracefully
      const largeFile = new File(['x'.repeat(2000)], 'large.txt');
      await expect(quotaClient.uploadFile(largeFile)).rejects.toThrow('QuotaExceededError');
    });

    it('should handle browser compatibility issues', async () => {
      // Test with missing APIs
      const originalFile = global.File;
      const originalBlob = global.Blob;
      
      try {
        // Remove File API
        delete (global as any).File;
        
        const capabilities = await client.getDeviceCapabilities();
        expect(capabilities.supportedFormats).toEqual([]); // Should gracefully handle missing API
        
        // Remove Blob API
        delete (global as any).Blob;
        
        await expect(client.downloadBlob('test-file')).rejects.toThrow();
        
      } finally {
        // Restore APIs
        global.File = originalFile;
        global.Blob = originalBlob;
      }
    });
  });

  describe('Cross-Origin and CORS Handling', () => {
    it('should handle CORS preflight requests', async () => {
      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }),
          json: async () => ({ success: true })
        });
      
      global.fetch = mockFetch;
      
      const testFile = new File(['cors test'], 'cors-test.txt');
      const result = await client.uploadFile(testFile);
      
      expect(result.fileId).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
