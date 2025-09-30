/**
 * Analytics API for Schlep-engine JavaScript SDK
 * Provides comprehensive analytics query and reporting capabilities
 */

import { BaseAPI } from './base';
import { APIResponse } from '../types/common';
import {
  AnalyticsQuery,
  AnalyticsResult,
  Dataset,
  Dashboard,
  Report,
  InsightConfig,
  Insight,
  FunnelConfig,
  FunnelResult,
  CohortConfig,
  CohortResult,
  DashboardWidget,
  ReportSchedule
} from '../types/analytics';

/**
 * Analytics API client
 *
 * Provides methods for running analytics queries, creating dashboards,
 * generating reports, and detecting insights from your data.
 *
 * @example
 * ```typescript
 * // Run an analytics query
 * const result = await client.analytics.query({
 *   dataset: 'sales',
 *   metrics: [
 *     { field: 'revenue', aggregation: AggregationType.SUM }
 *   ],
 *   dimensions: [
 *     { field: 'date', time_granularity: TimeGranularity.DAY }
 *   ],
 *   date_range: {
 *     start_date: '2025-01-01',
 *     end_date: '2025-01-31'
 *   }
 * });
 *
 * // Get available datasets
 * const datasets = await client.analytics.getDatasets();
 *
 * // Create a dashboard
 * const dashboard = await client.analytics.createDashboard({
 *   name: 'Sales Dashboard',
 *   widgets: [...]
 * });
 * ```
 */
export class AnalyticsAPI extends BaseAPI {
  protected basePath = '/analytics';

  /**
   * Execute an analytics query
   *
   * Runs a comprehensive analytics query with support for aggregations,
   * grouping, filtering, and time-series analysis.
   *
   * @param query - Analytics query configuration
   * @returns Query results with rows and metadata
   *
   * @example
   * ```typescript
   * const result = await client.analytics.query({
   *   dataset: 'sales',
   *   metrics: [
   *     { field: 'revenue', aggregation: AggregationType.SUM, alias: 'total_revenue' },
   *     { field: 'orders', aggregation: AggregationType.COUNT }
   *   ],
   *   dimensions: [
   *     { field: 'category' },
   *     { field: 'date', time_granularity: TimeGranularity.MONTH }
   *   ],
   *   filters: [
   *     { field: 'status', operator: FilterOperator.EQUALS, value: 'completed' }
   *   ],
   *   sort: [
   *     { field: 'total_revenue', direction: 'desc' }
   *   ],
   *   limit: 100
   * });
   * ```
   */
  async query(query: AnalyticsQuery): Promise<APIResponse<AnalyticsResult>> {
    return this.post<AnalyticsResult>('/query', {
      params: query as any
    });
  }

  /**
   * Get list of available datasets
   *
   * Retrieves all datasets available for analytics queries,
   * including their schemas and metadata.
   *
   * @returns List of available datasets
   *
   * @example
   * ```typescript
   * const datasets = await client.analytics.getDatasets();
   * datasets.data.forEach(dataset => {
   *   console.log(`${dataset.name}: ${dataset.row_count} rows`);
   * });
   * ```
   */
  async getDatasets(): Promise<APIResponse<Dataset[]>> {
    return this.get<Dataset[]>('/datasets');
  }

  /**
   * Get dataset schema
   *
   * Retrieves detailed schema information for a specific dataset,
   * including field types, indexes, and constraints.
   *
   * @param dataset - Dataset name or ID
   * @returns Dataset schema information
   *
   * @example
   * ```typescript
   * const schema = await client.analytics.getSchema('sales');
   * schema.data.fields.forEach(field => {
   *   console.log(`${field.name}: ${field.type}`);
   * });
   * ```
   */
  async getSchema(dataset: string): Promise<APIResponse<Dataset>> {
    return this.get<Dataset>(`/datasets/${dataset}/schema`);
  }

  /**
   * Create a new dataset
   *
   * @param dataset - Dataset configuration
   * @returns Created dataset information
   */
  async createDataset(dataset: Partial<Dataset>): Promise<APIResponse<Dataset>> {
    return this.post<Dataset>('/datasets', {
      params: dataset as any
    });
  }

