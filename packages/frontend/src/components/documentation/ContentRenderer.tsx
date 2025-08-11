'use client'

import React from 'react'
import { ContentRendererProps, ContentSectionItem } from '../../types/documentation'
import {
  HeroSection,
  FeaturesGrid,
  CoreFeatures,
  ApiKeyCallout,
  LanguageSelector,
  NextSteps,
  QualityScoreBreakdown,
  ScoreRanges,
  ImprovementActions,
  TwoColumnContainer,
  GovernanceHero,
  MLFrameworksGrid,
  AnomalyHero,
  AnomalyTypesGrid,
  BestPracticesCallout,
  FormatsGrid,
  PerformanceBenchmarks,
  ScalingStrategies,
  ArchitecturePatterns,
  ApiEndpoints,
  UploadLimitsCallout,
  TransformationTypesGrid,
  ExportFormatsGrid,
  JobStatusFlow,
  JobMonitoringFeatures,
  PaginationStrategies,
  PaginationParameters,
  PaginationBestPractices,
  MonitoringFeatures,
  MonitoringDashboard,
  LoggingConfiguration,
  SecurityChecklist,
  SecurityFeatures,
  SecurityConfiguration,
  TroubleshootingCategories,
  TroubleshootingDiagnostics,
  PerformanceCategories,
  PerformanceTips,
  TestingEnvironments,
  TestingStrategies,
  TestingTools,
  ErrorCategories,
  RecoveryStrategies,
  ErrorMonitoring,
  ObservabilityFeatures,
  MonitoringStack,
  ObservabilityMetrics,
  CostStrategies,
  CostMonitoring,
  CostOptimizationTechniques,
  ValidationRules,
  ValidationConfiguration,
  ValidationPatterns,
  RateLimitOverview,
  RateLimitHandling,
  RateLimitMonitoring,
  InstallationGuide,
  SDKFeatures,
  WebhookEvents,
  WebhookConfiguration,
  APIBaseInfo,
  APIDetailsGrid
} from './sections'

