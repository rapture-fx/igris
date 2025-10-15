'use client'

import React, { useState } from 'react'
import { X, Settings, Toggle, Eye, EyeOff, Palette, Monitor, Moon, Sun } from 'lucide-react'

interface SimpleConsoleSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function SimpleConsoleSettings({ isOpen, onClose }: SimpleConsoleSettingsProps) {
  const [showBetaEndpoints, setShowBetaEndpoints] = useState(true)
  const [showDeprecatedEndpoints, setShowDeprecatedEndpoints] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [compactView, setCompactView] = useState(false)
  const [showIndustryBadges, setShowIndustryBadges] = useState(true)
  const [autoRefreshTokens, setAutoRefreshTokens] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Console Settings
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Customize your API console experience
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Display Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Display Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show Beta Endpoints
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display endpoints marked as beta or experimental
                  </p>
                </div>
                <button
                  onClick={() => setShowBetaEndpoints(!showBetaEndpoints)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showBetaEndpoints 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showBetaEndpoints ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show Deprecated Endpoints
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display endpoints that are deprecated
                  </p>
                </div>
                <button
                  onClick={() => setShowDeprecatedEndpoints(!showDeprecatedEndpoints)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showDeprecatedEndpoints 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showDeprecatedEndpoints ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show Industry Badges
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display industry tags on endpoints
                  </p>
                </div>
                <button
                  onClick={() => setShowIndustryBadges(!showIndustryBadges)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showIndustryBadges 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showIndustryBadges ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Compact View
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Use more compact spacing in the interface
                  </p>
                </div>
                <button
                  onClick={() => setCompactView(!compactView)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    compactView 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      compactView ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Palette className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Theme Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Dark Mode
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Use dark theme for the console
                  </p>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Authentication Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <Monitor className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Authentication Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto-refresh JWT Tokens
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Automatically refresh tokens before expiry
                  </p>
                </div>
                <button
                  onClick={() => setAutoRefreshTokens(!autoRefreshTokens)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoRefreshTokens 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefreshTokens ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Console Information */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              Console Information
            </h4>
            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-400">
              <div className="flex justify-between">
                <span>Version:</span>
                <span>2.1.0</span>
              </div>
              <div className="flex justify-between">
                <span>Build:</span>
                <span>Unified Console</span>
              </div>
              <div className="flex justify-between">
                <span>API Endpoints:</span>
                <span>45+ endpoints</span>
              </div>
              <div className="flex justify-between">
                <span>Industries:</span>
                <span>AI, Manufacturing, E-commerce, FinTech</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Settings are saved automatically
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}