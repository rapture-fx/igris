'use client'

export default function GridBackground() {
  return (
    <div className="relative w-full h-24 sm:h-32 md:h-40 lg:h-48 overflow-hidden bg-[#161616]">
      {/* Base grid pattern - very subtle */}
      <div 
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(10, 47, 79, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10, 47, 79, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          maskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `,
          WebkitMaskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `
        }}
      />
      
      {/* Medium screen grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] hidden sm:block"
        style={{
          backgroundImage: `
            linear-gradient(rgba(10, 47, 79, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10, 47, 79, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `,
          WebkitMaskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `
        }}
      />
      
      {/* Large screen grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] hidden lg:block"
        style={{
          backgroundImage: `
            linear-gradient(rgba(10, 47, 79, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(10, 47, 79, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `,
          WebkitMaskImage: `
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.4) 10%, 
              rgba(0,0,0,1) 25%, 
              rgba(0,0,0,0.8) 45%, 
              rgba(0,0,0,0.5) 50%, 
              rgba(0,0,0,0.8) 55%, 
              rgba(0,0,0,1) 75%, 
              rgba(0,0,0,0.4) 90%, 
              transparent 100%
            )
          `
        }}
      />
      
      {/* Enhanced fade effects for top, middle, and bottom */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(to bottom,
              rgba(0,0,0,0.4) 0%,
              rgba(0,0,0,0.1) 15%,
              transparent 25%,
              transparent 40%,
              rgba(0,0,0,0.15) 50%,
              transparent 60%,
              transparent 75%,
              rgba(0,0,0,0.1) 85%,
              rgba(0,0,0,0.4) 100%
            )
          `
        }}
      />
      
      {/* Additional mask overlay for grid pattern fade */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at center,
              transparent 20%,
              rgba(0,0,0,0.05) 70%,
              rgba(0,0,0,0.1) 100%
            )
          `
        }}
      />
    </div>
  )
}