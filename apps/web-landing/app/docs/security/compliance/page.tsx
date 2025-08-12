'use client'

import React from 'react'
import Link from 'next/link'
import { Shield, Lock, Eye, FileText, CheckCircle, AlertTriangle } from 'lucide-react'

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/docs" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to Documentation
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Security & Compliance</h1>
          <p className="text-xl text-gray-600">
            Comprehensive security framework meeting financial industry standards including PCI DSS, SOX, and regulatory audit requirements.
          </p>
        </div>

        {/* PCI DSS Compliance */}
        <section className="mb-16">
          <div className="flex items-center mb-6">
            <Shield className="h-8 w-8 text-green-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">PCI DSS Compliance</h2>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">PCI DSS Level 1 Certified</h3>
                <p className="text-green-700">
                  Schlep Engine maintains the highest level of PCI DSS compliance for processing, storing, and transmitting cardholder data. 
                  Our infrastructure is validated annually by qualified security assessors.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Protection Requirements</h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">AES-256 encryption for data at rest</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">TLS 1.3 for data in transit</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Tokenization of sensitive card data</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Key rotation every 90 days</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Multi-factor authentication (MFA)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Role-based access control (RBAC)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Least privilege principle</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Session timeout and monitoring</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">PCI DSS API Integration</h3>
            <p className="text-blue-700 mb-4">
              Our APIs are designed to minimize PCI scope for your applications. Sensitive data is processed in our certified environment without touching your infrastructure.
            </p>
            <div className="bg-blue-100 rounded p-4">
              <pre className="text-sm text-blue-800 overflow-x-auto"><code>{`# PCI-compliant fraud detection call
curl -X POST https://api.schlep-engine.com/v1/financial/fraud-detection \\
  -H "Authorization: Bearer your-pci-token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_token": "tok_encrypted_card_data",
    "amount": 2500.00,
    "merchant_id": "merch_12345"
  }'

# Response without exposing cardholder data
{
  "transaction_id": "txn_audit_789",
  "fraud_score": 0.94,
  "risk_level": "high",
  "pci_audit_id": "aud_pci_456"
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Audit Trail System */}
        <section className="mb-16">
          <div className="flex items-center mb-6">
            <Eye className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Comprehensive Audit Trails</h2>
          </div>
          
          <p className="text-gray-600 mb-8">
            Every data processing operation, model decision, and system access is logged with immutable audit trails 
            designed for regulatory compliance and forensic analysis.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <FileText className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Lineage Tracking</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Complete data transformation history</li>
                <li>• Source system identification</li>
                <li>• Processing timestamps and versions</li>
                <li>• User attribution for all changes</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <Lock className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Model Decision Logs</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• ML model version and parameters</li>
                <li>• Feature importance scores</li>
                <li>• Decision reasoning and confidence</li>
                <li>• Regulatory explanation reports</li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <Shield className="h-8 w-8 text-red-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Security Event Monitoring</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Real-time intrusion detection</li>
                <li>• Failed authentication attempts</li>
                <li>• Privilege escalation alerts</li>
                <li>• Data access pattern analysis</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Audit API Example</h3>
            <pre className="text-green-400 text-sm overflow-x-auto"><code>{`# Retrieve audit trail for specific transaction
curl -X GET https://api.schlep-engine.com/v1/audit/transaction/txn_789 \\
  -H "Authorization: Bearer your-audit-token"

{
  "transaction_id": "txn_789",
  "audit_trail": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "event": "data_ingestion",
      "source": "payment_processor",
      "user_id": "system_api",
      "data_hash": "sha256:abc123...",
      "compliance_tags": ["pci_dss", "sox"]
    },
    {
      "timestamp": "2024-01-15T14:30:01Z", 
      "event": "ml_processing",
      "model_version": "fraud_detection_v3.2.1",
      "features_used": ["amount", "location", "velocity"],
      "decision_confidence": 0.94,
      "explainability_report_id": "exp_456"
    },
    {
      "timestamp": "2024-01-15T14:30:02Z",
      "event": "regulatory_flag",
      "regulation": "pci_dss_requirement_10",
      "action": "audit_log_created",
      "retention_period": "7_years"
    }
  ]
}`}</code></pre>
          </div>
        </section>

        {/* Regulatory Compliance */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Regulatory Compliance</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">SOX Compliance (Sarbanes-Oxley)</h3>
              <ul className="space-y-2 text-blue-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                  <span>Section 302: Management certification of financial controls</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                  <span>Section 404: Internal control assessment and reporting</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                  <span>Section 409: Real-time disclosure requirements</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4">AML/BSA Compliance</h3>
              <ul className="space-y-2 text-green-700">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                  <span>Suspicious Activity Report (SAR) generation</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                  <span>Customer Due Diligence (CDD) record keeping</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                  <span>Currency Transaction Report (CTR) compliance</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Data Retention */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Retention & Recovery</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Regulatory Retention Requirements</h3>
                <p className="text-yellow-700">
                  All financial transaction data and audit logs are retained for the required regulatory periods, 
                  with secure backup and recovery procedures validated quarterly.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">7 Years</h3>
              <p className="text-gray-600">Transaction Records</p>
              <p className="text-sm text-gray-500 mt-2">PCI DSS & SOX requirements</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">5 Years</h3>
              <p className="text-gray-600">AML/BSA Records</p>
              <p className="text-sm text-gray-500 mt-2">Bank Secrecy Act compliance</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">99.99%</h3>
              <p className="text-gray-600">Data Availability SLA</p>
              <p className="text-sm text-gray-500 mt-2">Multi-region redundancy</p>
            </div>
          </div>
        </section>

        {/* Security Certifications */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Certifications & Standards</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">SOC 2 Type II</h3>
              <p className="text-sm text-gray-600">Annual compliance audit</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
              <Lock className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">ISO 27001</h3>
              <p className="text-sm text-gray-600">Information security management</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
              <FileText className="h-12 w-12 text-purple-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">NIST Framework</h3>
              <p className="text-sm text-gray-600">Cybersecurity framework compliance</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
              <Eye className="h-12 w-12 text-red-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">FFIEC Guidelines</h3>
              <p className="text-sm text-gray-600">Federal financial institution standards</p>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation & Support</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/contact" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Shield className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Compliance Consultation</h3>
              <p className="text-gray-600">Work with our compliance team to ensure your implementation meets all regulatory requirements.</p>
            </Link>
            
            <Link href="/docs/api-reference" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <FileText className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Security API Documentation</h3>
              <p className="text-gray-600">Detailed documentation for implementing secure, compliant integrations with our APIs.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}