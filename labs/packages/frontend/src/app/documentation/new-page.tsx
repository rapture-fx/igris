'use client'

import { useState, useEffect } from 'react'
import { Footer } from '@/components/layout/Footer'
import { NavigationSidebar } from '@/components/documentation/NavigationSidebar'
import { ContentRenderer } from '@/components/documentation/ContentRenderer'
import { documentationLoader } from '@/lib/documentation-loader'
import { NavigationConfig } from '@/types/documentation'

export default function NewDocumentationPage() {
  const [navigation, setNavigation] = useState<NavigationConfig | null>(null)
  const [selectedSection, setSelectedSection] = useState('introduction')
  const [selectedLanguage, setSelectedLanguage] = useState('curl')
  const [searchQuery, setSearchQuery] = useState('')
  const [content, setContent] = useState<any>(null)
  const [codeExamples, setCodeExamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load navigation on mount
  useEffect(() => {
    const loadNavigation = async () => {
      try {
        const nav = await documentationLoader.loadNavigation()
        setNavigation(nav)
      } catch (err) {
        setError('Failed to load navigation')
        console.error(err)
      }
    }
    loadNavigation()
  }, [])

  // Load content when section changes
  useEffect(() => {
    const loadContent = async () => {
      if (!selectedSection) return
      
      setLoading(true)
      try {
        // Load content section
        const sectionContent = await documentationLoader.loadContent(selectedSection)
        setContent(sectionContent)

        // Load code examples if section has them
        const examples = await documentationLoader.loadCodeExamples(selectedSection)
        setCodeExamples(examples)

      } catch (err) {
        setError(`Failed to load content for ${selectedSection}`)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    loadContent()
  }, [selectedSection])

  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId)
    setError(null)
  }

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  if (!navigation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documentation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        navigation={navigation}
        selectedSection={selectedSection}
        searchQuery={searchQuery}
        onSectionChange={handleSectionChange}
        onSearchChange={handleSearchChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading content...</span>
              </div>
            ) : content ? (
              <ContentRenderer
                content={content}
                onSectionChange={handleSectionChange}
                onLanguageChange={handleLanguageChange}
                selectedLanguage={selectedLanguage}
                codeExamples={codeExamples}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Content not found for this section.</p>
                <p className="text-sm text-gray-500 mt-2">
                  This section may not have been extracted yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
} 