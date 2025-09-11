'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  Shield,
  Settings,
  CheckCircle,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  HelpCircle,
  Bell
} from 'lucide-react'
import { SecurityCompliance } from '../../src/components/console/SecurityCompliance'

const SecurityHeader = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Navigation */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Console</span>
            </Link>
            
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Security & Compliance Console
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Comprehensive security testing and compliance management
                </p>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status indicator */}
        <div className="mt-4 flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-600 dark:text-gray-400">Security monitoring active</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">All compliance checks passing</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function SecurityPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SecurityHeader />
      
      <main className={`${isFullscreen ? 'fixed inset-0 top-16 z-40' : ''}`}>
        <div className="h-full">
          <SecurityCompliance />
        </div>
        
        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="fixed bottom-6 right-6 p-3 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors z-50"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </main>
    </div>
  )
}