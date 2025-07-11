'use client'

import Link from 'next/link'
import { Bell, Search } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

export function Header() {
  return (
    <div className="sticky top-0 z-40 flex h-20 shrink-0 items-center gap-x-6 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center gap-x-6 px-6 lg:px-10 w-full max-w-[1600px] mx-auto">
        <Link href="/dashboard" className="flex items-center gap-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div className="font-dm-sans text-xl text-gray-800 whitespace-nowrap">
              <span className="font-bold text-blue-600">Schlep</span>
              <span className="text-gray-700">-engine</span>
            </div>
        </Link>
        
        <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
          <form className="relative flex-1 max-w-sm" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <div className="relative w-full">
              <Search
                className="pointer-events-none absolute inset-y-0 left-4 h-full w-5 text-gray-500"
                aria-hidden="true"
              />
              <input
                id="search-field"
                className="block h-full w-full border-0 bg-gray-50 rounded-full py-2.5 pl-11 pr-4 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                placeholder="Search for anything..."
                type="search"
                name="search"
              />
            </div>
          </form>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">View notifications</span>
              <Bell className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 