export function ContentRenderer({ 
  content, 
  onSectionChange, 
  onLanguageChange,
  selectedLanguage = 'curl',
  codeExamples = []
}: ContentRendererProps) {
  
  const renderSection = (section: ContentSectionItem) => {
    const commonProps = {
      section,
      onSectionChange,
      onLanguageChange,
      selectedLanguage,
      codeExamples
    }

    switch (section.type) {
      case 'hero':
        return <HeroSection {...commonProps} />
      case 'features-grid':
        return <FeaturesGrid {...commonProps} />
      case 'core-features':
        return <CoreFeatures {...commonProps} />
      case 'api-key-callout':
        return <ApiKeyCallout {...commonProps} />
      case 'language-selector':
        return <LanguageSelector {...commonProps} />
      case 'next-steps':
        return <NextSteps {...commonProps} />
      case 'quality-score-breakdown':
        return <QualityScoreBreakdown {...commonProps} />
      case 'score-ranges':
        return <ScoreRanges {...commonProps} />
      case 'improvement-actions':
        return <ImprovementActions {...commonProps} />
      case 'two-column-container':
        return <TwoColumnContainer {...commonProps} />
      case 'governance-hero':
        return <GovernanceHero {...commonProps} />
      case 'ml-frameworks-grid':
        return <MLFrameworksGrid {...commonProps} />
      case 'anomaly-hero':
        return <AnomalyHero {...commonProps} />
      case 'anomaly-types-grid':
        return <AnomalyTypesGrid {...commonProps} />
      case 'best-practices-callout':
        return <BestPracticesCallout {...commonProps} />
      case 'formats-grid':
        return <FormatsGrid {...commonProps} />
      case 'performance-benchmarks':
        return <PerformanceBenchmarks {...commonProps} />
      case 'scaling-strategies':
        return <ScalingStrategies {...commonProps} />
      case 'architecture-patterns':
        return <ArchitecturePatterns {...commonProps} />
      case 'api-endpoints':
        return <ApiEndpoints {...commonProps} />
      case 'upload-limits-callout':
        return <UploadLimitsCallout {...commonProps} />
      case 'transformation-types':
        return <TransformationTypesGrid {...commonProps} />
      case 'export-formats':
        return <ExportFormatsGrid {...commonProps} />
      case 'job-status-flow':
        return <JobStatusFlow {...commonProps} />
      case 'job-monitoring-features':
        return <JobMonitoringFeatures {...commonProps} />
      case 'pagination-strategies':
        return <PaginationStrategies {...commonProps} />
      case 'pagination-parameters':
        return <PaginationParameters {...commonProps} />
      case 'pagination-best-practices':
        return <PaginationBestPractices {...commonProps} />
      case 'monitoring-features':
        return <MonitoringFeatures {...commonProps} />
      case 'monitoring-dashboard':
        return <MonitoringDashboard {...commonProps} />
      case 'logging-configuration':
        return <LoggingConfiguration {...commonProps} />
      case 'security-checklist':
        return <SecurityChecklist {...commonProps} />
      case 'security-features':
        return <SecurityFeatures {...commonProps} />
      case 'security-configuration':
        return <SecurityConfiguration {...commonProps} />
      case 'troubleshooting-categories':
        return <TroubleshootingCategories {...commonProps} />
      case 'troubleshooting-diagnostics':
        return <TroubleshootingDiagnostics {...commonProps} />
      case 'performance-categories':
        return <PerformanceCategories {...commonProps} />
      case 'performance-tips':
        return <PerformanceTips {...commonProps} />
      case 'testing-environments':
        return <TestingEnvironments testingEnvironments={section.testingEnvironments || []} />
      case 'testing-strategies':
        return <TestingStrategies testingStrategies={section.testingStrategies || []} />
      case 'testing-tools':
        return <TestingTools testingTools={section.testingTools || []} />
      case 'error-categories':
        return <ErrorCategories errorCategories={section.errorCategories || []} />
      case 'recovery-strategies':
        return <RecoveryStrategies recoveryStrategies={section.recoveryStrategies || []} />
      case 'error-monitoring':
        return <ErrorMonitoring errorMonitoring={section.errorMonitoring || []} />
      case 'observability-features':
        return <ObservabilityFeatures observabilityFeatures={section.observabilityFeatures || []} />
      case 'monitoring-stack':
        return <MonitoringStack monitoringStack={section.monitoringStack || []} />
      case 'observability-metrics':
        return <ObservabilityMetrics observabilityMetrics={section.observabilityMetrics || []} />
      case 'cost-strategies':
        return <CostStrategies costStrategies={section.costStrategies || []} />
      case 'cost-monitoring':
        return <CostMonitoring costMonitoring={section.costMonitoring || []} />
      case 'cost-optimization-techniques':
        return <CostOptimizationTechniques costOptimizationTechniques={section.costOptimizationTechniques || []} />
      case 'validation-rules':
        return <ValidationRules validationRules={section.validationRules || []} />
      case 'validation-configuration':
        return <ValidationConfiguration validationConfiguration={section.validationConfiguration || []} />
      case 'validation-patterns':
        return <ValidationPatterns validationPatterns={section.validationPatterns || []} />
      case 'rate-limit-overview':
        return <RateLimitOverview rateLimits={section.rateLimits || []} />
      case 'rate-limit-handling':
        return <RateLimitHandling handlingStrategies={section.handlingStrategies || []} />
      case 'rate-limit-monitoring':
        return <RateLimitMonitoring monitoringTools={section.monitoringTools || []} />
      case 'installation-guide':
        return <InstallationGuide {...commonProps} />
      case 'sdk-features':
        return <SDKFeatures {...commonProps} />
      case 'webhook-events':
        return <WebhookEvents {...commonProps} />
      case 'webhook-configuration':
        return <WebhookConfiguration {...commonProps} />
      case 'api-base-info':
        return <APIBaseInfo {...commonProps} />
      case 'api-details-grid':
        return <APIDetailsGrid {...commonProps} />
      default:
        console.warn(`Unknown section type: ${section.type}`)
        return null
    }
  }

  return (
    <div className="max-w-4xl">
      <ContentHeader 
        title={content.title}
        subtitle={content.subtitle}
      />

      <div className="space-y-6">
        {content.sections.map((section, index) => (
          <div key={`${section.type}-${index}`}>
            {renderSection(section)}
          </div>
        ))}
      </div>
    </div>
  )
}

interface ContentHeaderProps {
  title: string
  subtitle?: string
}

function ContentHeader({ title, subtitle }: ContentHeaderProps) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {subtitle}
        </p>
      )}
    </div>
  )
}