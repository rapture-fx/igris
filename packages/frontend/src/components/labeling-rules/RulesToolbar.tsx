'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function RulesToolbar() {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold">All Rules</h2>
      <Button>
        <Plus className="w-4 h-4 mr-2" />
        New Rule
      </Button>
    </div>
  )
} 