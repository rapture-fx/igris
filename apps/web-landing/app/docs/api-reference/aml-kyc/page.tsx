'use client'

import React from 'react'
import Link from 'next/link'
import { Shield, FileText, Eye, AlertTriangle, CheckCircle } from 'lucide-react'

export default function AMLKYCPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/docs/api-reference" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            ← Back to API Reference
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AML/KYC Data Processing</h1>
          <p className="text-xl text-gray-600">
            Anti-Money Laundering and Know Your Customer data enrichment with comprehensive audit trails and regulatory compliance features.
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
          <p className="text-gray-600 mb-6">
            Schlep Engine's AML/KYC processing capabilities are designed to meet stringent regulatory requirements while 
            providing the data quality and audit trails necessary for financial compliance programs.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Regulatory Compliance</h3>
            <ul className="list-disc list-inside text-blue-800 space-y-2">
              <li>Bank Secrecy Act (BSA) reporting requirements</li>
              <li>FinCEN Customer Due Diligence (CDD) rules</li>
              <li>FATF (Financial Action Task Force) guidelines</li>
              <li>Comprehensive audit trail generation</li>
            </ul>
          </div>
        </section>

        {/* AML Transaction Monitoring */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">AML Transaction Monitoring</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/financial/aml-screening</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Process transaction data for AML compliance monitoring with automatic suspicious activity detection 
              and regulatory reporting preparation.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "transaction_data": {
    "transaction_id": "txn_aml_001",
    "customer_id": "cust_12345",
    "amount": 15000.00,
    "currency": "USD",
    "transaction_type": "wire_transfer",
    "timestamp": "2024-01-15T14:30:00Z",
    "originator": {
      "name": "John Smith",
      "account": "1234567890",
      "bank": "First National Bank",
      "routing": "021000021"
    },
    "beneficiary": {
      "name": "Global Trading LLC",
      "account": "9876543210", 
      "bank": "International Bank",
      "swift": "INTLUS33"
    }
  },
  "customer_profile": {
    "risk_rating": "medium",
    "occupation": "business_owner",
    "expected_activity": "monthly_wire_transfers",
    "source_of_funds": "business_income",
    "geographic_exposure": ["US", "Canada"]
  },
  "screening_options": {
    "sanctions_screening": true,
    "pep_screening": true,
    "adverse_media_check": true,
    "transaction_monitoring": true,
    "generate_sar_if_suspicious": true
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "screening_id": "aml_screen_789",
  "transaction_id": "txn_aml_001",
  "risk_assessment": {
    "overall_risk_score": 0.73,
    "risk_level": "medium_high",
    "requires_review": true,
    "sar_recommendation": false
  },
  "screening_results": {
    "sanctions_screening": {
      "status": "clear",
      "lists_checked": ["OFAC_SDN", "EU_Sanctions", "UN_Sanctions"],
      "matches_found": 0
    },
    "pep_screening": {
      "status": "potential_match",
      "confidence": 0.34,
      "matches": [
        {
          "name": "John Smith Jr.",
          "position": "City Council Member",
          "jurisdiction": "Texas, USA",
          "match_confidence": 0.34
        }
      ]
    },
    "adverse_media": {
      "status": "clear",
      "sources_checked": 347,
      "relevant_articles": 0
    }
  },
  "transaction_monitoring": {
    "velocity_analysis": {
      "daily_volume": 15000.00,
      "monthly_volume": 45000.00,
      "deviation_from_profile": 0.23
    },
    "pattern_analysis": {
      "structuring_indicator": false,
      "unusual_pattern": false,
      "cross_border_frequency": "normal"
    }
  },
  "audit_trail": {
    "screening_timestamp": "2024-01-15T14:30:15Z",
    "data_sources": ["internal_records", "sanctions_db", "pep_db"],
    "processing_time_ms": 2847,
    "compliance_officer": "system_automated",
    "retention_period": "7_years"
  },
  "next_actions": {
    "immediate": "manual_review_recommended",
    "follow_up": "enhanced_due_diligence",
    "documentation": "update_customer_risk_profile"
  }
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Customer Due Diligence */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Enhanced Customer Due Diligence (CDD)</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                POST
              </span>
              <code className="text-lg font-mono text-gray-800">/v1/financial/enhanced-cdd</code>
            </div>
            
            <p className="text-gray-600 mb-4">
              Perform comprehensive customer due diligence data enrichment with multi-source verification 
              and risk assessment for regulatory compliance.
            </p>
            
            <h4 className="font-semibold text-gray-900 mb-2">Request Body</h4>
            <div className="bg-gray-900 rounded p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "customer_data": {
    "customer_id": "cust_cdd_001",
    "personal_info": {
      "full_name": "Maria Rodriguez",
      "date_of_birth": "1985-03-15",
      "ssn": "***-**-****",
      "address": {
        "street": "123 Main Street",
        "city": "Miami",
        "state": "FL",
        "zip": "33101",
        "country": "US"
      }
    },
    "business_info": {
      "company_name": "Rodriguez Imports LLC",
      "ein": "**-*******",
      "business_type": "import_export",
      "incorporation_state": "FL",
      "annual_revenue": 2500000
    }
  },
  "verification_requirements": {
    "identity_verification": true,
    "address_verification": true,
    "business_verification": true,
    "beneficial_ownership": true,
    "source_of_funds": true
  },
  "risk_factors": {
    "high_risk_geography": true,
    "cash_intensive_business": false,
    "international_exposure": true,
    "regulatory_history": false
  }
}`}</code></pre>
            </div>
            
            <h4 className="font-semibold text-gray-900 mb-2">Response</h4>
            <div className="bg-gray-900 rounded p-4">
              <pre className="text-green-400 text-sm overflow-x-auto"><code>{`{
  "cdd_id": "cdd_enhanced_456",
  "customer_id": "cust_cdd_001",
  "verification_results": {
    "identity_verification": {
      "status": "verified",
      "confidence": 0.94,
      "sources": ["credit_bureau", "public_records"],
      "document_verification": "passed"
    },
    "address_verification": {
      "status": "verified", 
      "confidence": 0.89,
      "sources": ["postal_service", "utility_records"],
      "residence_duration": "4_years"
    },
    "business_verification": {
      "status": "verified",
      "secretary_of_state": "active_good_standing",
      "business_license": "valid",
      "tax_id_verification": "confirmed"
    }
  },
  "risk_assessment": {
    "overall_risk_rating": "medium",
    "risk_score": 0.67,
    "risk_factors": {
      "geographic_risk": 0.75,
      "business_type_risk": 0.45,
      "transaction_pattern_risk": 0.33,
      "relationship_risk": 0.22
    }
  },
  "beneficial_ownership": {
    "ownership_structure_verified": true,
    "ultimate_beneficial_owners": [
      {
        "name": "Maria Rodriguez",
        "ownership_percentage": 85.0,
        "control_type": "direct_ownership",
        "pep_status": false
      },
      {
        "name": "Carlos Rodriguez", 
        "ownership_percentage": 15.0,
        "control_type": "indirect_ownership",
        "pep_status": false
      }
    ]
  },
  "compliance_documentation": {
    "cdd_completion_date": "2024-01-15T14:45:30Z",
    "next_review_date": "2025-01-15T00:00:00Z",
    "documentation_complete": true,
    "regulatory_requirements_met": ["cdd_rule", "beneficial_ownership"],
    "audit_trail_id": "audit_cdd_789"
  }
}`}</code></pre>
            </div>
          </div>
        </section>

        {/* Data Lineage & Audit */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Lineage & Audit Capabilities</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-blue-50 rounded-lg p-6">
              <FileText className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Complete Data Lineage</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Source system identification and timestamps</li>
                <li>• Data transformation history and versions</li>
                <li>• Processing methodology documentation</li>
                <li>• Quality score calculation details</li>
              </ul>
            </div>
            
            <div className="bg-green-50 rounded-lg p-6">
              <Shield className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Regulatory Audit Trails</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Immutable processing logs with checksums</li>
                <li>• User attribution for all data access</li>
                <li>• Regulatory requirement mapping</li>
                <li>• 7-year retention with secure archival</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Audit Trail Retrieval</h3>
            <pre className="text-green-400 text-sm overflow-x-auto"><code>{`# Retrieve complete audit trail for regulatory review
