"use client"

import * as React from "react"
import { cn } from "@/utils/helpers"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    // Apply beige background to option elements
    const styledChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === 'option') {
        return React.cloneElement(child as React.ReactElement<any>, {
          style: { backgroundColor: '#f2f1ed', color: '#111827' }
        });
      }
      return child;
    });

    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-border-light bg-beige-primary px-3 py-2 text-sm font-inter font-medium text-gray-900 shadow-sm appearance-none cursor-pointer hover:bg-beige-secondary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "[&>option]:bg-beige-primary [&>option]:text-gray-900 [&>option]:py-2",
            className
          )}
          ref={ref}
          {...props}
        >
          {styledChildren}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
