'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpenIcon,
  CommandLineIcon,
  SparklesIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface NavItem {
  name: string;
  href: string;
}

interface ApiNavItem extends NavItem {
  method: string;
}

const mainSections = [
  {
    name: 'Search',
    href: '#',
    icon: MagnifyingGlassIcon,
    isMainSection: true,
    isSearch: true
  },
  {
    name: 'Documentation',
    href: '/introduction',
    icon: BookOpenIcon,
    isMainSection: true,
    groups: [
      {
        name: 'Getting Started',
        href: '/introduction',
        children: [
          { name: 'Overview', href: '/introduction' },
          { name: 'Quick Start', href: '/introduction/quickstart' },
          { name: 'Architecture Overview', href: '/concepts/architecture' },
          { name: 'Pricing & Plans', href: '/introduction/pricing' },
        ] as NavItem[]
      },
      {
        name: 'Core Concepts',
        href: '/concepts',
        children: [
          { name: 'Data Processing Pipeline', href: '/concepts/pipeline' },
          { name: 'ML Workflow', href: '/concepts/ml-workflow' },
          { name: 'Performance Benchmarks', href: '/concepts/performance' },
          { name: 'Reinforcement Learning', href: '/concepts/reinforcement-learning' },
          { name: 'ML Model Optimization', href: '/concepts/ml-optimization' },
          { name: 'Compatibility Mode', href: '/concepts/compatibility-mode' },
          { name: 'Feature Maturity Roadmap', href: '/concepts/feature-maturity-roadmap' },
        ] as NavItem[]
      },
      {
        name: 'AI Company',
        href: '/industries/ai-company',
        children: [
          { name: 'AI Company Overview', href: '/industries/ai-company' },
          { name: 'Getting Started Guide', href: '/getting-started/ai-company' },
          { name: 'MLOps Setup Tutorial', href: '/tutorials/mlops-setup' },
          { name: 'AI Company Examples', href: '/examples/ai-company' },
          { name: 'MLOps Workflow Guide', href: '/guides/mlops-workflows' },
        ] as NavItem[]
      },
      {
        name: 'Manufacturing',
        href: '/industries/manufacturing',
        children: [
          { name: 'Manufacturing Overview', href: '/industries/manufacturing' },
          { name: 'Getting Started Guide', href: '/getting-started/manufacturing' },
          { name: 'IoT Setup Tutorial', href: '/tutorials/manufacturing-iot-setup' },
          { name: 'Digital Twin Tutorial', href: '/tutorials/digital-twin-setup' },
          { name: 'Manufacturing Examples', href: '/examples/manufacturing' },
          { name: 'Manufacturing Workflows', href: '/guides/manufacturing-workflows' },
          { name: 'Data Processing', href: '/concepts/manufacturing-data-processing' },
          { name: 'Forecasting Engine', href: '/concepts/manufacturing-forecasting' },
          { name: 'Multi-Sensor Fusion', href: '/concepts/multi-sensor-fusion' },
          { name: 'Predictive Maintenance', href: '/concepts/predictive-maintenance' },
        ] as NavItem[]
      },
      {
        name: 'Financial Services',
        href: '/industries/financial-services',
        children: [
          { name: 'Financial Services Overview', href: '/industries/financial-services' },
          { name: 'Fraud Detection', href: '/use-cases/fraud-detection' },
        ] as NavItem[]
      },
      {
        name: 'E-commerce',
        href: '/industries/ecommerce',
        children: [
          { name: 'E-commerce Overview', href: '/industries/ecommerce' },
          { name: 'Dynamic Pricing with RL', href: '/use-cases/dynamic-pricing' },
          { name: 'Customer Analytics', href: '/use-cases/customer-analytics' },
        ] as NavItem[]
      },
      {
        name: 'Use Cases',
        href: '/use-cases',
        children: [
          { name: 'ML Model Training', href: '/use-cases/ml-training' },
          { name: 'Hyperparameter Optimization', href: '/use-cases/hyperparameter-optimization' },
          { name: 'Data Quality Monitoring', href: '/use-cases/quality-monitoring' },
          { name: 'Real-time Processing', href: '/use-cases/real-time-processing' },
        ] as NavItem[]
      },
      {
        name: 'Integrations',
        href: '/integrations',
        children: [
          { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
          { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
        ] as NavItem[]
      },
      {
        name: 'Security & Support',
        href: '/security',
        children: [
          { name: 'Security & Compliance', href: '/security/overview' },
          { name: 'Best Practices', href: '/guides/best-practices' },
          { name: 'Troubleshooting', href: '/guides/troubleshooting' },
        ] as NavItem[]
      },
    ],
  },
  {
    name: 'API Reference',
    href: '/api-reference',
    icon: CommandLineIcon,
    isMainSection: true,
    flatItems: [
      { name: 'Getting Started', href: '/api-reference' },
      { name: 'API Keys', href: '/api-reference/api-keys' },
      { name: 'Rate Limits', href: '/api-reference/rate-limits' },
      { name: 'Error Handling', href: '/api-reference/errors' },
      { name: 'WebSocket API', href: '/api-reference/websocket' },
    ] as NavItem[],
    groups: [
      {
        name: 'Authentication',
        href: '/api-reference/authentication',
        children: [
          { name: 'OAuth Authorization', href: '/api-reference/authentication#oauth-authorization', method: 'GET' },
          { name: 'OAuth Callback', href: '/api-reference/authentication#oauth-callback', method: 'GET' },
          { name: 'OAuth Accounts', href: '/api-reference/authentication#oauth-accounts', method: 'GET' },
          { name: 'Unlink OAuth', href: '/api-reference/authentication#unlink-oauth', method: 'DELETE' },
        ] as ApiNavItem[]
      },
      {
        name: 'Users',
        href: '/api-reference/users',
        children: [
          { name: 'Get Current User', href: '/api-reference/users#get-current-user', method: 'GET' },
          { name: 'Update Current User', href: '/api-reference/users#update-current-user', method: 'PUT' },
          { name: 'List Users', href: '/api-reference/users#list-users', method: 'GET' },
          { name: 'Get User', href: '/api-reference/users#get-user', method: 'GET' },
          { name: 'Delete User', href: '/api-reference/users#delete-user', method: 'DELETE' },
          { name: 'Activate User', href: '/api-reference/users#activate-user', method: 'POST' },
          { name: 'Deactivate User', href: '/api-reference/users#deactivate-user', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Storage',
        href: '/api-reference/storage',
        children: [
          { name: 'Upload File', href: '/api-reference/storage#upload-file', method: 'POST' },
          { name: 'List Files', href: '/api-reference/storage#list-files', method: 'GET' },
          { name: 'Get File Metadata', href: '/api-reference/storage#get-file-metadata', method: 'GET' },
          { name: 'Download File', href: '/api-reference/storage#download-file', method: 'GET' },
          { name: 'Delete File', href: '/api-reference/storage#delete-file', method: 'DELETE' },
          { name: 'Share File', href: '/api-reference/storage#share-file', method: 'POST' },
          { name: 'Get Quota', href: '/api-reference/storage#get-quota', method: 'GET' },
          { name: 'Create Folder', href: '/api-reference/storage#create-folder', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Data Processing',
        href: "/api-reference/data-processing",
        children: [
          { name: 'Create Investigation', href: '/api-reference/data-processing#create-investigation', method: 'POST' },
          { name: 'List Investigations', href: '/api-reference/data-processing#list-investigations', method: 'GET' },
          { name: 'Get Investigation', href: '/api-reference/data-processing#get-investigation', method: 'GET' },
          { name: 'Update Investigation', href: '/api-reference/data-processing#update-investigation', method: 'PUT' },
          { name: 'Delete Investigation', href: '/api-reference/data-processing#delete-investigation', method: 'DELETE' },
          { name: 'Create Job', href: '/api-reference/data-processing#create-job', method: 'POST' },
          { name: 'List Jobs', href: '/api-reference/data-processing#list-jobs', method: 'GET' },
          { name: 'Get Job', href: '/api-reference/data-processing#get-job', method: 'GET' },
          { name: 'Update Job', href: '/api-reference/data-processing#update-job', method: 'PUT' },
          { name: 'Delete Job', href: '/api-reference/data-processing#delete-job', method: 'DELETE' },
        ] as ApiNavItem[]
      },
      {
        name: 'Document Extraction',
        href: '/api-reference/document-extraction',
        children: [
          { name: 'Extract PDF Data', href: '/api-reference/document-extraction#extract-pdf-data', method: 'POST' },
          { name: 'Extract Document Data', href: '/api-reference/document-extraction#extract-document-data', method: 'POST' },
          { name: 'Extract OCR Data', href: '/api-reference/document-extraction#extract-ocr-data', method: 'POST' },
          { name: 'List Extractions', href: '/api-reference/document-extraction#list-extractions', method: 'GET' },
          { name: 'Get Extraction', href: '/api-reference/document-extraction#get-extraction', method: 'GET' },
        ] as ApiNavItem[]
      },
      {
        name: 'Financial Services',
        href: "/api-reference/financial-ai",
        children: [
          { name: 'Fraud Detection', href: '/api-reference/financial-ai#fraud-detection', method: 'POST' },
          { name: 'Credit Risk Assessment', href: '/api-reference/financial-ai#credit-risk', method: 'POST' },
          { name: 'AML Compliance Check', href: '/api-reference/financial-ai#aml-check', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'E-commerce',
        href: "/api-reference/ecommerce-ai",
        children: [
          { name: 'Product Recommendations', href: '/api-reference/ecommerce-ai#recommendations', method: 'POST' },
          { name: 'Demand Forecasting', href: '/api-reference/ecommerce-ai#demand-forecast', method: 'POST' },
          { name: 'Price Optimization', href: '/api-reference/ecommerce-ai#price-optimization', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Manufacturing Forecasting',
        href: '/api-reference/manufacturing-forecasting',
        children: [
          { name: 'Equipment Failure Prediction', href: '/api-reference/manufacturing-forecasting#equipment-failure-prediction', method: 'POST' },
          { name: 'Equipment Health Status', href: '/api-reference/manufacturing-forecasting#equipment-health-status', method: 'GET' },
          { name: 'Production Demand Forecast', href: '/api-reference/manufacturing-forecasting#production-demand-forecast', method: 'POST' },
          { name: 'Quality Trend Prediction', href: '/api-reference/manufacturing-forecasting#quality-trend-prediction', method: 'POST' },
          { name: 'Maintenance Optimization', href: '/api-reference/manufacturing-forecasting#maintenance-optimization', method: 'POST' },
          { name: 'Energy Consumption Forecast', href: '/api-reference/manufacturing-forecasting#energy-consumption-forecast', method: 'POST' },
          { name: 'Real-time Dashboard', href: '/api-reference/manufacturing-forecasting#realtime-dashboard', method: 'GET' },
          { name: 'Batch Processing', href: '/api-reference/manufacturing-forecasting#batch-processing', method: 'POST' },
        ] as ApiNavItem[] as ApiNavItem[]
      },
      {
        name: 'Manufacturing Data Processing',
        href: '/api-reference/manufacturing',
        children: [
          { name: 'Predictive Maintenance', href: '/api-reference/manufacturing#predictive-maintenance', method: 'POST' },
          { name: 'Quality Control Analysis', href: '/api-reference/manufacturing#quality-control', method: 'POST' },
          { name: 'Supply Chain Optimization', href: '/api-reference/manufacturing#supply-chain', method: 'POST' },
          { name: 'Sensor Data Processing', href: '/api-reference/manufacturing#sensor-processing', method: 'POST' },
          { name: 'Multi-Sensor Data Fusion', href: '/api-reference/manufacturing#data-fusion', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Streaming',
        href: '/api-reference/streaming',
        children: [
          { name: 'Create Connection', href: '/api-reference/streaming#create-connection', method: 'POST' },
          { name: 'WebSocket Connection', href: '/api-reference/streaming#websocket', method: 'WebSocket' },
          { name: 'List Connections', href: '/api-reference/streaming#list-connections', method: 'GET' },
        ] as ApiNavItem[]
      },

      {
        name: 'ML Pipeline',
        href: '/api-reference/ml-pipeline',
        children: [
          { name: 'Create Pipeline', href: '/api-reference/ml-pipeline#create-pipeline', method: 'POST' },
          { name: 'Get Pipeline Status', href: '/api-reference/ml-pipeline#get-status', method: 'GET' },
          { name: 'Deploy Model', href: '/api-reference/ml-pipeline#deploy-model', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Reinforcement Learning',
        href: '/api-reference/reinforcement-learning',
        children: [
          { name: 'Create RL Agent', href: '/api-reference/reinforcement-learning#create-agent', method: 'POST' },
          { name: 'Train Agent', href: '/api-reference/reinforcement-learning#train-agent', method: 'POST' },
          { name: 'Get Agent Status', href: '/api-reference/reinforcement-learning#get-status', method: 'GET' },
          { name: 'Deploy Agent', href: '/api-reference/reinforcement-learning#deploy-agent', method: 'POST' },
        ] as ApiNavItem[]
      },
      {
        name: 'Analytics',
        href: '/api-reference/analytics',
        children: [
          { name: 'Get Time Savings', href: '/api-reference/analytics#get-time-savings', method: 'GET' },
          { name: 'Get Team Productivity', href: '/api-reference/analytics#get-team-productivity', method: 'GET' },
          { name: 'Get Dashboard Summary', href: '/api-reference/analytics#get-dashboard-summary', method: 'GET' },
          { name: 'Get System Status', href: '/api-reference/analytics#get-system-status', method: 'GET' },
          { name: 'Health Check', href: '/api-reference/analytics#health-check', method: 'GET' },
          { name: 'Trigger Alert Check', href: '/api-reference/analytics#trigger-alert-check', method: 'POST' },
          { name: 'Create Webhook', href: '/api-reference/analytics#create-webhook', method: 'POST' },
          { name: 'List Webhooks', href: '/api-reference/analytics#list-webhooks', method: 'GET' },
          { name: 'Delete Webhook', href: '/api-reference/analytics#delete-webhook', method: 'DELETE' },
          { name: 'Test Webhook', href: '/api-reference/analytics#test-webhook', method: 'POST' },
          { name: 'List Webhook Events', href: '/api-reference/analytics#list-webhook-events', method: 'GET' },
          { name: 'Custom Reports', href: '/api-reference/analytics#custom-reports', method: 'POST' },
          { name: 'Performance Insights', href: '/api-reference/analytics#performance-insights', method: 'GET' },
          { name: 'Usage Patterns', href: '/api-reference/analytics#usage-patterns', method: 'GET' },
        ] as ApiNavItem[]
      },
      {
        name: 'Billing',
        href: '/api-reference/billing',
        children: [
          { name: 'Get Usage Statistics', href: '/api-reference/billing#get-usage-statistics', method: 'GET' },
          { name: 'Get Subscription Details', href: '/api-reference/billing#get-subscription-details', method: 'GET' },
          { name: 'Create Usage Record', href: '/api-reference/billing#create-usage-record', method: 'POST' },
          { name: 'Get Invoices', href: '/api-reference/billing#get-invoices', method: 'GET' },
          { name: 'Get Invoice', href: '/api-reference/billing#get-invoice', method: 'GET' },
          { name: 'Create Checkout Session', href: '/api-reference/billing#create-checkout-session', method: 'POST' },
          { name: 'Create Customer Portal Session', href: '/api-reference/billing#create-customer-portal-session', method: 'POST' },
          { name: 'Handle Webhook', href: '/api-reference/billing#handle-webhook', method: 'POST' },
          { name: 'Enterprise Billing', href: '/api-reference/billing#enterprise-billing', method: 'GET' },
          { name: 'Volume Discounts', href: '/api-reference/billing#volume-discounts', method: 'GET' },
          { name: 'Payment Methods', href: '/api-reference/billing#payment-methods', method: 'GET' },
          { name: 'Billing Alerts', href: '/api-reference/billing#billing-alerts', method: 'POST' },
        ]
      },
      {
        name: 'Integrations',
        href: '/api-reference/integrations',
        children: [
          { name: 'Connect Database', href: '/api-reference/integrations#connect-database', method: 'POST' },
          { name: 'Execute Database Query', href: '/api-reference/integrations#execute-database-query', method: 'POST' },
          { name: 'List Database Tables', href: '/api-reference/integrations#list-database-tables', method: 'GET' },
          { name: 'Connect Cloud Storage', href: '/api-reference/integrations#connect-cloud-storage', method: 'POST' },
          { name: 'Setup Webhook', href: '/api-reference/integrations#setup-webhook', method: 'POST' },
          { name: 'List Connections', href: '/api-reference/integrations#list-connections', method: 'GET' },
          { name: 'Remove Connection', href: '/api-reference/integrations#remove-connection', method: 'DELETE' },
        ]
      },
      {
        name: 'Data Quality',
        href: '/api-reference/data-quality',
        children: [
          { name: 'Assess Data Quality', href: '/api-reference/data-quality#assess-data-quality', method: 'POST' },
          { name: 'Clean Data', href: '/api-reference/data-quality#clean-data', method: 'POST' },
          { name: 'Feature Engineering', href: '/api-reference/data-quality#feature-engineering', method: 'POST' },
          { name: 'List Assessments', href: '/api-reference/data-quality#list-assessments', method: 'GET' },
          { name: 'Download Processed Data', href: '/api-reference/data-quality#download-processed-data', method: 'GET' },
        ]
      },
      {
        name: 'Data Processing Engine',
        href: '/api-reference/advanced-ai',
        children: [
          { name: 'Messy Data to ML-Ready', href: '/api-reference/advanced-ai#data-preprocessing', method: 'POST' },
          { name: 'Intelligent Analysis', href: '/api-reference/advanced-ai#intelligent-analysis', method: 'POST' },
          { name: 'Auto Insights Generation', href: '/api-reference/advanced-ai#auto-insights', method: 'POST' },
          { name: 'Predictive Analysis', href: '/api-reference/advanced-ai#predictive-analysis', method: 'POST' },
          { name: 'Feature Engineering', href: '/api-reference/advanced-ai#feature-engineering', method: 'POST' },
          { name: 'Model Optimization', href: '/api-reference/advanced-ai#model-optimization', method: 'POST' },
          { name: 'Use Case Validation', href: '/api-reference/advanced-ai#validation', method: 'POST' },
        ]
      },
      {
        name: 'Enterprise',
        href: '/api-reference/enterprise',
        children: [
          { name: 'Enterprise Configuration', href: '/api-reference/enterprise#config', method: 'GET' },
          { name: 'Organization Limits', href: '/api-reference/enterprise#limits', method: 'POST' },
          { name: 'Team Management', href: '/api-reference/enterprise#team-management', method: 'POST' },
          { name: 'Usage Analytics', href: '/api-reference/enterprise#usage-analytics', method: 'GET' },
        ]
      },
      // AI Company APIs - Priority 1
      {
        name: 'MLOps Platform',
        href: '/api-reference/mlops',
        children: [
          { name: 'Register Model', href: '/api-reference/mlops#register-model', method: 'POST' },
          { name: 'Create Experiment', href: '/api-reference/mlops#create-experiment', method: 'POST' },
          { name: 'Deploy Model', href: '/api-reference/mlops#deploy-model', method: 'POST' },
          { name: 'Get Model Performance', href: '/api-reference/mlops#get-model-performance', method: 'GET' },
          { name: 'A/B Test Model', href: '/api-reference/mlops#ab-test-model', method: 'POST' },
          { name: 'List Models', href: '/api-reference/mlops#list-models', method: 'GET' },
          { name: 'Get Experiment Status', href: '/api-reference/mlops#get-experiment-status', method: 'GET' },
        ]
      },
      {
        name: 'Enhanced Experiment Tracking',
        href: '/api-reference/experiments',
        children: [
          { name: 'Create Enhanced Experiment', href: '/api-reference/experiments#create-enhanced-experiment', method: 'POST' },
          { name: 'Log Metrics', href: '/api-reference/experiments#log-metrics', method: 'POST' },
          { name: 'Get Real-time Metrics', href: '/api-reference/experiments#get-real-time-metrics', method: 'GET' },
          { name: 'Compare Experiments', href: '/api-reference/experiments#compare-experiments', method: 'POST' },
          { name: 'Get Insights', href: '/api-reference/experiments#get-insights', method: 'GET' },
          { name: 'Share Experiment', href: '/api-reference/experiments#share-experiment', method: 'POST' },
          { name: 'Get Genealogy', href: '/api-reference/experiments#get-genealogy', method: 'GET' },
        ]
      },
      {
        name: 'Advanced Model Serving',
        href: '/api-reference/model-serving',
        children: [
          { name: 'Deploy Model for Serving', href: '/api-reference/model-serving#deploy-model-for-serving', method: 'POST' },
          { name: 'Real-time Predictions', href: '/api-reference/model-serving#real-time-predictions', method: 'POST' },
          { name: 'Batch Predictions', href: '/api-reference/model-serving#batch-predictions', method: 'POST' },
          { name: 'Get Serving Status', href: '/api-reference/model-serving#get-serving-status', method: 'GET' },
          { name: 'Scale Model', href: '/api-reference/model-serving#scale-model', method: 'POST' },
          { name: 'Get Performance Metrics', href: '/api-reference/model-serving#get-performance-metrics', method: 'GET' },
          { name: 'Canary Deployment', href: '/api-reference/model-serving#canary-deployment', method: 'POST' },
          { name: 'Rollback Deployment', href: '/api-reference/model-serving#rollback-deployment', method: 'POST' },
        ]
      },
      {
        name: 'Dataset Marketplace',
        href: '/api-reference/datasets',
        children: [
          { name: 'Catalog Dataset', href: '/api-reference/datasets#catalog-dataset', method: 'POST' },
          { name: 'Search Datasets', href: '/api-reference/datasets#search-datasets', method: 'GET' },
          { name: 'Get Quality Report', href: '/api-reference/datasets#get-quality-report', method: 'GET' },
          { name: 'Share Dataset', href: '/api-reference/datasets#share-dataset', method: 'POST' },
          { name: 'Get Usage Analytics', href: '/api-reference/datasets#get-usage-analytics', method: 'GET' },
          { name: 'Add Review', href: '/api-reference/datasets#add-review', method: 'POST' },
          { name: 'Get Recommendations', href: '/api-reference/datasets#get-recommendations', method: 'GET' },
          { name: 'Convert Format', href: '/api-reference/datasets#convert-format', method: 'POST' },
        ]
      },
      {
        name: 'Automated Retraining',
        href: '/api-reference/retraining',
        children: [
          { name: 'Create Pipeline', href: '/api-reference/retraining#create-pipeline', method: 'POST' },
          { name: 'Trigger Retraining', href: '/api-reference/retraining#trigger-retraining', method: 'POST' },
          { name: 'Get Pipeline Status', href: '/api-reference/retraining#get-pipeline-status', method: 'GET' },
          { name: 'Configure Drift Detection', href: '/api-reference/retraining#configure-drift-detection', method: 'POST' },
          { name: 'Get Drift Reports', href: '/api-reference/retraining#get-drift-reports', method: 'GET' },
          { name: 'List Jobs', href: '/api-reference/retraining#list-jobs', method: 'GET' },
          { name: 'Submit Feedback', href: '/api-reference/retraining#submit-feedback', method: 'POST' },
        ]
      },
      // Manufacturing APIs - Priority 2
      {
        name: 'Manufacturing IoT Gateway',
        href: '/api-reference/manufacturing-iot',
        children: [
          { name: 'Connect Industrial System', href: '/api-reference/manufacturing-iot#connect-industrial-system', method: 'POST' },
          { name: 'Stream Process Data', href: '/api-reference/manufacturing-iot#stream-process-data', method: 'POST' },
          { name: 'Equipment Health Status', href: '/api-reference/manufacturing-iot#equipment-health-status', method: 'GET' },
          { name: 'List Connections', href: '/api-reference/manufacturing-iot#list-connections', method: 'GET' },
          { name: 'Delete Connection', href: '/api-reference/manufacturing-iot#delete-connection', method: 'DELETE' },
          { name: 'Batch Upload', href: '/api-reference/manufacturing-iot#batch-upload', method: 'POST' },
          { name: 'Get Alerts', href: '/api-reference/manufacturing-iot#get-alerts', method: 'GET' },
          { name: 'Configure Alerts', href: '/api-reference/manufacturing-iot#configure-alerts', method: 'POST' },
        ]
      },
      {
        name: 'Manufacturing Analytics',
        href: '/api-reference/manufacturing-analytics',
        children: [
          { name: 'Stream Analytics', href: '/api-reference/manufacturing-analytics#stream-analytics', method: 'POST' },
          { name: 'Get Forecasts', href: '/api-reference/manufacturing-analytics#get-forecasts', method: 'GET' },
          { name: 'Configure SPC', href: '/api-reference/manufacturing-analytics#configure-spc', method: 'POST' },
          { name: 'Get Efficiency Metrics', href: '/api-reference/manufacturing-analytics#get-efficiency-metrics', method: 'GET' },
          { name: 'Real-time Analytics WebSocket', href: '/api-reference/manufacturing-analytics#real-time-analytics-websocket', method: 'WebSocket' },
        ]
      },
      {
        name: 'Manufacturing MES Integration',
        href: '/api-reference/manufacturing-mes',
        children: [
          { name: 'Connect MES System', href: '/api-reference/manufacturing-mes#connect-mes-system', method: 'POST' },
          { name: 'Sync Production Data', href: '/api-reference/manufacturing-mes#sync-production-data', method: 'POST' },
          { name: 'Get Production Schedule', href: '/api-reference/manufacturing-mes#get-production-schedule', method: 'GET' },
          { name: 'Optimize Production', href: '/api-reference/manufacturing-mes#optimize-production', method: 'POST' },
          { name: 'Get Work Orders', href: '/api-reference/manufacturing-mes#get-work-orders', method: 'GET' },
          { name: 'Update Work Order', href: '/api-reference/manufacturing-mes#update-work-order', method: 'POST' },
          { name: 'Get OEE Metrics', href: '/api-reference/manufacturing-mes#get-oee-metrics', method: 'GET' },
          { name: 'Report Quality Data', href: '/api-reference/manufacturing-mes#report-quality-data', method: 'POST' },
        ]
      },
      {
        name: 'Digital Twin Framework',
        href: '/api-reference/digital-twin',
        children: [
          { name: 'Create Digital Twin', href: '/api-reference/digital-twin#create-digital-twin', method: 'POST' },
          { name: 'Get Current State', href: '/api-reference/digital-twin#get-current-state', method: 'GET' },
          { name: 'Run Simulation', href: '/api-reference/digital-twin#run-simulation', method: 'POST' },
          { name: 'Get Insights', href: '/api-reference/digital-twin#get-insights', method: 'GET' },
          { name: 'Optimize Parameters', href: '/api-reference/digital-twin#optimize-parameters', method: 'POST' },
          { name: 'Get Predictions', href: '/api-reference/digital-twin#get-predictions', method: 'GET' },
          { name: 'Force Synchronization', href: '/api-reference/digital-twin#force-synchronization', method: 'POST' },
          { name: 'Real-time WebSocket', href: '/api-reference/digital-twin#real-time-websocket', method: 'WebSocket' },
        ]
      },

    ]
  },
  {
    name: 'SDKs & Libraries',
    href: '/sdks',
    icon: CodeBracketIcon,
    isMainSection: true,
    groups: [
      {
        name: 'Official SDKs',
        href: '/sdks',
        children: [
          { name: 'Python SDK', href: '/sdks/python' },
          { name: 'Node.js/TypeScript SDK', href: '/sdks/javascript' },
          { name: 'Go SDK', href: '/sdks/go' },
          { name: 'CLI Tool', href: '/sdks/cli' },
          { name: 'Java SDK', href: '/sdks/java' },
          { name: 'Rust SDK', href: '/sdks/rust' },
          { name: 'C# / .NET SDK', href: '/sdks/csharp' },
          { name: 'Ruby SDK', href: '/sdks/ruby' },
        ] as NavItem[]
      },
      {
        name: 'Code Generation',
        href: '/sdks/openapi',
        children: [
          { name: 'OpenAPI Generator', href: '/sdks/openapi' },
          { name: 'Custom Templates', href: '/sdks/templates' },
          { name: 'CI/CD Integration', href: '/sdks/cicd' },
        ] as NavItem[]
      },
      {
        name: 'Integration Guides',
        href: '/sdks/integrations',
        children: [
          { name: 'Jupyter Notebooks', href: '/integrations/jupyter' },
          { name: 'AWS SageMaker', href: '/integrations/aws-sagemaker' },
          { name: 'Production Pipelines', href: '/sdks/production' },
          { name: 'Testing & Validation', href: '/sdks/testing' },
        ] as NavItem[]
      },
    ],
  },
  {
    name: 'Changelog',
    href: '/changelog',
    icon: SparklesIcon,
    isMainSection: true,
    children: [
      { name: 'Latest Updates', href: '/changelog' },
      { name: 'Version 2.3.0', href: '/changelog/v2-3-0' },
      { name: 'Version 2.2.0', href: '/changelog/v2-2-0' },
      { name: 'Version 2.1.0', href: '/changelog/v2-1-0' },
      { name: 'Version 2.0.0', href: '/changelog/v2-0-0' },
      { name: 'Version 1.9.0', href: '/changelog/v1-9-0' },
      { name: 'Migration Guides', href: '/changelog/migration-guides' },
      { name: 'Breaking Changes', href: '/changelog/breaking-changes' },
      { name: 'Deprecation Notices', href: '/changelog/deprecations' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // Memoize the functions to avoid infinite re-renders
  const isActive = React.useCallback((href: string) => {
    return pathname === href
  }, [pathname])

  const getActiveMainSection = React.useCallback(() => {
    if (pathname.startsWith('/api-reference')) return 'API Reference'
    if (pathname.startsWith('/changelog')) return 'Changelog'
    if (pathname.startsWith('/sdks')) return 'SDKs & Libraries'
    return 'Documentation' // Default for all other documentation pages
  }, [pathname])

  // Initialize groups that should be open based on current path
  React.useEffect(() => {
    const currentSection = getActiveMainSection()
    const section = mainSections.find(s => s.name === currentSection)
    
    if (section?.groups) {
      const groupsToOpen = new Set<string>()
      
      section.groups.forEach(group => {
        // Check if current path matches any child in this group
        if (group.children?.some(child => isActive(child.href))) {
          groupsToOpen.add(group.name)
        }
      })
      
      // Only update if there are changes to avoid unnecessary re-renders
      if (groupsToOpen.size > 0) {
        setOpenGroups(prev => {
          const newOpenGroups = new Set(prev)
          groupsToOpen.forEach(group => newOpenGroups.add(group))
          return newOpenGroups
        })
      }
    }
  }, [pathname, getActiveMainSection, isActive])

  // Set the active section based on current path
  React.useEffect(() => {
    const currentSection = getActiveMainSection()
    setActiveSection(currentSection)
  }, [pathname, getActiveMainSection])


  const toggleGroup = (groupName: string) => {
    console.log('Toggling group:', groupName)
    const newOpenGroups = new Set(openGroups)
    if (newOpenGroups.has(groupName)) {
      newOpenGroups.delete(groupName)
      console.log('Closing group:', groupName)
    } else {
      newOpenGroups.add(groupName)
      console.log('Opening group:', groupName)
    }
    setOpenGroups(newOpenGroups)
  }

  const currentActiveSection = activeSection || getActiveMainSection()

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex h-screen overflow-x-hidden">
          {/* Left Column - Logo & Category Icons */}
          <div className="flex flex-col w-16 border-r border-gray-200 overflow-x-hidden" style={{ backgroundColor: '#f2f1ed' }}>
            {/* Logo at top */}
            <div className="pt-4 pb-6 px-2">
              <Link href="http://localhost:3000" className="block">
                <img
                  src="/Docs Schlep-engne.svg?t=1725657600000"
                  alt="Schlep Engine"
                  className="h-8 w-auto cursor-pointer mx-auto"
                />
              </Link>
            </div>

            {/* Category Icons */}
            <div className="flex-1 flex flex-col items-center space-y-1 py-2 overflow-y-auto overflow-x-hidden" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            {mainSections.map((section) => (
              <button
                key={section.name}
                onClick={() => {
                  if ('isSearch' in section && section.isSearch) {
                    // Trigger global search
                    const event = new CustomEvent('openGlobalSearch');
                    document.dispatchEvent(event);
                  } else {
                    setActiveSection(section.name);
                    router.push(section.href);
                  }
                }}
                className={clsx(
                  'p-2 rounded-md transition-all duration-150 group relative',
                  currentActiveSection === section.name
                    ? 'bg-schlep-active-blue text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                )}
                title={section.name}
              >
                <section.icon className="h-5 w-5 flex-shrink-0" />
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {section.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column - Navigation Content */}
        <div className="flex flex-col w-64 h-screen bg-schlep-sidebar-background border-r border-gray-200 overflow-x-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar">
            <nav className="px-4 pt-6 pb-4 space-y-0">
              {/* Section title */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 break-words">
                  {currentActiveSection}
                </h3>
              </div>

              {/* Show content for active section */}
              {mainSections
                .filter(section => section.name === currentActiveSection)
                .map(section => (
                  <div key={section.name} className="space-y-1 pt-4">
                    {/* Handle flat items first */}
                    {section.flatItems && section.flatItems.map((item) => {
                      const getMethodColor = (method?: string) => {
                        switch (method?.toUpperCase()) {
                          case 'GET': return 'bg-green-200 text-green-800'
                          case 'POST': return 'bg-blue-200 text-blue-800'
                          case 'PUT': return 'bg-orange-200 text-orange-800'
                          case 'PATCH': return 'bg-amber-200 text-amber-800'
                          case 'DELETE': return 'bg-red-200 text-red-800'
                          case 'HEAD': return 'bg-teal-200 text-teal-800'
                          case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                          default: return 'bg-gray-200 text-gray-800'
                        }
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={clsx(
                            'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                            isActive(item.href)
                              ? 'text-schlep-active-blue border-transparent font-semibold'
                              : 'text-gray-600 border-transparent'
                          )}
                        >
                          {'method' in item && item.method ? (
                            <div className="flex min-w-0 flex-1">
                              <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                <span className={clsx(
                                  'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                  getMethodColor('method' in item ? (item as ApiNavItem).method : undefined)
                                )}>
                                  {'method' in item ? (item as ApiNavItem).method : ''}
                                </span>
                              </div>
                              <div className="flex items-center min-h-6">
                                <span className={clsx(
                                  'text-sm',
                                  isActive(item.href) ? 'text-gray-900' : 'text-gray-600'
                                )}>{item.name}</span>
                              </div>
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm truncate',
                              isActive(item.href) ? 'text-schlep-active-blue' : 'text-gray-600'
                            )}>{item.name}</span>
                          )}
                        </Link>
                      )
                    })}

                    {/* Handle sections with groups (API Reference) */}
                    {section.groups ? (
                      section.groups.map((group) => (
                        <div key={group.name} className="mb-4">
                          {/* Group header with dropdown toggle */}
                          <div
                            onClick={(e) => {
                              e.preventDefault()
                              toggleGroup(group.name)
                              // Only navigate if the group has a valid href and it's not just a toggle
                              if (group.href && group.href !== '#' && !openGroups.has(group.name)) {
                                router.push(group.href)
                              }
                            }}
                            className={clsx(
                              'w-full flex items-center justify-between px-3 py-1 transition-all duration-150 nav-link cursor-pointer group',
                              isActive(group.href || '#')
                                ? 'text-schlep-active-blue'
                                : 'text-gray-600'
                            )}
                          >
                            <span className={clsx(
                              'text-sm',
                              isActive(group.href || '#') ? 'text-schlep-active-blue' : 'text-gray-600'
                            )}>{group.name}</span>
                            <ChevronRightIcon
                              className={clsx(
                                'h-4 w-4 transition-transform duration-200',
                                openGroups.has(group.name) ? 'rotate-90' : 'rotate-0',
                                {
                                  'invisible group-hover:visible': !openGroups.has(group.name)
                                },
                                isActive(group.href || '#') ? 'text-schlep-active-blue' : 'text-gray-600'
                              )}
                            />
                          </div>

                          {/* Group content */}
                          {openGroups.has(group.name) && (
                            <div className="ml-5 space-y-1 border-l border-gray-200 pl-1">
                              {group.children.map((child) => {
                                const getMethodColor = (method?: string) => {
                                  switch (method?.toUpperCase()) {
                                    case 'GET': return 'bg-green-200 text-green-800'
                                    case 'POST': return 'bg-blue-200 text-blue-800'
                                    case 'PUT': return 'bg-orange-200 text-orange-800'
                                    case 'PATCH': return 'bg-amber-200 text-amber-800'
                                    case 'DELETE': return 'bg-red-200 text-red-800'
                                    case 'HEAD': return 'bg-teal-200 text-teal-800'
                                    case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                                    default: return 'bg-gray-200 text-gray-800'
                                  }
                                }

                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={clsx(
                                      'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                                      isActive(child.href)
                                        ? 'text-schlep-active-blue border-transparent font-semibold'
                                        : 'text-gray-600 border-transparent'
                                    )}
                                  >
                                    {'method' in child && child.method ? (
                                      <div className="flex min-w-0 flex-1">
                                        <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                          <span className={clsx(
                                            'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                            getMethodColor('method' in child ? (child as ApiNavItem).method : undefined)
                                          )}>
                                            {'method' in child ? (child as ApiNavItem).method : ''}
                                          </span>
                                        </div>
                                        <div className="flex items-center min-h-6">
                                          <span className={clsx(
                                            'text-sm',
                                            isActive(child.href) ? 'text-schlep-active-blue' : 'text-gray-600'
                                          )}>{child.name}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className={clsx(
                                        'text-sm truncate',
                                        isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                                      )}>{child.name}</span>
                                    )}
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      /* Handle sections with flat children (Documentation, Changelog) */
                      section.children && section.children.map((child) => {
                      const getMethodColor = (method?: string) => {
                        switch (method?.toUpperCase()) {
                          case 'GET': return 'bg-green-200 text-green-800'
                          case 'POST': return 'bg-blue-200 text-blue-800'
                          case 'PUT': return 'bg-orange-200 text-orange-800'
                          case 'PATCH': return 'bg-amber-200 text-amber-800'
                          case 'DELETE': return 'bg-red-200 text-red-800'
                          case 'HEAD': return 'bg-teal-200 text-teal-800'
                          case 'WEBSOCKET': return 'bg-purple-200 text-purple-800'
                          default: return 'bg-gray-200 text-gray-800'
                        }
                      }

                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={clsx(
                            'w-full flex items-center px-3 py-1 rounded-lg transition-all duration-150 group border nav-link',
                            isActive(child.href)
                              ? 'text-gray-900 border-transparent font-semibold'
                              : 'text-gray-600 border-transparent'
                          )}
                        >
                          {'method' in child && child.method ? (
                            <div className="flex min-w-0 flex-1">
                              <div className="w-20 flex-shrink-0 flex items-center h-6 mr-2">
                                <span className={clsx(
                                  'px-1.5 py-0.5 text-[9px] font-medium rounded leading-none inline-block',
                                  getMethodColor('method' in child ? (child as ApiNavItem).method : undefined)
                                )}>
                                  {'method' in child ? (child as ApiNavItem).method : ''}
                                </span>
                              </div>
                              <div className="flex items-center min-h-6">
                                <span className={clsx(
                                  'text-sm',
                                  isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                                )}>{child.name}</span>
                              </div>
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm truncate',
                              isActive(child.href) ? 'text-gray-900' : 'text-gray-600'
                            )}>{child.name}</span>
                          )}
                        </Link>
                      )
                    })
                    )}
                  </div>
                ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
