/**
 * Billing and Subscription Types for LemonSqueezy Integration
 * ===========================================================
 * 
 * TypeScript type definitions that mirror the Pydantic models in the backend
 * billing system for LemonSqueezy integration.
 */

// Enums matching backend implementation
export enum SubscriptionStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled", 
  EXPIRED = "expired",
  ON_TRIAL = "on_trial",
  PAST_DUE = "past_due",
  UNPAID = "unpaid",
  PAUSED = "paused"
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid", 
  FAILED = "failed",
  REFUNDED = "refunded"
}

export enum UsageRecordType {
  API_REQUESTS = "api_requests",
  DATA_PROCESSED = "data_processed", 
  STORAGE_USED = "storage_used",
  ML_OPERATIONS = "ml_operations"
}

export enum LemonSqueezyEventType {
  // Subscription events
  SUBSCRIPTION_CREATED = "subscription_created",
  SUBSCRIPTION_UPDATED = "subscription_updated",
  SUBSCRIPTION_CANCELLED = "subscription_cancelled",
  SUBSCRIPTION_RESUMED = "subscription_resumed",
  SUBSCRIPTION_EXPIRED = "subscription_expired",
  SUBSCRIPTION_PAUSED = "subscription_paused",
  SUBSCRIPTION_UNPAUSED = "subscription_unpaused",
  
  // Payment events
  ORDER_CREATED = "order_created",
  ORDER_REFUNDED = "order_refunded",
  
  // Usage events
  SUBSCRIPTION_PAYMENT_SUCCESS = "subscription_payment_success",
  SUBSCRIPTION_PAYMENT_FAILED = "subscription_payment_failed",
  SUBSCRIPTION_PAYMENT_RECOVERED = "subscription_payment_recovered",
  
  // License events
  LICENSE_KEY_CREATED = "license_key_created",
  LICENSE_KEY_UPDATED = "license_key_updated"
}

export enum SubscriptionTier {
  FREE = "free",
  STARTER = "starter",
  PRO = "pro", 
  ENTERPRISE = "enterprise"
}

// Core billing interfaces
export interface Usage {
  total_requests: number
  data_processed: number
  storage_used: number
  ml_operations: number
  cost: number
  period: string
  currency: string
}

export interface SubscriptionInfo {
  id: string
  status: SubscriptionStatus
  variant_id: string
  variant_name: string
  customer_id: string
  renews_at?: string | null
  ends_at?: string | null
  trial_ends_at?: string | null
  price: number
  currency: string
  created_at: string
  updated_at: string
}

export interface PaymentInfo {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  created_at: string
  subscription_id?: string | null
}

export interface UsageRecord {
  id: string
  subscription_id: string
  type: UsageRecordType
  quantity: number
  timestamp: string
  metadata?: Record<string, any> | null
}

export interface BillingOverview {
  subscription?: SubscriptionInfo | null
  usage: Usage
  recent_payments: PaymentInfo[]
  usage_records: UsageRecord[]
  next_invoice_date?: string | null
  billing_alerts: string[]
}

// Webhook types
export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string
    webhook_id: string
    [key: string]: any
  }
  data: {
    id: string
    type: string
    attributes: Record<string, any>
    relationships?: Record<string, any>
  }
}

export interface WebhookProcessingResult {
  success: boolean
  event_type: string
  event_id: string
  message: string
  processed_at: string
}

// API Request/Response types
export interface GetUsageParams {
  start_date?: string
  end_date?: string
  customer_id?: string
}

export interface CreateUsageRecordParams {
  subscription_id: string
  usage_type: UsageRecordType
  quantity: number
  metadata?: Record<string, any>
}

export interface GetCustomerPaymentsParams {
  customer_id: string
  limit?: number
}

// Frontend-specific billing context types
export interface BillingContext {
  customer_id?: string | null
  subscription_id?: string | null
  subscription_status?: SubscriptionStatus | null
  subscription_tier: SubscriptionTier
  trial_ends_at?: string | null
  subscription_limits: SubscriptionLimits
  usage_today: Record<string, number>
  is_payment_overdue: boolean
  billing_alerts: string[]
}

export interface SubscriptionLimits {
  requests_per_minute: number
  requests_per_hour: number
  requests_per_day: number
  data_processing_mb_per_day: number
  ml_operations_per_day: number
  storage_gb: number
  concurrent_jobs: number
}

