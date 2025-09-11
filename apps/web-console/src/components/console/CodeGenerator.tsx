import React, { useState } from 'react'
import { X, Copy, Check, Code2, Terminal } from 'lucide-react'

interface CodeGeneratorProps {
  isOpen: boolean
  onClose: () => void
  requestConfig: {
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  }
}

export function CodeGenerator({ isOpen, onClose, requestConfig }: CodeGeneratorProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Code Generator</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600">Code generation coming soon...</p>
        </div>
      </div>
    </div>
  )
}