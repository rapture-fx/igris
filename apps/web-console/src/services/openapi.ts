export interface OpenAPIParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  required: boolean
  schema: {
    type: string
    format?: string
    enum?: string[]
    example?: any
    default?: any
  }
  description?: string
}

export interface OpenAPIRequestBody {
  required: boolean
  content: {
    [mediaType: string]: {
      schema: any
      example?: any
    }
  }
}

export interface OpenAPIResponse {
  description: string
  content?: {
    [mediaType: string]: {
      schema: any
      example?: any
    }
  }
}

export interface OpenAPIEndpoint {
  id: string
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses: { [statusCode: string]: OpenAPIResponse }
  security?: any[]
  deprecated?: boolean
  'x-beta'?: boolean
}

export interface OpenAPIPath {
  [method: string]: OpenAPIEndpoint
}

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  servers: Array<{
    url: string
    description?: string
  }>
  paths: { [path: string]: OpenAPIPath }
  components?: {
    schemas?: { [name: string]: any }
    securitySchemes?: { [name: string]: any }
  }
}

export interface ParsedEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  category: string
  parameters: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses: { [statusCode: string]: OpenAPIResponse }
  deprecated?: boolean
  beta?: boolean
  operationId?: string
  tags?: string[]
}

export class OpenAPIService {
  private cachedSpecs: Map<string, OpenAPISpec> = new Map()
  private cachedEndpoints: Map<string, ParsedEndpoint[]> = new Map()

