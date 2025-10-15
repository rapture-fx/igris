import React from 'react'
import clsx from 'clsx'

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DashboardCard({ children, className, ...props }: DashboardCardProps) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      {children}
    </div>
  )
} 