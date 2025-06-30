'use client'

import React from 'react'
import { SectionComponentProps } from '../../../types/documentation'
import { ScoreRanges } from './ScoreRanges'
import { ImprovementActions } from './ImprovementActions'

export function TwoColumnContainer({ section, onSectionChange }: Pick<SectionComponentProps, 'section' | 'onSectionChange'>) {
  const renderNestedSection = (nestedSection: any) => {
    const commonProps = {
      section: nestedSection,
      onSectionChange
    }

    switch (nestedSection.type) {
      case 'score-ranges':
        return <ScoreRanges {...commonProps} />
      case 'improvement-actions':
        return <ImprovementActions {...commonProps} />
      default:
        console.warn(`Unknown nested section type: ${nestedSection.type}`)
        return null
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {section.sections?.map((nestedSection: any, index: number) => (
        <div key={`${nestedSection.type}-${index}`}>
          {renderNestedSection(nestedSection)}
        </div>
      ))}
    </div>
  )
} 