  async loadOpenAPISpec(url: string): Promise<OpenAPISpec> {
    if (this.cachedSpecs.has(url)) {
      return this.cachedSpecs.get(url)!
    }

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load OpenAPI spec: ${response.statusText}`)
      }

      const spec: OpenAPISpec = await response.json()
      this.cachedSpecs.set(url, spec)
      return spec
    } catch (error) {
      console.error('Error loading OpenAPI spec:', error)
      throw error
    }
  }

  async getEndpoints(specUrl: string): Promise<ParsedEndpoint[]> {
    if (this.cachedEndpoints.has(specUrl)) {
      return this.cachedEndpoints.get(specUrl)!
    }

    const spec = await this.loadOpenAPISpec(specUrl)
    const endpoints = this.parseEndpoints(spec)
    this.cachedEndpoints.set(specUrl, endpoints)
    return endpoints
  }

  private parseEndpoints(spec: OpenAPISpec): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = []

    Object.entries(spec.paths).forEach(([path, pathObject]) => {
      Object.entries(pathObject).forEach(([method, endpoint]) => {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          return
        }

        const parsedEndpoint: ParsedEndpoint = {
          id: endpoint.operationId || `${method.toUpperCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: endpoint.summary || `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase() as ParsedEndpoint['method'],
          path,
          description: endpoint.description || endpoint.summary || '',
          category: this.categorizeEndpoint(endpoint.tags || [], path),
          parameters: endpoint.parameters || [],
          requestBody: endpoint.requestBody,
          responses: endpoint.responses,
          deprecated: endpoint.deprecated,
          beta: endpoint['x-beta'],
          operationId: endpoint.operationId,
          tags: endpoint.tags
        }

        endpoints.push(parsedEndpoint)
      })
    })

    return endpoints.sort((a, b) => {
      // Sort by category first, then by name
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })
  }

  private categorizeEndpoint(tags: string[], path: string): string {
    if (tags.length > 0) {
      // Use first tag as category
      return tags[0]
    }

    // Fallback categorization based on path
    const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'))
    
    if (pathSegments.includes('digital-twin')) return 'Digital Twin AI'
    if (pathSegments.includes('datasets')) return 'Dataset Marketplace'
    if (pathSegments.includes('experiments') || pathSegments.includes('mlops')) return 'MLOps Platform'
    if (pathSegments.includes('streaming')) return 'Real-time Streaming'
    if (pathSegments.includes('serving') || pathSegments.includes('models')) return 'Model Serving'
    if (pathSegments.includes('security') || pathSegments.includes('audit')) return 'Security & Compliance'
    
    return 'General'
  }

  generateExampleRequest(endpoint: ParsedEndpoint): any {
    if (!endpoint.requestBody) return null

    const contentTypes = Object.keys(endpoint.requestBody.content)
    if (contentTypes.length === 0) return null

    const contentType = contentTypes.find(ct => ct.includes('json')) || contentTypes[0]
    const content = endpoint.requestBody.content[contentType]
    
    if (content.example) {
      return content.example
    }

    if (content.schema) {
      return this.generateExampleFromSchema(content.schema)
    }

    return null
  }

  private generateExampleFromSchema(schema: any): any {
    if (!schema) return null

    switch (schema.type) {
      case 'object':
        const obj: any = {}
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
            if (propSchema.example !== undefined) {
              obj[key] = propSchema.example
            } else {
              obj[key] = this.generateExampleFromSchema(propSchema)
            }
          })
        }
        return obj

      case 'array':
        if (schema.items) {
          return [this.generateExampleFromSchema(schema.items)]
        }
        return []

      case 'string':
        if (schema.enum) return schema.enum[0]
        if (schema.format === 'email') return 'user@example.com'
        if (schema.format === 'date') return '2024-01-01'
        if (schema.format === 'date-time') return '2024-01-01T00:00:00Z'
        return schema.default || 'string'

      case 'number':
        return schema.default || schema.example || 42

      case 'integer':
        return schema.default || schema.example || 1

      case 'boolean':
        return schema.default !== undefined ? schema.default : true

      default:
        return schema.default || null
    }
  }

  generateCodeSnippets(endpoint: ParsedEndpoint, requestConfig: any): { [language: string]: string } {
    const { method, path, headers, data } = requestConfig
    const url = requestConfig.url || `https://api.schlep-engine.com${path}`

    return {
      curl: this.generateCurlSnippet(method, url, headers, data),
      javascript: this.generateJavaScriptSnippet(method, url, headers, data),
      python: this.generatePythonSnippet(method, url, headers, data),
      node: this.generateNodeSnippet(method, url, headers, data),
      go: this.generateGoSnippet(method, url, headers, data)
    }
  }

  private generateCurlSnippet(method: string, url: string, headers: any, data: any): string {
    let curl = `curl -X ${method} \\\n  "${url}"`
    
    Object.entries(headers || {}).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`
    })

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      curl += ` \\\n  -d '${JSON.stringify(data)}'`
    }

    return curl
  }

  private generateJavaScriptSnippet(method: string, url: string, headers: any, data: any): string {
    const config = {
      method,
      headers: headers || {},
      ...(data && ['POST', 'PUT', 'PATCH'].includes(method) && { body: JSON.stringify(data) })
    }

    return `fetch('${url}', ${JSON.stringify(config, null, 2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`
  }

  private generatePythonSnippet(method: string, url: string, headers: any, data: any): string {
    let python = `import requests\n\nurl = "${url}"\n`
    
    if (headers) {
      python += `headers = ${JSON.stringify(headers, null, 2).replace(/"/g, "'")}\n`
    }

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      python += `data = ${JSON.stringify(data, null, 2).replace(/"/g, "'")}\n`
    }

    python += `\nresponse = requests.${method.toLowerCase()}(url`
    if (headers) python += `, headers=headers`
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) python += `, json=data`
    python += `)\nprint(response.json())`

    return python
  }

  private generateNodeSnippet(method: string, url: string, headers: any, data: any): string {
    return `const axios = require('axios');

const config = {
  method: '${method.toLowerCase()}',
  url: '${url}',
  headers: ${JSON.stringify(headers || {}, null, 2)},
  ${data && ['POST', 'PUT', 'PATCH'].includes(method) ? `data: ${JSON.stringify(data, null, 2)}` : ''}
};

axios(config)
  .then(response => console.log(response.data))
  .catch(error => console.error('Error:', error));`
  }

  private generateGoSnippet(method: string, url: string, headers: any, data: any): string {
    let go = `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {`

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      go += `
    data := ${JSON.stringify(data, null, 4)}
    jsonData, _ := json.Marshal(data)
    
    req, err := http.NewRequest("${method}", "${url}", bytes.NewBuffer(jsonData))`
    } else {
      go += `
    req, err := http.NewRequest("${method}", "${url}", nil)`
    }

    go += `
    if err != nil {
        panic(err)
    }`

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        go += `
    req.Header.Set("${key}", "${value}")`
      })
    }

    go += `
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}`

