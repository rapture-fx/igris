"use client"

import * as React from "react"
import { cn } from "@/utils/helpers"
import { X } from "lucide-react"

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Sheet Container */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-4xl">
        {children}
      </div>
    </>
  )
}

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed inset-y-0 right-0 z-50 h-full w-full border-l border-border-light bg-beige-primary shadow-lg sm:max-w-4xl",
      "flex flex-col overflow-hidden",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
SheetContent.displayName = "SheetContent"

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-b border-border-light px-6 py-4",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn("text-lg font-medium font-inter text-gray-900", className)}
    {...props}
  />
)
SheetTitle.displayName = "SheetTitle"

const SheetClose = ({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "rounded-md p-2 hover:bg-beige-secondary transition-colors",
      className
    )}
    onClick={onClick}
    {...props}
  >
    <X className="h-5 w-5 text-gray-600" />
  </button>
)
SheetClose.displayName = "SheetClose"

const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-6 py-4", className)}
    {...props}
  />
)
SheetBody.displayName = "SheetBody"

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody }
