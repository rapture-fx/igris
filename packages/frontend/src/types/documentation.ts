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
  features?: {
    category: string
    color: string
    icon: string
    items: string[]
  }[]
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