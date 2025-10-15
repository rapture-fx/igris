export interface NavigationItem {
  id: string
  label: string
  icon: string
}

export interface NavigationSection {
  id: string
  title: string
  items: NavigationItem[]
}

export interface NavigationConfig {
  sections: NavigationSection[]
}

export interface CodeExample {
  language: string
  title: string
  description: string
  code: string
  response?: string
}

export interface APIParameter {
  name: string
  type: string
  required: boolean
  description: string
}

export interface APIEndpoint {
  method: string
  path: string
  description: string
  parameters?: APIParameter[]
}

export interface ContentSection {
  id: string
  title: string
  content: string
  lastUpdated?: string
  author?: string
}

export interface DocumentationContent {
  navigation: NavigationConfig
  sections: Record<string, ContentSection>
  apiEndpoints: Record<string, APIEndpoint[]>
  codeExamples: Record<string, CodeExample[]>
}

// Content Renderer Types
export interface ContentSectionItem {
  type: string
  title?: string
  description?: string
  style?: string
  icon?: string
  items?: any[]
  sections?: ContentSectionItem[]
  frameworks?: any[]
  methods?: any[]
  types?: any[]
  formats?: any[]
  benchmarks?: any[]
  strategies?: any[]
  patterns?: any[]
  endpoints?: any[]
  limits?: any
  transformationTypes?: {
    category: string
    color: string
    icon: string
    types: {
      name: string
      description: string
      methods: string[]
    }[]
  }[]
  exportFormats?: {
    category: string
    color: string
    icon: string
    formats: {
      name: string
      description: string
      features: string[]
      useCase: string
    }[]
  }[]
  statusFlow?: {
    states: {
      name: string
      description: string
      color: string
      icon: string
    }[]
    transitions: {
      from: string
      to: string
      action?: string
    }[]
  }
  examples?: string[]
  action?: {
    label: string
    target?: string
    url?: string
  }
  languages?: string[]
  codeExamplesRef?: string
  
