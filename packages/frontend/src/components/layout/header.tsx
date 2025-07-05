'use client'

import { Bell, Search, PanelRightOpen } from 'lucide-react'

export function Header({ onToggleRightPanel }: { onToggleRightPanel: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-6 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
        <form className="relative flex-1 max-w-sm" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
            onClick={onToggleRightPanel}
          >
            <span className="sr-only">Toggle activity feed</span>
            <PanelRightOpen className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
} 