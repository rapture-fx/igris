'use client'

import { useState, useEffect } from 'react'
import { ContentRenderer } from './components/ContentRenderer'

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('getting-started/overview')

  return (
    <div className="bg-[#111111] min-h-screen">
      <ContentRenderer 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
    </div>
  )
}