curl -X GET https://api.schlep-engine.com/v1/audit/aml/cdd_enhanced_456 \\
  -H "Authorization: Bearer regulatory-audit-token"

{
  "audit_id": "audit_cdd_789",
  "subject_type": "enhanced_cdd",
  "subject_id": "cdd_enhanced_456",
  "audit_timeline": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "event": "cdd_initiated",
      "user": "compliance_officer_001",
      "system": "aml_platform",
      "data_sources": ["customer_onboarding", "external_verification"],
      "regulatory_basis": "31_cfr_1020.220"
    },
    {
      "timestamp": "2024-01-15T14:32:15Z",
      "event": "identity_verification_completed",
      "verification_methods": ["document_analysis", "biometric_check"],
      "confidence_score": 0.94,
      "risk_indicators": ["none_detected"]
    },
    {
      "timestamp": "2024-01-15T14:35:42Z",
      "event": "beneficial_ownership_analysis",
      "ownership_threshold": "25_percent",
      "verification_status": "complete",
      "pep_screening_results": "no_matches"
    }
  ],
  "data_lineage": {
    "source_systems": [
      {
        "system": "core_banking",
        "data_types": ["account_info", "transaction_history"],
        "extraction_method": "api_pull",
        "data_quality_score": 0.97
      },
      {
        "system": "third_party_verification",
        "data_types": ["identity_verification", "address_verification"],
        "api_version": "v2.1",
        "response_time_ms": 1247
      }
    ],
    "processing_steps": [
      {
        "step": "data_standardization",
        "method": "address_normalization",
        "confidence": 0.89
      },
      {
        "step": "risk_scoring",
        "model_version": "risk_model_v3.1.2",
        "features_used": ["geography", "business_type", "transaction_patterns"]
      }
    ]
  },
  "regulatory_compliance": {
    "requirements_met": [
      "customer_identification_program",
      "customer_due_diligence",
      "beneficial_ownership_requirements"
    ],
    "documentation_retention": "7_years",
    "next_review_required": "2025-01-15T00:00:00Z"
  }
}`}</code></pre>
          </div>
        </section>

        {/* Compliance Features */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Regulatory Compliance Features</h2>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Regulatory Requirements Coverage</h3>
                <p className="text-yellow-700">
                  Our AML/KYC processing meets all major regulatory requirements with built-in compliance 
                  reporting and audit trail generation for seamless regulatory examinations.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">BSA/AML Compliance</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Suspicious Activity Report (SAR) generation</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Currency Transaction Report (CTR) monitoring</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Customer identification program (CIP)</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Requirements</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Enhanced due diligence (EDD)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Beneficial ownership identification</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Ongoing monitoring and review</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit & Reporting</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Complete audit trail generation</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Regulatory examination support</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Automated compliance reporting</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Implementation Support</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/contact" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <Shield className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AML/KYC Consultation</h3>
              <p className="text-gray-600">Work with our compliance experts to implement AML/KYC processing that meets your specific regulatory requirements.</p>
            </Link>
            
            <Link href="/docs/security/compliance" className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <FileText className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Security & Compliance Guide</h3>
              <p className="text-gray-600">Comprehensive documentation covering PCI DSS, audit trails, and regulatory compliance features.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}