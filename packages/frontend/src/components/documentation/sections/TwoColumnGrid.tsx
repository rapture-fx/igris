'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'
import { ScoreRanges } from './ScoreRanges'
import { ImprovementActions } from './ImprovementActions'

interface TwoColumnGridProps {
  leftSection: any
  rightSection: any
  onSectionChange: (sectionId: string) => void
}

export function TwoColumnGrid({ leftSection, rightSection, onSectionChange }: TwoColumnGridProps) {
  const renderGridSection = (section: any) => {
    const commonProps = {
      section,
      onSectionChange
    }

    switch (section.type) {
      case 'score-ranges':
        return <ScoreRanges {...commonProps} />
      case 'improvement-actions':
        return <ImprovementActions {...commonProps} />
      default:
        return null
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {renderGridSection(leftSection)}
      {renderGridSection(rightSection)}
    </div>
  )
} 