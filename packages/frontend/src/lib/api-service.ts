/**
 * Centralized API Service
 * =====================
 *
 * Eliminates duplicate API call patterns across 15+ components
 * Provides consistent error handling, token management, and request/response transformation
 */

// ==================== TYPES ====================

export interface APIResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

export interface DashboardStats {
  data_sources: number;
  total_records: number;
  quality_score: number;
  active_jobs: number;
  completed_jobs?: number;
  failed_jobs?: number;
  storage_used_mb?: number;
  processing_time_saved_hours?: number;
}

export interface Investigation {
  id: string;
  name: string;
  description?: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress_percentage: number;
  quality_score?: number;
  total_records?: number;
  file_size_bytes?: number;
  created_at: string;
  updated_at: string;
  data_source_config?: {
    filename?: string;
    file_type?: string;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
  user_email?: string;
}

export interface DataQualityMetrics {
  overall_score: number;
  investigations_count: number;
  issues_count: number;
  excellent_count: number;
  good_count: number;
  fair_count: number;
  poor_count: number;
  trend_direction: string;
}

// ==================== ERROR HANDLING ====================

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class TokenManager {
  private static readonly TOKEN_KEY = "token";

  static getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TokenManager.TOKEN_KEY);
  }

  static setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TokenManager.TOKEN_KEY, token);
  }

  static clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TokenManager.TOKEN_KEY);
  }

  static isAuthenticated(): boolean {
    return !!TokenManager.getToken();
  }
}

// ==================== API SERVICE ====================

export class APIService {
  private static instance: APIService;
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;

  private constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    this.timeout = 30000;
    this.retryAttempts = 3;
  }

  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<APIResponse<T>> {
    const {
      method = "GET",
      body,
      headers: customHeaders = {},
      timeout = this.timeout,
      retries = this.retryAttempts,
      cache = false,
    } = options;

    const url = `/api/proxy${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...customHeaders,
    };

    // Add authentication token if available
    const token = TokenManager.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Prepare request body
    let requestBody: string | FormData | undefined;
    if (body) {
      if (body instanceof FormData) {
        requestBody = body;
        delete headers["Content-Type"]; // Let browser set it for FormData
      } else {
        requestBody = JSON.stringify(body);
      }
    }

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
          cache: cache ? "default" : "no-cache",
        });

        clearTimeout(timeoutId);

        // Handle authentication errors
        if (response.status === 401) {
          TokenManager.clearTokens();
          if (typeof window !== "undefined") {
            window.location.href = "/auth/signin";
          }
          throw new APIError("Authentication required", 401, endpoint);
        }

        // Parse response
        const contentType = response.headers.get("content-type");
        let responseData: any;

        if (contentType?.includes("application/json")) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (!response.ok) {
          throw new APIError(
            responseData.detail ||
              responseData.message ||
              `HTTP ${response.status}`,
            response.status,
            endpoint,
          );
        }

        return {
          data: responseData,
          success: true,
          message: responseData.message,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except 401
        if (
          error instanceof APIError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 401
        ) {
          break;
        }

        // Don't retry on final attempt
        if (attempt === retries) {
          break;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
      }
    }

    throw (
      lastError || new APIError("Request failed after retries", 0, endpoint)
    );
  }

  // ==================== DASHBOARD API ====================

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.makeRequest<DashboardStats>(
      "/dashboard/stats",
      {
        cache: true,
      },
    );
    return response.data;
  }

  async getRecentActivity(limit: number = 20): Promise<ActivityItem[]> {
    const response = await this.makeRequest<ActivityItem[]>(
      `/dashboard/activity?limit=${limit}`,
    );
    return response.data;
  }

  async getActiveJobs(): Promise<any[]> {
    const response = await this.makeRequest<any[]>("/dashboard/active-jobs");
    return response.data;
  }

  async getDataQualityMetrics(): Promise<DataQualityMetrics> {
    const response = await this.makeRequest<DataQualityMetrics>(
      "/dashboard/data-quality",
    );
    return response.data;
  }

  // ==================== INVESTIGATION API ====================

  async getInvestigations(): Promise<Investigation[]> {
    const response = await this.makeRequest<Investigation[]>(
      "/data/investigations",
    );
    return response.data;
  }

  async getInvestigation(id: string): Promise<Investigation> {
    const response = await this.makeRequest<Investigation>(
      `/data/investigations/${id}`,
    );
    return response.data;
  }

  async getInvestigationInsights(id: string): Promise<any> {
    const response = await this.makeRequest<any>(`/data/quick-insights/${id}`);
    return response.data;
  }

  // ==================== UPLOAD API ====================

  async uploadFile(
    file: File,
    name?: string,
    description?: string,
  ): Promise<{ investigation_id: string }> {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    if (description) formData.append("description", description);

    const response = await this.makeRequest<{ investigation_id: string }>(
      "/data/upload",
      {
        method: "POST",
        body: formData,
      },
    );

    return response.data;
  }

  // ==================== SYSTEM API ====================

  async getSystemStatus(): Promise<any> {
    const response = await this.makeRequest<any>("/admin/system-status");
    return response.data;
  }

  async getHealthCheck(): Promise<any> {
    const response = await this.makeRequest<any>("/health");
    return response.data;
  }
}

// ==================== EXPORT ====================

export const apiService = APIService.getInstance();
export default apiService;

// ==================== ERROR HANDLERS ====================

export function handleAPIError(error: unknown, context: string = "API"): void {
  console.error(`[${context}] API Error:`, error);

  if (error instanceof APIError) {
    // Handle specific API errors
    switch (error.status) {
      case 401:
        // Already handled in makeRequest
        break;
      case 403:
        console.warn("Access forbidden:", error.message);
        break;
      case 404:
        console.warn("Resource not found:", error.endpoint);
        break;
      case 500:
        console.error("Server error:", error.message);
        break;
      default:
        console.error("Unknown API error:", error.message);
    }
  } else {
    console.error("Non-API error:", error);
  }
}
