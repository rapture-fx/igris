"use client"

import * as React from "react"
import { cn } from "@/utils/helpers"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-border-light bg-beige-primary px-3 py-2 text-sm font-inter font-medium text-gray-900 shadow-sm appearance-none cursor-pointer hover:bg-beige-secondary focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
