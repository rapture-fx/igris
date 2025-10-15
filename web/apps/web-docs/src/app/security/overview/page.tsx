export default function SecurityOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Security Overview</h1>
        <p className="text-xl text-gray-600">
          Comprehensive security framework protecting your data throughout the entire ML pipeline with enterprise-grade controls and compliance.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Security Architecture</h2>
        <p className="text-gray-600 mb-6">
          Schlep Engine implements a multi-layered security approach that protects data at rest, in transit, and during processing. 
          Our security model follows industry best practices and compliance standards to ensure your sensitive data remains secure.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
            <h3 className="font-semibold mb-3">Data Protection</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• AES-256 encryption at rest</li>
              <li>• TLS 1.3 for data in transit</li>
              <li>• End-to-end encryption for sensitive data</li>
              <li>• Automated PII detection and redaction</li>
            </ul>
          </div>
          
          <div className="bg-green-50 border-l-4 border-green-400 p-6">
            <h3 className="font-semibold mb-3">Access Control</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Role-based access control (RBAC)</li>
              <li>• Multi-factor authentication (MFA)</li>
              <li>• OAuth2 and SAML SSO integration</li>
              <li>• API key management with scoped permissions</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Authentication & Authorization</h2>
        
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Authentication Methods</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded">
                <h4 className="font-medium text-sm mb-2">JWT Tokens</h4>
                <p className="text-xs text-gray-600">Secure, stateless authentication with configurable expiration</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <h4 className="font-medium text-sm mb-2">OAuth2 / SAML</h4>
                <p className="text-xs text-gray-600">Enterprise SSO integration with major identity providers</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded">
                <h4 className="font-medium text-sm mb-2">API Keys</h4>
                <p className="text-xs text-gray-600">Programmatic access with granular permission scopes</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Authorization Framework</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <p className="font-medium text-sm">Role-Based Access Control (RBAC)</p>
                  <p className="text-xs text-gray-600">Predefined roles with specific permissions for different user types</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                </div>
                <div>
                  <p className="font-medium text-sm">Attribute-Based Access Control (ABAC)</p>
                  <p className="text-xs text-gray-600">Fine-grained permissions based on user, resource, and context attributes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                </div>
                <div>
                  <p className="font-medium text-sm">Resource-Level Permissions</p>
                  <p className="text-xs text-gray-600">Control access to specific datasets, models, and investigations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Security & Privacy</h2>
        
        <div className="space-y-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-6">
            <h3 className="font-semibold mb-3">PII Protection</h3>
            <p className="text-gray-700 mb-4">
              Automatic detection and protection of personally identifiable information (PII) throughout the data pipeline.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Automated PII detection using ML models</li>
              <li>• Configurable data masking and redaction</li>
              <li>• Tokenization for sensitive data elements</li>
              <li>• Data anonymization and pseudonymization</li>
            </ul>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-400 p-6">
            <h3 className="font-semibold mb-3">Data Retention & Deletion</h3>
            <p className="text-gray-700 mb-4">
              Comprehensive data lifecycle management with automated retention policies and secure deletion capabilities.
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Configurable data retention periods</li>
              <li>• Automated data purging and archival</li>
              <li>• Right to erasure compliance (GDPR)</li>
              <li>• Secure data destruction with audit trails</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Compliance & Auditing</h2>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold mb-4">Supported Compliance Standards</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded border">
              <p className="font-medium text-sm">GDPR</p>
              <p className="text-xs text-gray-600">EU data protection</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded border">
              <p className="font-medium text-sm">HIPAA</p>
              <p className="text-xs text-gray-600">Healthcare data</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded border">
              <p className="font-medium text-sm">SOC 2</p>
              <p className="text-xs text-gray-600">Service organization</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded border">
              <p className="font-medium text-sm">ISO 27001</p>
              <p className="text-xs text-gray-600">Information security</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Comprehensive Audit Logging</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">User Actions</span>
              <span className="text-sm text-gray-600">All user interactions and data access attempts</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Data Changes</span>
              <span className="text-sm text-gray-600">Complete data lineage and modification history</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">System Events</span>
              <span className="text-sm text-gray-600">Security events, errors, and system changes</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">API Activity</span>
              <span className="text-sm text-gray-600">All API requests, responses, and authentication events</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Infrastructure Security</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Network Security</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• VPC isolation and network segmentation</li>
              <li>• Web Application Firewall (WAF)</li>
              <li>• DDoS protection and rate limiting</li>
              <li>• Intrusion detection and prevention</li>
            </ul>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Application Security</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Regular security scanning and testing</li>
              <li>• Dependency vulnerability monitoring</li>
              <li>• Container security and image scanning</li>
              <li>• Secure coding practices and reviews</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Security Monitoring</h2>
        
        <div className="bg-red-50 border-l-4 border-red-400 p-6">
          <h3 className="font-semibold mb-3">Real-time Security Monitoring</h3>
          <p className="text-gray-700 mb-4">
            Continuous monitoring and alerting for security threats, anomalous behavior, and compliance violations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded p-3 border">
              <h4 className="font-medium text-sm mb-1">Threat Detection</h4>
              <p className="text-xs text-gray-600">ML-powered anomaly detection for suspicious activities</p>
            </div>
            <div className="bg-white rounded p-3 border">
              <h4 className="font-medium text-sm mb-1">Behavioral Analysis</h4>
              <p className="text-xs text-gray-600">User behavior monitoring and risk scoring</p>
            </div>
            <div className="bg-white rounded p-3 border">
              <h4 className="font-medium text-sm mb-1">Incident Response</h4>
              <p className="text-xs text-gray-600">Automated response and escalation workflows</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}