// Billing alert types
export interface BillingAlert {
  id: string
  type: 'usage' | 'payment' | 'trial' | 'subscription'
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  action_url?: string
  action_text?: string
  created_at: string
  read: boolean
}

// Usage tracking types
export interface UsageEvent {
  customer_id: string
  event_type: UsageRecordType
  quantity: number
  timestamp: string
  metadata?: Record<string, any>
}

export interface DailyUsageSummary {
  date: string
  api_requests: number
  data_processed_mb: number
  ml_operations: number
  storage_used_gb: number
  estimated_cost: number
}

export interface MonthlyUsageSummary {
  month: string
  year: number
  total_api_requests: number
  total_data_processed_gb: number
  total_ml_operations: number
  average_storage_used_gb: number
  total_cost: number
  daily_breakdown: DailyUsageSummary[]
}

// Plan comparison types
export interface PlanFeature {
  name: string
  included: boolean
  limit?: number | string
  description?: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: SubscriptionTier
  price_monthly: number
  price_yearly: number
  currency: string
  features: PlanFeature[]
  limits: SubscriptionLimits
  popular?: boolean
  trial_days?: number
}

// Billing component props types
export interface UsageChartProps {
  usage: Usage[]
  timeframe: 'day' | 'week' | 'month' | 'year'
  metric: keyof Usage
}

export interface SubscriptionCardProps {
  subscription: SubscriptionInfo
  usage: Usage
  onUpgrade?: () => void
  onCancel?: () => void
  onModify?: () => void
}

export interface BillingHistoryProps {
  payments: PaymentInfo[]
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

export interface UsageAlertsProps {
  alerts: BillingAlert[]
  onDismiss?: (alertId: string) => void
  onActionClick?: (alert: BillingAlert) => void
}

// API client types
export interface BillingApiClient {
  getUsage(params?: GetUsageParams): Promise<Usage>
  getSubscription(subscriptionId: string): Promise<SubscriptionInfo>
  getCustomerSubscriptions(customerId: string): Promise<SubscriptionInfo[]>
  createUsageRecord(params: CreateUsageRecordParams): Promise<Record<string, any>>
  getCustomerPayments(params: GetCustomerPaymentsParams): Promise<PaymentInfo[]>
  getBillingOverview(customerId: string): Promise<BillingOverview>
}

// Error types specific to billing
export interface BillingError {
  code: 'PAYMENT_REQUIRED' | 'SUBSCRIPTION_EXPIRED' | 'USAGE_LIMIT_EXCEEDED' | 'INVALID_SUBSCRIPTION' | 'API_ERROR'
  message: string
  details?: {
    subscription_id?: string
    current_usage?: Usage
    limit_exceeded?: string
    retry_after?: number
  }
}

// Utility types
export type BillingEventHandler<T = any> = (event: T) => void | Promise<void>

export interface BillingEventHandlers {
  onUsageLimitExceeded?: BillingEventHandler<{ limit: string; current: number; maximum: number }>
  onPaymentFailed?: BillingEventHandler<{ subscription_id: string; amount: number }>
  onTrialExpiring?: BillingEventHandler<{ days_remaining: number }>
  onSubscriptionCancelled?: BillingEventHandler<{ subscription_id: string; ends_at: string }>
}

// React Hook types
export interface UseBillingReturn {
  billing: BillingContext | null
  usage: Usage | null
  loading: boolean
  error: BillingError | null
  refetch: () => Promise<void>
}

export interface UseSubscriptionReturn {
  subscription: SubscriptionInfo | null
  loading: boolean
  error: BillingError | null
  upgrade: (planId: string) => Promise<void>
  cancel: () => Promise<void>
  reactivate: () => Promise<void>
}

export interface UseUsageTrackingReturn {
  trackApiRequest: () => void
  trackDataProcessing: (bytes: number) => void
  trackMlOperation: (type: string, duration: number) => void
  trackStorageUsage: (bytes: number) => void
}

// Form types for billing management
export interface UpdatePaymentMethodForm {
  payment_method_id: string
  set_as_default: boolean
}

export interface UpdateBillingAddressForm {
  name: string
  company?: string
  address_line_1: string
  address_line_2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

export interface SubscriptionUpdateForm {
  plan_id: string
  billing_interval: 'monthly' | 'yearly'
  proration_behavior: 'create_prorations' | 'none'
}

