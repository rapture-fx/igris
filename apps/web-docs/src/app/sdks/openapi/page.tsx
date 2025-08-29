import Link from 'next/link'
import { ArrowRightIcon, CogIcon, CommandLineIcon, DocumentTextIcon, GlobeAltIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function OpenAPIGeneratorPage() {
  const supportedLanguages = [
    {
      language: 'Python',
      generator: 'openapi-generator',
      packageManager: 'PyPI',
      status: 'Active',
      example: 'from schlep_engine_client import SchlepEngineClient\n\nclient = SchlepEngineClient(api_key="your_key", base_url="https://api.schlep-engine.com")\nresponse = client.upload_file("data.csv")'
    },
    {
      language: 'JavaScript/TypeScript',
      generator: 'openapi-generator',
      packageManager: 'NPM',
      status: 'Active',
      example: 'import { SchlepEngineClient } from \'@schlep-engine/client\';\n\nconst client = new SchlepEngineClient({ apiKey: \'your_key\' });\nconst response = await client.uploadFile(\'data.csv\');'
    },
    {
      language: 'Go',
      generator: 'openapi-generator',
      packageManager: 'Go Modules',
      status: 'Active',
      example: 'import "github.com/schlep-engine/go-client"\n\nclient := schlepengine.NewClient("your_key")\nresponse, err := client.UploadFile("data.csv")'
    },
    {
      language: 'Java',
      generator: 'openapi-generator',
      packageManager: 'Maven Central',
      status: 'Active',
      example: 'SchlepEngineClient client = new SchlepEngineClient("your_key");\nUploadResponse response = client.uploadFile("data.csv");'
    },
    {
      language: 'C#',
      generator: 'openapi-generator',
      packageManager: 'NuGet',
      status: 'Active',
      example: 'var client = new SchlepEngineClient("your_key");\nvar response = await client.UploadFileAsync("data.csv");'
    },
    {
      language: 'Ruby',
      generator: 'openapi-generator',
      packageManager: 'RubyGems',
      status: 'Active',
      example: 'client = SchlepEngine::Client.new(api_key: "your_key")\nresponse = client.upload_file("data.csv")'
    }
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">OpenAPI Client Generator</h1>
        <p className="text-xl text-gray-600 mb-6">
          Multi-language OpenAPI client generation system for Schlep-engine API with automatic CI/CD integration. 
          Generate clients for Python, JavaScript/TypeScript, Go, Java, C#, Ruby, PHP, Rust, and Swift.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="https://github.com/schlep-engine/openapi-client-generator"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View on GitHub
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://openapi-generator.tech/"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            OpenAPI Generator Docs
          </Link>
        </div>
      </div>

      {/* Key Features */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Key Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <GlobeAltIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Language Support</h3>
            <p className="text-gray-600">
              Generate clients for 9+ programming languages from a single OpenAPI specification.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CogIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Automatic Generation</h3>
            <p className="text-gray-600">
              CI/CD integration for automatic client generation on API schema changes.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <CheckCircleIcon className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Assurance</h3>
            <p className="text-gray-600">
              Automated testing and validation of generated clients before publishing.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <DocumentTextIcon className="h-8 w-8 text-orange-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Template Customization</h3>
            <p className="text-gray-600">
              Custom templates and configuration options for language-specific needs.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">📦</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Publishing Automation</h3>
            <p className="text-gray-600">
              Automatic package publishing to NPM, PyPI, Maven Central, and other registries.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-2xl mb-3">🔄</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Version Management</h3>
            <p className="text-gray-600">
              Semantic versioning and release management for generated clients.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Languages */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Supported Languages</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generator</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package Manager</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {supportedLanguages.map((lang, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{lang.language}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lang.generator}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{lang.packageManager}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✅ {lang.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Installation & Setup */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Installation & Setup</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Prerequisites</h3>
            <ul className="text-gray-600 space-y-2 mb-4">
              <li>• Docker (recommended)</li>
              <li>• OpenAPI Generator CLI</li>
              <li>• Node.js (for validation)</li>
              <li>• Python 3.8+ (for validation)</li>
            </ul>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Install OpenAPI Generator</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm">
{`# Install via NPM
npm install @openapitools/openapi-generator-cli -g

# Or use Docker
docker pull openapitools/openapi-generator-cli`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Start</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm">
{`# Generate all supported language clients
./scripts/generate.sh --all

# Generate specific language client
./scripts/generate.sh --language python

# Generate with custom config
./scripts/generate.sh --language python --config configs/python-custom.yaml

# Validate generated clients
./scripts/validate.sh --all`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Usage Examples</h2>
        
        <div className="grid gap-6">
          {supportedLanguages.slice(0, 3).map((lang, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{lang.language}</h3>
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-gray-100">{lang.example}</pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Configuration</h2>
        
        <p className="text-gray-600 mb-6">
          Each language has its own configuration file in the <code className="bg-gray-100 px-1 py-0.5 rounded">configs/</code> directory. 
          These files define generator options, template customizations, package metadata, publishing settings, and validation rules.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Python Configuration</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# configs/python.yaml
generatorName: python
inputSpec: https://api.schlep-engine.com/openapi.json
outputDir: generated/python
packageName: schlep_engine_client
packageVersion: 1.0.0
packageUrl: https://github.com/schlep-engine/python-client
gitUserId: schlep-engine
gitRepoId: python-client

additionalProperties:
  packageCompany: "Schlep Engine Inc"
  packageAuthor: "Schlep Engine Team"
  packageAuthorEmail: "dev@schlep-engine.com"
  packageDescription: "Official Python client for Schlep Engine API"
  projectName: "schlep-engine-client"`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">TypeScript Configuration</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`# configs/typescript.yaml
generatorName: typescript-node
inputSpec: https://api.schlep-engine.com/openapi.json
outputDir: generated/typescript
packageName: "@schlep-engine/client"
packageVersion: 1.0.0
npmName: "@schlep-engine/client"
npmRepository: "https://registry.npmjs.org"

additionalProperties:
  npmRepository: "https://registry.npmjs.org"
  snapshot: false
  npmVersion: "1.0.0"
  supportsES6: true
  withInterfaces: true
  useSingleRequestParameter: true`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CI/CD Integration */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibent text-gray-900 mb-6">CI/CD Integration</h2>
        
        <p className="text-gray-600 mb-6">
          The system includes automated workflows for complete client lifecycle management:
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">GitHub Actions Workflow</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`name: Generate OpenAPI Clients
on:
  push:
    paths: ['openapi.json']
    
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install OpenAPI Generator
        run: npm install @openapitools/openapi-generator-cli -g
        
      - name: Generate Clients
        run: ./scripts/generate.sh --all
        
      - name: Run Tests
        run: ./scripts/validate.sh --all
        
      - name: Publish Packages
        run: ./scripts/publish.sh --all
        env:
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
          PYPI_TOKEN: \${{ secrets.PYPI_TOKEN }}`}
              </pre>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Automation Features</h3>
            <ul className="text-gray-600 space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>API Change Detection:</strong> Monitor FastAPI schema changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Client Generation:</strong> Automatic generation on schema updates</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Quality Assurance:</strong> Automated testing and validation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Version Management:</strong> Semantic versioning based on changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Publishing:</strong> Automatic package publishing to registries</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Directory Structure */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Directory Structure</h2>
        
        <div className="bg-gray-900 rounded-lg p-6">
          <pre className="text-sm text-gray-100">
{`tools/openapi-client-generator/
├── configs/                    # Language-specific configurations
│   ├── python.yaml
│   ├── typescript.yaml
│   ├── go.yaml
│   └── ...
├── templates/                  # Custom templates
│   ├── python/
│   ├── typescript/
│   └── ...
├── scripts/                    # Generation and automation scripts
│   ├── generate.sh
│   ├── validate.sh
│   └── publish.sh
├── ci/                        # CI/CD configurations
│   ├── github-actions/
│   └── gitlab-ci/
├── generated/                 # Generated client outputs
│   ├── python/
│   ├── typescript/
│   └── ...
├── tests/                     # Validation tests
│   ├── integration/
│   └── unit/
└── docs/                      # Documentation
    ├── usage.md
    └── customization.md`}
          </pre>
        </div>
      </section>

      {/* Best Practices */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Best Practices</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">✅ Do</h3>
            <ul className="text-blue-800 space-y-2">
              <li>• Keep OpenAPI specification up to date</li>
              <li>• Use semantic versioning for client releases</li>
              <li>• Test generated clients before publishing</li>
              <li>• Customize templates for specific needs</li>
              <li>• Monitor client usage and feedback</li>
            </ul>
          </div>
          
          <div className="border border-red-200 bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-3">❌ Don't</h3>
            <ul className="text-red-800 space-y-2">
              <li>• Manually edit generated client code</li>
              <li>• Publish untested client versions</li>
              <li>• Break backward compatibility unnecessarily</li>
              <li>• Ignore validation errors</li>
              <li>• Skip documentation updates</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resources</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">📚 Documentation</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/openapi-client-generator/blob/main/docs/USAGE.md" className="text-blue-600 hover:text-blue-700">
                  Usage Guide →
                </Link>
              </li>
              <li>
                <Link href="https://github.com/schlep-engine/openapi-client-generator/blob/main/docs/CUSTOMIZATION.md" className="text-blue-600 hover:text-blue-700">
                  Customization Guide →
                </Link>
              </li>
              <li>
                <Link href="https://openapi-generator.tech/" className="text-blue-600 hover:text-blue-700">
                  OpenAPI Generator Docs →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">🛠️ Tools</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/openapi-client-generator" className="text-blue-600 hover:text-blue-700">
                  Generator Repository →
                </Link>
              </li>
              <li>
                <Link href="https://api.schlep-engine.com/docs" className="text-blue-600 hover:text-blue-700">
                  OpenAPI Specification →
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-blue-600 hover:text-blue-700">
                  API Reference →
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-3">💬 Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="https://github.com/schlep-engine/openapi-client-generator/issues" className="text-blue-600 hover:text-blue-700">
                  GitHub Issues →
                </Link>
              </li>
              <li>
                <Link href="mailto:support@schlep-engine.com" className="text-blue-600 hover:text-blue-700">
                  Email Support →
                </Link>
              </li>
              <li>
                <Link href="/guides/troubleshooting" className="text-blue-600 hover:text-blue-700">
                  Troubleshooting Guide →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}