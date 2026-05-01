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
        className="fixed inset-0 z-50 bg-black/15"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Sheet Container */}
      <div className="fixed top-2 bottom-2 right-2 z-50">
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
      "h-full w-[520px] max-w-[calc(100vw-1rem)] border border-border bg-card shadow-xl rounded-2xl",
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
      "flex items-center justify-between px-4 py-4 relative",
      className
    )}
    {...props}
  >
    {props.children}
    <div className="absolute left-4 right-4 bottom-0 border-b border-border" />
  </div>
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn("text-lg font-medium font-inter text-foreground", className)}
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
      "rounded-md p-2 hover:bg-muted transition-colors",
      className
    )}
    onClick={onClick}
    {...props}
  >
    <X className="h-5 w-5 text-muted-foreground" />
  </button>
)
SheetClose.displayName = "SheetClose"

const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-4 py-4 scrollbar-hide", className)}
    style={{
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}
    {...props}
  />
)
SheetBody.displayName = "SheetBody"

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody }
