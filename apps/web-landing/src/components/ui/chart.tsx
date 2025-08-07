"use client"

import * as React from "react"
import { ResponsiveContainer, Tooltip, Legend } from "recharts"

const cn = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// ChartConfig type definition
export type ChartConfig = {
  [k: string]: {
    label?: React.ReactNode
    color?: string
  }
}

// Chart Context
const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

const useChart = () => {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

// ChartContainer component
interface ChartContainerProps {
  config: ChartConfig
  children: React.ReactNode
  className?: string
  width?: string | number
  height?: string | number
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, width = "100%", height = 250, ...props }, ref) => (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        className={cn(
          "flex h-[250px] w-full items-center justify-center",
          className
        )}
        {...props}
      >
        <ResponsiveContainer width={width} height={height}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
)
ChartContainer.displayName = "ChartContainer"

// ChartTooltip component
interface ChartTooltipProps {
  labelFormatter?: (value: any, payload?: any) => React.ReactNode
  formatter?: (value: any, name?: any, props?: any) => React.ReactNode
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  nameKey?: string
  labelKey?: string
  cursor?: boolean | any
  content?: React.ReactElement | any
  [key: string]: any
}

const ChartTooltip = ({ 
  labelFormatter, 
  formatter, 
  nameKey,
  labelKey,
  ...props 
}: ChartTooltipProps) => {
  const { config } = useChart()

  return (
    <Tooltip
      labelFormatter={labelFormatter ? (value: any, payload: any) => {
        return labelFormatter(value, payload)
      } : undefined}
      formatter={formatter ? (value: any, name: any, props: any) => {
        return formatter(value, name, props)
      } : undefined}
      {...props}
    />
  )
}
ChartTooltip.displayName = "ChartTooltip"

// ChartTooltipContent component (simplified)
const ChartTooltipContent = ({ 
  labelFormatter,
  indicator = "dot",
  ...props 
}: {
  labelFormatter?: (value: any) => React.ReactNode
  indicator?: "line" | "dot" | "dashed"
}) => {
  return <div {...props} />
}
ChartTooltipContent.displayName = "ChartTooltipContent"

// ChartLegend component
interface ChartLegendProps {
  nameKey?: string
  content?: React.ReactElement | any
  [key: string]: any
}

const ChartLegend = ({ nameKey, ...props }: ChartLegendProps) => {
  const { config } = useChart()

  return (
    <Legend
      formatter={(value: any) => {
        if (nameKey) {
          return config[nameKey]?.label || value
        }
        return config[value]?.label || value
      }}
      {...props}
    />
  )
}
ChartLegend.displayName = "ChartLegend"

// ChartLegendContent component (simplified)
const ChartLegendContent = (props: any) => {
  return <div {...props} />
}
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
}