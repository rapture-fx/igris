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
  ArchitecturePatterns
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