  /**
   * Update an existing dataset
   *
   * @param datasetId - Dataset ID
   * @param updates - Dataset updates
   * @returns Updated dataset information
   */
  async updateDataset(
    datasetId: string,
    updates: Partial<Dataset>
  ): Promise<APIResponse<Dataset>> {
    return this.patch<Dataset>(`/datasets/${datasetId}`, {
      params: updates as any
    });
  }

  /**
   * Delete a dataset
   *
   * @param datasetId - Dataset ID
   * @returns Deletion confirmation
   */
  async deleteDataset(datasetId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/datasets/${datasetId}`);
  }

  /**
   * Create a dashboard
   *
   * Creates a new analytics dashboard with widgets and visualizations.
   *
   * @param dashboard - Dashboard configuration
   * @returns Created dashboard
   *
   * @example
   * ```typescript
   * const dashboard = await client.analytics.createDashboard({
   *   name: 'Sales Dashboard',
   *   description: 'Real-time sales analytics',
   *   widgets: [
   *     {
   *       id: 'revenue-widget',
   *       type: WidgetType.LINE_CHART,
   *       title: 'Revenue Trend',
   *       query: {
   *         dataset: 'sales',
   *         metrics: [{ field: 'revenue', aggregation: AggregationType.SUM }],
   *         dimensions: [{ field: 'date', time_granularity: TimeGranularity.DAY }]
   *       },
   *       visualization: {
   *         chart_type: WidgetType.LINE_CHART,
   *         colors: ['#3b82f6']
   *       },
   *       position: { x: 0, y: 0 },
   *       size: { width: 12, height: 6 }
   *     }
   *   ],
   *   refresh_interval: 60000 // 1 minute
   * });
   * ```
   */
  async createDashboard(
    dashboard: Partial<Dashboard>
  ): Promise<APIResponse<Dashboard>> {
    return this.post<Dashboard>('/dashboards', {
      params: dashboard as any
    });
  }

  /**
   * Get dashboard by ID
   *
   * @param dashboardId - Dashboard ID
   * @returns Dashboard configuration
   */
  async getDashboard(dashboardId: string): Promise<APIResponse<Dashboard>> {
    return this.get<Dashboard>(`/dashboards/${dashboardId}`);
  }

  /**
   * List all dashboards
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of dashboards
   */
  async listDashboards(
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<Dashboard[]>> {
    return this.paginatedRequest<Dashboard>(
      '/dashboards',
      this.buildQueryParams({ page, page_size: pageSize })
    );
  }

  /**
   * Update a dashboard
   *
   * @param dashboardId - Dashboard ID
   * @param updates - Dashboard updates
   * @returns Updated dashboard
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<Dashboard>
  ): Promise<APIResponse<Dashboard>> {
    return this.patch<Dashboard>(`/dashboards/${dashboardId}`, {
      params: updates as any
    });
  }

  /**
   * Delete a dashboard
   *
   * @param dashboardId - Dashboard ID
   * @returns Deletion confirmation
   */
  async deleteDashboard(dashboardId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/dashboards/${dashboardId}`);
  }

  /**
   * Add widget to dashboard
   *
   * @param dashboardId - Dashboard ID
   * @param widget - Widget configuration
   * @returns Updated dashboard
   */
  async addWidget(
    dashboardId: string,
    widget: DashboardWidget
  ): Promise<APIResponse<Dashboard>> {
    return this.post<Dashboard>(`/dashboards/${dashboardId}/widgets`, {
      params: widget as any
    });
  }

  /**
   * Remove widget from dashboard
   *
   * @param dashboardId - Dashboard ID
   * @param widgetId - Widget ID
   * @returns Updated dashboard
   */
  async removeWidget(
    dashboardId: string,
    widgetId: string
  ): Promise<APIResponse<Dashboard>> {
    return this.delete<Dashboard>(
      `/dashboards/${dashboardId}/widgets/${widgetId}`
    );
  }

  /**
   * Create a report
   *
   * Creates a scheduled or on-demand analytics report.
   *
   * @param report - Report configuration
   * @returns Created report
   *
   * @example
   * ```typescript
   * const report = await client.analytics.createReport({
   *   name: 'Monthly Sales Report',
   *   description: 'Comprehensive monthly sales analysis',
   *   queries: [
   *     {
   *       dataset: 'sales',
   *       metrics: [
   *         { field: 'revenue', aggregation: AggregationType.SUM },
   *         { field: 'orders', aggregation: AggregationType.COUNT }
   *       ]
   *     }
   *   ],
   *   schedule: {
   *     frequency: 'monthly',
   *     day_of_month: 1,
   *     time: '09:00',
   *     timezone: 'America/New_York'
   *   },
   *   recipients: ['team@example.com'],
   *   format: ReportFormat.PDF
   * });
   * ```
   */
  async createReport(report: Partial<Report>): Promise<APIResponse<Report>> {
    return this.post<Report>('/reports', {
      params: report as any
    });
  }

  /**
   * Get report by ID
   *
   * @param reportId - Report ID
   * @returns Report configuration
   */
  async getReport(reportId: string): Promise<APIResponse<Report>> {
    return this.get<Report>(`/reports/${reportId}`);
  }

  /**
   * List all reports
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of reports
   */
  async listReports(
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<Report[]>> {
    return this.paginatedRequest<Report>(
      '/reports',
      this.buildQueryParams({ page, page_size: pageSize })
    );
  }

  /**
   * Update a report
   *
   * @param reportId - Report ID
   * @param updates - Report updates
   * @returns Updated report
   */
  async updateReport(
    reportId: string,
    updates: Partial<Report>
  ): Promise<APIResponse<Report>> {
    return this.patch<Report>(`/reports/${reportId}`, {
      params: updates as any
    });
  }

  /**
   * Delete a report
   *
   * @param reportId - Report ID
   * @returns Deletion confirmation
   */
  async deleteReport(reportId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/reports/${reportId}`);
  }

  /**
   * Generate report on-demand
   *
   * @param reportId - Report ID
   * @returns Report generation result
   */
  async generateReport(
    reportId: string
  ): Promise<APIResponse<{ download_url: string; expires_at: string }>> {
    return this.post<{ download_url: string; expires_at: string }>(
      `/reports/${reportId}/generate`
    );
  }

  /**
   * Detect insights from data
   *
   * Uses machine learning to automatically detect anomalies, trends,
   * and patterns in your data.
   *
   * @param config - Insight detection configuration
   * @returns Detected insights
   *
   * @example
   * ```typescript
   * const insights = await client.analytics.detectInsights({
   *   dataset: 'sales',
   *   metrics: ['revenue', 'orders'],
   *   date_range: {
   *     start_date: '2025-01-01',
   *     end_date: '2025-09-30'
   *   },
   *   sensitivity: 'medium',
   *   types: [InsightType.ANOMALY, InsightType.TREND]
   * });
   *
   * insights.data.forEach(insight => {
   *   console.log(`${insight.type}: ${insight.description}`);
   * });
   * ```
   */
  async detectInsights(
    config: InsightConfig
  ): Promise<APIResponse<Insight[]>> {
    return this.post<Insight[]>('/insights/detect', {
      params: config as any
    });
  }

  /**
   * Get insight by ID
   *
   * @param insightId - Insight ID
   * @returns Insight details
   */
  async getInsight(insightId: string): Promise<APIResponse<Insight>> {
    return this.get<Insight>(`/insights/${insightId}`);
  }

  /**
   * List detected insights
   *
   * @param datasetId - Optional dataset filter
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of insights
   */
  async listInsights(
    datasetId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<Insight[]>> {
    const params = this.buildQueryParams({
      dataset: datasetId,
      page,
      page_size: pageSize
    });

    return this.paginatedRequest<Insight>('/insights', params);
  }

  /**
   * Perform funnel analysis
   *
   * Analyzes conversion rates and drop-offs through a multi-step funnel.
   *
   * @param config - Funnel configuration
   * @returns Funnel analysis results
   *
   * @example
   * ```typescript
   * const funnel = await client.analytics.analyzeFunnel({
   *   dataset: 'user_events',
   *   steps: [
   *     { name: 'Page View', event: 'page_view' },
   *     { name: 'Add to Cart', event: 'add_to_cart' },
   *     { name: 'Checkout', event: 'checkout' },
   *     { name: 'Purchase', event: 'purchase' }
   *   ],
   *   date_range: {
   *     start_date: '2025-09-01',
   *     end_date: '2025-09-30'
   *   },
   *   conversion_window: 86400 // 24 hours
   * });
   *
   * funnel.data.steps.forEach(step => {
   *   console.log(`${step.name}: ${step.count} (${step.conversion_rate}%)`);
   * });
   * ```
   */
  async analyzeFunnel(config: FunnelConfig): Promise<APIResponse<FunnelResult>> {
    return this.post<FunnelResult>('/funnel', {
      params: config as any
    });
  }

  /**
   * Perform cohort analysis
   *
   * Analyzes user behavior and retention across different cohorts over time.
   *
   * @param config - Cohort configuration
   * @returns Cohort analysis results
   *
   * @example
   * ```typescript
   * const cohorts = await client.analytics.analyzeCohort({
   *   dataset: 'users',
   *   cohort_dimension: 'signup_date',
   *   metric: {
   *     field: 'active_users',
   *     aggregation: AggregationType.COUNT
   *   },
   *   date_range: {
   *     start_date: '2025-01-01',
   *     end_date: '2025-09-30'
   *   },
   *   cohort_size: TimeGranularity.MONTH
   * });
   * ```
   */
  async analyzeCohort(config: CohortConfig): Promise<APIResponse<CohortResult>> {
    return this.post<CohortResult>('/cohort', {
      params: config as any
    });
  }

  /**
   * Export query results
   *
   * Exports analytics query results to various formats.
   *
   * @param queryId - Query ID or query configuration
   * @param format - Export format (csv, excel, json)
   * @returns Download URL for exported data
   */
  async exportResults(
    queryId: string | AnalyticsQuery,
    format: 'csv' | 'excel' | 'json' = 'csv'
  ): Promise<APIResponse<{ download_url: string; expires_at: string }>> {
    const data = typeof queryId === 'string'
      ? { query_id: queryId, format }
      : { query: queryId, format };

    return this.post<{ download_url: string; expires_at: string }>(
      '/export',
      { params: data as any }
    );
  }

  /**
   * Save a query for reuse
   *
   * @param name - Query name
   * @param query - Analytics query configuration
   * @param description - Optional description
   * @returns Saved query information
   */
  async saveQuery(
    name: string,
    query: AnalyticsQuery,
    description?: string
  ): Promise<APIResponse<{ id: string; name: string }>> {
    return this.post<{ id: string; name: string }>('/queries', {
      params: { name, query, description } as any
    });
  }

  /**
   * Get saved query by ID
   *
   * @param queryId - Saved query ID
   * @returns Query configuration
   */
  async getSavedQuery(
    queryId: string
  ): Promise<APIResponse<{ id: string; name: string; query: AnalyticsQuery }>> {
    return this.get<{ id: string; name: string; query: AnalyticsQuery }>(
      `/queries/${queryId}`
    );
  }

  /**
   * List saved queries
   *
   * @param page - Page number
   * @param pageSize - Items per page
   * @returns Paginated list of saved queries
   */
  async listSavedQueries(
    page: number = 1,
    pageSize: number = 20
  ): Promise<APIResponse<Array<{ id: string; name: string; query: AnalyticsQuery }>>> {
    return this.paginatedRequest<{ id: string; name: string; query: AnalyticsQuery }>(
      '/queries',
      this.buildQueryParams({ page, page_size: pageSize })
    );
  }

  /**
   * Delete a saved query
   *
   * @param queryId - Query ID
   * @returns Deletion confirmation
   */
  async deleteSavedQuery(queryId: string): Promise<APIResponse<void>> {
    return this.delete<void>(`/queries/${queryId}`);
  }
}

export default AnalyticsAPI;