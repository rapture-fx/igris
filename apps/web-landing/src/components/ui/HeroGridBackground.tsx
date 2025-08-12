'use client'

export default function HeroGridBackground() {
  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Main grid pattern */}
      <div 
        className="absolute inset-0 w-full h-full opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(#382d70 1px, transparent 1px),
            linear-gradient(90deg, #382d70 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 0 0',
          // Apply mask for fade effects
          maskImage: `
            linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%),
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.3) 8%, 
              rgba(0,0,0,1) 20%, 
              rgba(0,0,0,0.7) 45%, 
              rgba(0,0,0,0.4) 50%, 
              rgba(0,0,0,0.7) 55%, 
              rgba(0,0,0,1) 80%, 
              rgba(0,0,0,0.5) 85%, 
              transparent 95%
            )
          `,
          WebkitMaskImage: `
            linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%),
            linear-gradient(to bottom, 
              transparent 0%, 
              rgba(0,0,0,0.3) 8%, 
              rgba(0,0,0,1) 20%, 
              rgba(0,0,0,0.7) 45%, 
              rgba(0,0,0,0.4) 50%, 
              rgba(0,0,0,0.7) 55%, 
              rgba(0,0,0,1) 80%, 
              rgba(0,0,0,0.5) 85%, 
              transparent 95%
            )
          `,
        }}
      />
      
      {/* Additional fade overlay for smoother transitions */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `
            linear-gradient(to bottom,
              rgba(0,0,0,0.1) 0%,
              transparent 15%,
              transparent 80%,
              rgba(0,0,0,0.3) 100%
            )
          `
        }}
      />
    </div>
  )
}
