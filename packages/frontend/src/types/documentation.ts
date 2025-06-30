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