    return go
  }

  validateRequest(endpoint: ParsedEndpoint, requestData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate required parameters
    endpoint.parameters?.forEach(param => {
      if (param.required) {
        const value = requestData[param.in]?.[param.name]
        if (value === undefined || value === null || value === '') {
          errors.push(`Required ${param.in} parameter '${param.name}' is missing`)
        } else {
          // Validate parameter type
          const validation = this.validateParameterType(value, param.schema)
          if (!validation.valid) {
            errors.push(`Parameter '${param.name}': ${validation.error}`)
          }
        }
      }
    })

    // Validate request body
    if (endpoint.requestBody?.required && !requestData.body) {
      errors.push('Request body is required but not provided')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private validateParameterType(value: any, schema: any): { valid: boolean; error?: string } {
    if (!schema) return { valid: true }

    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Expected string value' }
        }
        if (schema.enum && !schema.enum.includes(value)) {
          return { valid: false, error: `Value must be one of: ${schema.enum.join(', ')}` }
        }
        break

      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          return { valid: false, error: 'Expected numeric value' }
        }
        break

      case 'integer':
        const int = parseInt(value)
        if (isNaN(int) || int.toString() !== value.toString()) {
          return { valid: false, error: 'Expected integer value' }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return { valid: false, error: 'Expected boolean value' }
        }
        break
    }

    return { valid: true }
  }
}

export const openAPIService = new OpenAPIService()

// Mock OpenAPI spec for AI Company endpoints
export const AI_COMPANY_OPENAPI_SPEC: OpenAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Schlep-Engine AI Company API',
    version: '2.1.0',
    description: 'Comprehensive AI solutions for enterprise companies'
  },
  servers: [
    { url: 'https://api.schlep-engine.com', description: 'Production' },
    { url: 'https://staging-api.schlep-engine.com', description: 'Staging' },
    { url: 'https://dev-api.schlep-engine.com', description: 'Development' },
    { url: 'http://localhost:8000', description: 'Local Development' }
  ],
  paths: {
    '/api/v1/manufacturing/digital-twin/create': {
      post: {
        operationId: 'createDigitalTwin',
        summary: 'Create AI Model Digital Twin',
        description: 'Create a digital twin of your ML model with full lifecycle tracking',
        tags: ['Digital Twin AI'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  twin_id: { type: 'string', example: 'ai_model_twin_001' },
                  twin_name: { type: 'string', example: 'Fraud Detection Model Twin' },
                  twin_type: { type: 'string', enum: ['AI_MODEL', 'PROCESS', 'SYSTEM'], example: 'AI_MODEL' },
                  configuration: {
                    type: 'object',
                    properties: {
                      model_type: { type: 'string', example: 'xgboost' },
                      version: { type: 'string', example: '2.1.0' },
                      performance_targets: {
                        type: 'object',
                        properties: {
                          accuracy: { type: 'number', example: 0.95 },
                          latency_ms: { type: 'integer', example: 50 }
                        }
                      }
                    }
                  }
                },
                required: ['twin_id', 'twin_name', 'twin_type', 'configuration']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Digital twin created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    twin_id: { type: 'string' },
                    status: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/manufacturing/digital-twin/{id}/insights': {
      get: {
        operationId: 'getTwinInsights',
        summary: 'AI Twin Performance Analytics',
        description: 'Get comprehensive analytics for your AI model twin',
        tags: ['Digital Twin AI'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'analytics_types', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'time_range_hours', in: 'query', required: false, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Analytics retrieved successfully'
          }
        }
      }
    },
    '/api/v1/datasets/catalog': {
      post: {
        operationId: 'catalogDataset',
        summary: 'Catalog Training Dataset',
        description: 'Register and catalog a new dataset in the marketplace',
        tags: ['Dataset Marketplace'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'financial_fraud_detection_v3' },
                  title: { type: 'string', example: 'Enhanced Fraud Detection Dataset' },
                  description: { type: 'string' },
                  dataset_type: { type: 'string', enum: ['structured', 'unstructured', 'time-series'] },
                  tags: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Dataset cataloged successfully' }
        }
      }
    },
    '/api/v1/experiments/create': {
      post: {
        operationId: 'createMLExperiment',
        summary: 'Create ML Experiment',
        description: 'Set up a comprehensive ML experiment with version control',
        tags: ['MLOps Platform'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  dataset_ids: { type: 'array', items: { type: 'string' } },
                  model_config: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Experiment created successfully' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    }
  }
}