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
  features?: any[]
  frameworks?: any[]
  methods?: any[]
  types?: any[]
  formats?: any[]
  benchmarks?: any[]
  strategies?: any[]
  patterns?: any[]
  examples?: string[]
  action?: {
    label: string
    target?: string
    url?: string
  }
  languages?: string[]
  codeExamplesRef?: string
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