'use client'

import React from 'react'

interface PageHeaderProps {
  title: string
  description: string
  children?: React.ReactNode
}

export const PageHeader = ({ title, description, children }: PageHeaderProps) => {
  return (
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>
      {children && <div className="flex items-center space-x-2">{children}</div>}
    </div>
  )
} 