  // Pagination properties
  paginationStrategies?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    benefits: string[];
    useCase: string;
  }>;
  paginationParameters?: Array<{
    name: string;
    type: string;
    default: string;
    description: string;
    range: string;
  }>;
  paginationPractices?: Array<{
    category: string;
    color: string;
    icon: string;
    tips: string[];
  }>;

  // Monitoring properties
  monitoringFeatures?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    metrics: string[];
  }>;
  monitoringDashboards?: Array<{
    category: string;
    color: string;
    icon: string;
    widgets: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  }>;
  logLevels?: Array<{
    level: string;
    color: string;
    description: string;
    useCase: string;
  }>;
  logFormats?: Array<{
    name: string;
    description: string;
    benefits: string[];
  }>;

  // Security properties
  securityCategories?: Array<{
    name: string;
    color: string;
    icon: string;
    practices: string[];
  }>;
  securityFeatures?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    capabilities: string[];
  }>;
  securityConfigurations?: Array<{
    category: string;
    settings: Array<{
      name: string;
      description: string;
      options: string[];
      recommended: string;
    }>;
  }>;

  // Troubleshooting properties
  troubleshootingCategories?: Array<{
    name: string;
    color: string;
    icon: string;
    issues: Array<{
      problem: string;
      solution: string;
    }>;
  }>;
  troubleshootingDiagnostics?: Array<{
    category: string;
    description: string;
    steps: string[];
  }>;

  // Performance properties
  performanceCategories?: Array<{
    name: string;
    color: string;
    icon: string;
    techniques: string[];
  }>;
  performanceBenchmarks?: Array<{
    category: string;
    metrics: string[];
  }>;
  performanceTips?: Array<{
    category: string;
    description: string;
    tips: string[];
  }>;

  // Testing properties
  testingEnvironments?: Array<{
    name: string;
    color: string;
    icon: string;
    features: string[];
  }>;
  testingStrategies?: Array<{
    category: string;
    description: string;
    practices: string[];
  }>;
  testingTools?: Array<{
    name: string;
    description: string;
    useCase: string;
    features: string[];
  }>;

  // Error handling properties
  errorCategories?: Array<{
    name: string;
    color: string;
    icon: string;
    description: string;
    examples: string[];
    recoveryActions: string[];
  }>;
  recoveryStrategies?: Array<{
    strategy: string;
    description: string;
    useCase: string;
    implementation: string[];
    benefits: string[];
  }>;
  errorMonitoring?: Array<{
    category: string;
    color: string;
    icon: string;
    features: string[];
  }>;

  // Observability properties
  observabilityFeatures?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    capabilities: string[];
  }>;
  monitoringStack?: Array<{
    category: string;
    description: string;
    tools: Array<{
      name: string;
      purpose: string;
      integration: string;
    }>;
  }>;
  observabilityMetrics?: Array<{
    category: string;
    color: string;
    icon: string;
    metrics: string[];
  }>;

  // Cost optimization properties
  costStrategies?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    costMultiplier: string;
    timeReduction: string;
    features: string[];
    useCase: string;
  }>;
  costMonitoring?: Array<{
    category: string;
    color: string;
    icon: string;
    features: string[];
  }>;
  costOptimizationTechniques?: Array<{
    technique: string;
    description: string;
    savingsRange: string;
    complexity: string;
    implementation: string[];
    benefits: string[];
  }>;

  // Custom validation properties
  validationRules?: Array<{
    name: string;
    description: string;
    color: string;
    icon: string;
    severity: string;
    features: string[];
    useCase: string;
  }>;
  validationConfiguration?: Array<{
    category: string;
    description: string;
    color: string;
    icon: string;
    settings: Array<{
      name: string;
      description: string;
      action: string;
      recommended: string;
    }>;
  }>;
  validationPatterns?: Array<{
    pattern: string;
    description: string;
    complexity: string;
    icon: string;
    validations: string[];
    industries: string[];
    implementation: string[];
  }>;
  
  // Rate Limits
  rateLimits?: Array<{
    tier: string;
    description: string;
    color: string;
    icon: string;
    limits: Array<{
      metric: string;
      value: string;
      description: string;
    }>;
  }>;
  handlingStrategies?: Array<{
    strategy: string;
    description: string;
    color: string;
    icon: string;
    benefits: string[];
    implementation: string[];
    useCase: string;
  }>;
  monitoringTools?: Array<{
    tool: string;
    description: string;
    color: string;
    icon: string;
    headers?: Array<{
      header: string;
      description: string;
      example: string;
    }>;
    metrics?: Array<{
      metric: string;
      description: string;
      action: string;
    }>;
    alerts?: Array<{
      alert: string;
      description: string;
      action: string;
    }>;
  }>;

  // SDK properties
  sdkMethods?: InstallationMethod[];
  features?: SDKFeature[];

  // Webhook properties
  eventCategories?: EventCategory[];
  configMethod?: string;
}

export interface ContentRendererSection {
  id: string
  title: string
  subtitle?: string
  lastUpdated?: string
  sections: ContentSectionItem[]
}

export interface ContentRendererProps {
  content: ContentRendererSection
  onSectionChange: (sectionId: string) => void
  onLanguageChange?: (language: string) => void
  selectedLanguage?: string
  codeExamples?: CodeExample[]
}

// Individual component props
export interface SectionComponentProps {
  section: ContentSectionItem
  onSectionChange: (sectionId: string) => void
  onLanguageChange?: (language: string) => void
  selectedLanguage?: string
  codeExamples?: CodeExample[]
}

// SDK interfaces
export interface InstallationMethod {
  name: string;
  command: string;
}

export interface SDKFeature {
  name: string;
  description: string;
  icon: string;
}

// Webhook interfaces
export interface WebhookEvent {
  name: string;
  description: string;
}

export interface EventCategory {
  name: string;
  color: string;
  events: WebhookEvent[];
}

// REST API interfaces
export interface APIDetail {
  name: string;
  description: string;
  example?: string;
  limits?: Array<{
    plan: string;
    limit: string;
  }>;
  icon: string;
}
