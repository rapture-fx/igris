'use client'

import React from 'react'
import { X, Settings, Zap, Eye, EyeOff, Star, Layers, Brain } from 'lucide-react'
import { useConsolePreferences } from '../../contexts/ConsolePreferencesContext'

interface ConsoleSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function ConsoleSettings({ isOpen, onClose }: ConsoleSettingsProps) {
  const { preferences, updatePreferences } = useConsolePreferences()

  if (!isOpen) return null

  const verticalOptions = [
    { id: 'ai', name: 'Core AI & ML', description: 'Model training, inference, MLOps', icon: <Brain className="w-4 h-4" />, locked: true },
    { id: 'manufacturing', name: 'Manufacturing AI', description: 'Predictive maintenance, IoT analytics', icon: <Settings className="w-4 h-4" /> },
    { id: 'ecommerce', name: 'E-commerce AI', description: 'Recommendations, demand forecasting', icon: <Star className="w-4 h-4" /> },
    { id: 'data-processing', name: 'Data Processing', description: 'ETL, transformation, validation', icon: <Layers className="w-4 h-4" /> },
    { id: 'document-extraction', name: 'Document Processing', description: 'PDF extraction, OCR, parsing', icon: <Eye className="w-4 h-4" /> },
    { id: 'analytics', name: 'Analytics & Monitoring', description: 'Usage metrics, performance tracking', icon: <Zap className="w-4 h-4" /> },
    { id: 'fintech', name: 'Financial Services', description: 'Fraud detection, risk assessment', icon: <Settings className="w-4 h-4" /> },
    { id: 'security', name: 'Security & Compliance', description: 'Audit logs, compliance reports', icon: <EyeOff className="w-4 h-4" /> }
  ]

  const toggleVertical = (verticalId: string) => {
    if (verticalId === 'ai') return // AI is always enabled
    
    const isEnabled = preferences.enabled_verticals.includes(verticalId)
    const newEnabledVerticals = isEnabled
      ? preferences.enabled_verticals.filter(id => id !== verticalId)
      : [...preferences.enabled_verticals, verticalId]
    
    updatePreferences({ enabled_verticals: newEnabledVerticals })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Console Settings
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize your AI console experience
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Interface Mode */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Interface Complexity
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="interface_mode"
                  value="simple"
                  checked={preferences.interface_mode === 'simple'}
                  onChange={() => updatePreferences({ interface_mode: 'simple' })}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Simple Mode</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Clean interface focusing on core AI capabilities
                  </div>
                </div>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="interface_mode"
                  value="advanced"
                  checked={preferences.interface_mode === 'advanced'}
                  onChange={() => updatePreferences({ interface_mode: 'advanced' })}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Advanced Mode</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Full access to all features and cross-vertical capabilities
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Available Verticals */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Available API Categories
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enable additional API categories to expand your console capabilities. AI Core is always available.
            </p>
            <div className="space-y-3">
              {verticalOptions.map((vertical) => {
                const isEnabled = preferences.enabled_verticals.includes(vertical.id)
                const isLocked = vertical.locked
                
                return (
                  <div
                    key={vertical.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isEnabled 
                        ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isEnabled 
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {vertical.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {vertical.name}
                          {isLocked && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Always On
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {vertical.description}
                        </div>
                      </div>
                    </div>
                    
                    {!isLocked && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => toggleVertical(vertical.id)}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors ${
                          isEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Display Options */}
          <div className="p-6">
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Display Options
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Cross-vertical Suggestions
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Show suggestions for related APIs from other verticals
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.show_cross_vertical_suggestions}
                  onChange={(e) => updatePreferences({ show_cross_vertical_suggestions: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Group by Use Case
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Organize APIs by use case rather than technical category
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.group_by_use_case}
                  onChange={(e) => updatePreferences({ group_by_use_case: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Show Beta Features
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Include experimental and beta endpoints
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.show_beta_endpoints}
                  onChange={(e) => updatePreferences({ show_beta_endpoints: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Show Deprecated Endpoints
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Display deprecated endpoints (not recommended)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.show_deprecated_endpoints}
                  onChange={(e) => updatePreferences({ show_deprecated_endpoints: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}