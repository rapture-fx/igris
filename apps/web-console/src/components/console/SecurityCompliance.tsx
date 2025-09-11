'use client'

import React, { useState, useEffect } from 'react'
import { 
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  Key,
  FileText,
  Download,
  Upload,
  Scan,
  Clock,
  TrendingUp,
  Database,
  Zap,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Search,
  Filter,
  Users,
  Globe,
  Server,
  Bug
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface SecurityScan {
  id: string
  name: string
  type: 'vulnerability' | 'auth' | 'ssl' | 'headers' | 'compliance'
  status: 'running' | 'completed' | 'failed'
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  completedAt?: string
  findings: SecurityFinding[]
  target: {
    url: string
    method: string
    headers?: Record<string, string>
  }
}

interface SecurityFinding {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  recommendation: string
  evidence?: {
    request?: string
    response?: string
    payload?: string
  }
  cwe?: string
  owasp?: string
  cvss?: number
}

interface ComplianceCheck {
  id: string
  standard: 'GDPR' | 'HIPAA' | 'SOC2' | 'PCI-DSS' | 'ISO27001'
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning' | 'pending'
  lastChecked: string
  requirements: Array<{
    id: string
    title: string
    status: 'pass' | 'fail' | 'warning'
    description: string
  }>
}

interface AuthTest {
  id: string
  type: 'jwt' | 'oauth' | 'api_key' | 'basic_auth' | 'session'
  endpoint: string
  status: 'pass' | 'fail' | 'warning'
  issues: string[]
  recommendations: string[]
  lastTested: string
}

export function SecurityCompliance() {
  const [activeTab, setActiveTab] = useState<'scans' | 'compliance' | 'auth' | 'reports'>('scans')
  const [securityScans, setSecurityScans] = useState<SecurityScan[]>([])
  const [selectedScan, setSelectedScan] = useState<SecurityScan | null>(null)
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([])
  const [authTests, setAuthTests] = useState<AuthTest[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanTarget, setScanTarget] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [darkMode, setDarkMode] = useState(false)

  // Mock data initialization
  useEffect(() => {
    // Initialize with sample security scans
    const sampleScans: SecurityScan[] = [
      {
        id: 'scan_1',
        name: 'API Vulnerability Scan',
        type: 'vulnerability',
        status: 'completed',
        severity: 'high',
        createdAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:15:00Z',
        target: {
          url: 'https://api.schlep-engine.com/v1/auth/login',
          method: 'POST'
        },
        findings: [
          {
            id: 'finding_1',
            type: 'SQL Injection',
            severity: 'high',
            title: 'SQL Injection vulnerability in login endpoint',
            description: 'The login endpoint is vulnerable to SQL injection attacks through the username parameter.',
            impact: 'Attackers could potentially access unauthorized data or execute arbitrary SQL commands.',
            recommendation: 'Use parameterized queries and input validation to prevent SQL injection attacks.',
            evidence: {
              request: `POST /v1/auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "admin' OR '1'='1",
  "password": "password"
}`,
              response: `HTTP/1.1 200 OK
{
  "success": true,
  "token": "eyJ...",
  "user": { "id": 1, "username": "admin" }
}`
            },
            cwe: 'CWE-89',
            owasp: 'A03:2021 – Injection',
            cvss: 8.5
          },
          {
            id: 'finding_2',
            type: 'Weak Authentication',
            severity: 'medium',
            title: 'Weak password policy',
            description: 'The system accepts weak passwords without complexity requirements.',
            impact: 'Users may choose easily guessable passwords, making accounts vulnerable to brute force attacks.',
            recommendation: 'Implement strong password policies including minimum length, complexity requirements, and rate limiting.',
            cwe: 'CWE-521',
            owasp: 'A07:2021 – Identification and Authentication Failures',
            cvss: 6.2
          }
        ]
      },
      {
        id: 'scan_2',
        name: 'SSL/TLS Configuration Scan',
        type: 'ssl',
        status: 'completed',
        severity: 'medium',
        createdAt: '2024-01-15T11:00:00Z',
        completedAt: '2024-01-15T11:05:00Z',
        target: {
          url: 'https://api.schlep-engine.com',
          method: 'GET'
        },
        findings: [
          {
            id: 'finding_3',
            type: 'Weak Cipher Suite',
            severity: 'medium',
            title: 'Weak cipher suites enabled',
            description: 'The server supports weak cipher suites that could be exploited.',
            impact: 'Traffic could potentially be intercepted and decrypted by attackers.',
            recommendation: 'Disable weak cipher suites and use only strong, modern encryption.',
            cwe: 'CWE-327',
            owasp: 'A02:2021 – Cryptographic Failures',
            cvss: 5.3
          }
        ]
      }
    ]

    const sampleCompliance: ComplianceCheck[] = [
      {
        id: 'gdpr_1',
        standard: 'GDPR',
        title: 'Data Protection Compliance',
        description: 'General Data Protection Regulation compliance check',
        status: 'warning',
        lastChecked: '2024-01-15T09:00:00Z',
        requirements: [
          {
            id: 'gdpr_consent',
            title: 'User Consent Management',
            status: 'pass',
            description: 'System properly handles user consent for data processing'
          },
          {
            id: 'gdpr_retention',
            title: 'Data Retention Policies',
            status: 'warning',
            description: 'Data retention policies need clearer implementation'
          },
          {
            id: 'gdpr_breach',
            title: 'Breach Notification Procedures',
            status: 'pass',
            description: 'Proper procedures in place for data breach notifications'
          }
        ]
      },
      {
        id: 'soc2_1',
        standard: 'SOC2',
        title: 'SOC 2 Type II Compliance',
        description: 'Service Organization Control 2 compliance assessment',
        status: 'pass',
        lastChecked: '2024-01-15T08:00:00Z',
        requirements: [
          {
            id: 'soc2_security',
            title: 'Security Controls',
            status: 'pass',
            description: 'Adequate security controls are in place'
          },
          {
            id: 'soc2_availability',
            title: 'System Availability',
            status: 'pass',
            description: 'System meets availability requirements'
          }
        ]
      }
    ]

    const sampleAuthTests: AuthTest[] = [
      {
        id: 'auth_1',
        type: 'jwt',
        endpoint: '/api/v1/auth/verify',
        status: 'warning',
        issues: [
          'JWT tokens have long expiration times (24 hours)',
          'No token refresh mechanism implemented'
        ],
        recommendations: [
          'Reduce JWT expiration time to 1 hour',
          'Implement refresh token mechanism',
          'Add proper token revocation'
        ],
        lastTested: '2024-01-15T10:30:00Z'
      },
      {
        id: 'auth_2',
        type: 'oauth',
        endpoint: '/api/v1/oauth/authorize',
        status: 'pass',
        issues: [],
        recommendations: [
          'Consider implementing PKCE for additional security'
        ],
        lastTested: '2024-01-15T10:35:00Z'
      }
    ]

    setSecurityScans(sampleScans)
    setComplianceChecks(sampleCompliance)
    setAuthTests(sampleAuthTests)
  }, [])

  const startSecurityScan = async () => {
    if (!scanTarget) return

    setIsScanning(true)
    
    const newScan: SecurityScan = {
      id: `scan_${Date.now()}`,
      name: `Security Scan - ${new URL(scanTarget).hostname}`,
      type: 'vulnerability',
      status: 'running',
      severity: 'medium',
      createdAt: new Date().toISOString(),
      target: {
        url: scanTarget,
        method: 'GET'
      },
      findings: []
    }

    setSecurityScans(prev => [newScan, ...prev])
    setSelectedScan(newScan)

    // Simulate scan completion
    setTimeout(() => {
      const completedScan = {
        ...newScan,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        findings: [
          {
            id: `finding_${Date.now()}`,
            type: 'Security Headers',
            severity: 'medium' as const,
            title: 'Missing security headers',
            description: 'Some important security headers are missing from the response.',
            impact: 'Could allow clickjacking and other client-side attacks.',
            recommendation: 'Add X-Frame-Options, X-Content-Type-Options, and Content-Security-Policy headers.',
            cwe: 'CWE-693',
            owasp: 'A05:2021 – Security Misconfiguration',
            cvss: 5.0
          }
        ]
      }

      setSecurityScans(prev => prev.map(scan => 
        scan.id === newScan.id ? completedScan : scan
      ))
      setSelectedScan(completedScan)
      setIsScanning(false)
    }, 3000)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'fail': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'running': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      case 'pending': return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const filteredScans = securityScans.filter(scan => {
    const matchesSearch = searchQuery === '' || 
      scan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.target.url.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesSeverity = severityFilter === 'all' || scan.severity === severityFilter
    
    return matchesSearch && matchesSeverity
  })

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalScans: securityScans.length,
        criticalFindings: securityScans.flatMap(s => s.findings).filter(f => f.severity === 'critical').length,
        highFindings: securityScans.flatMap(s => s.findings).filter(f => f.severity === 'high').length,
        complianceStatus: complianceChecks.map(c => ({ standard: c.standard, status: c.status }))
      },
      scans: securityScans,
      compliance: complianceChecks,
      authentication: authTests
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `security_report_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Security & Compliance
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Security scanning, compliance checks, and vulnerability assessment
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={exportReport}
              className="flex items-center space-x-2 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { 
              label: 'Critical Issues', 
              value: securityScans.flatMap(s => s.findings).filter(f => f.severity === 'critical').length,
              color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
            },
            { 
              label: 'High Issues', 
              value: securityScans.flatMap(s => s.findings).filter(f => f.severity === 'high').length,
              color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
            },
            { 
              label: 'Total Scans', 
              value: securityScans.length,
              color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
            },
            { 
              label: 'Compliance Score', 
              value: `${Math.round(complianceChecks.filter(c => c.status === 'pass').length / complianceChecks.length * 100)}%`,
              color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
            }
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className={`px-3 py-2 rounded-lg ${color}`}>
                <div className="font-semibold">{value}</div>
                <div className="text-xs opacity-75">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'scans', label: 'Security Scans', icon: Scan },
            { key: 'compliance', label: 'Compliance', icon: FileText },
            { key: 'auth', label: 'Authentication', icon: Key },
            { key: 'reports', label: 'Reports', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'scans' && (
          <>
            {/* Scans List */}
            <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* New Scan */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      placeholder="Enter URL to scan..."
                      value={scanTarget}
                      onChange={(e) => setScanTarget(e.target.value)}
                      className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <button
                    onClick={startSecurityScan}
                    disabled={!scanTarget || isScanning}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        <span>Start Scan</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search scans..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Scans */}
              <div className="flex-1 overflow-y-auto">
                {filteredScans.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No security scans found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Start a new security scan to assess vulnerabilities
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredScans.map((scan) => (
                      <button
                        key={scan.id}
                        onClick={() => setSelectedScan(scan)}
                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedScan?.id === scan.id ? 'bg-red-50 dark:bg-red-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(scan.status)}`}>
                              {scan.status}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(scan.severity)}`}>
                              {scan.severity}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(scan.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          {scan.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">
                          {scan.target.url}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {scan.findings.length} findings
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scan Details */}
            <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col">
              {selectedScan ? (
                <>
                  {/* Scan Header */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedScan.name}
                      </h2>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(selectedScan.status)}`}>
                          {selectedScan.status}
                        </span>
                        <span className={`px-3 py-1 text-sm font-medium rounded ${getSeverityColor(selectedScan.severity)}`}>
                          {selectedScan.severity}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Target: {selectedScan.target.url}</div>
                      <div>Started: {new Date(selectedScan.createdAt).toLocaleString()}</div>
                      {selectedScan.completedAt && (
                        <div>Completed: {new Date(selectedScan.completedAt).toLocaleString()}</div>
                      )}
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Security Findings ({selectedScan.findings.length})
                    </h3>
                    
                    {selectedScan.findings.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <div className="text-gray-600 dark:text-gray-400">
                          No security issues found
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedScan.findings.map((finding) => (
                          <div key={finding.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(finding.severity)}`}>
                                  {finding.severity}
                                </span>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {finding.title}
                                </h4>
                              </div>
                              {finding.cvss && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  CVSS: {finding.cvss}
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white mb-1">Description:</div>
                                <div className="text-gray-600 dark:text-gray-400">{finding.description}</div>
                              </div>
                              
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white mb-1">Impact:</div>
                                <div className="text-gray-600 dark:text-gray-400">{finding.impact}</div>
                              </div>
                              
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white mb-1">Recommendation:</div>
                                <div className="text-gray-600 dark:text-gray-400">{finding.recommendation}</div>
                              </div>

                              {finding.evidence && (
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white mb-2">Evidence:</div>
                                  {finding.evidence.request && (
                                    <div className="mb-2">
                                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Request:</div>
                                      <SyntaxHighlighter
                                        language="http"
                                        style={darkMode ? oneDark : oneLight}
                                        customStyle={{ fontSize: '12px', margin: 0 }}
                                      >
                                        {finding.evidence.request}
                                      </SyntaxHighlighter>
                                    </div>
                                  )}
                                  {finding.evidence.response && (
                                    <div>
                                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Response:</div>
                                      <SyntaxHighlighter
                                        language="http"
                                        style={darkMode ? oneDark : oneLight}
                                        customStyle={{ fontSize: '12px', margin: 0 }}
                                      >
                                        {finding.evidence.response}
                                      </SyntaxHighlighter>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                {finding.cwe && <span>CWE: {finding.cwe}</span>}
                                {finding.owasp && <span>OWASP: {finding.owasp}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select a scan to view details
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Click on any security scan to see detailed findings
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'compliance' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Compliance Dashboard
              </h2>
              
              <div className="space-y-6">
                {complianceChecks.map((check) => (
                  <div key={check.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {check.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {check.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(check.status)}`}>
                          {check.status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Last checked: {new Date(check.lastChecked).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {check.requirements.map((req) => (
                        <div key={req.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <div className="mt-0.5">
                            {req.status === 'pass' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : req.status === 'warning' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {req.title}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {req.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Authentication Security
              </h2>
              
              <div className="space-y-6">
                {authTests.map((test) => (
                  <div key={test.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Key className="w-5 h-5 text-blue-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {test.type.toUpperCase()} Authentication
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {test.endpoint}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(test.status)}`}>
                          {test.status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(test.lastTested).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    {test.issues.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Issues Found:</h4>
                        <div className="space-y-2">
                          {test.issues.map((issue, index) => (
                            <div key={index} className="flex items-start space-x-2 text-sm">
                              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                              <span className="text-gray-600 dark:text-gray-400">{issue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {test.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recommendations:</h4>
                        <div className="space-y-2">
                          {test.recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start space-x-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                              <span className="text-gray-600 dark:text-gray-400">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Security Reports
                </h2>
                <button
                  onClick={exportReport}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Generate Report</span>
                </button>
              </div>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                  {
                    title: 'Security Score',
                    value: '85%',
                    description: 'Overall security rating',
                    icon: Shield,
                    color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                  },
                  {
                    title: 'Vulnerabilities',
                    value: securityScans.flatMap(s => s.findings).length,
                    description: 'Total findings across all scans',
                    icon: Bug,
                    color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
                  },
                  {
                    title: 'Compliance',
                    value: `${complianceChecks.filter(c => c.status === 'pass').length}/${complianceChecks.length}`,
                    description: 'Standards passed',
                    icon: FileText,
                    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                  },
                  {
                    title: 'Auth Tests',
                    value: authTests.filter(t => t.status === 'pass').length,
                    description: 'Authentication tests passed',
                    icon: Key,
                    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
                  }
                ].map(({ title, value, description, icon: Icon, color }) => (
                  <div key={title} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="w-8 h-8 text-gray-400" />
                      <div className={`px-3 py-1 rounded-lg ${color}`}>
                        <div className="text-2xl font-bold">{value}</div>
                      </div>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Security Activity
                </h3>
                <div className="space-y-3">
                  {securityScans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Scan className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {scan.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {scan.findings.length} findings • {new Date(scan.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(scan.severity)}`}>
                        {scan.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}