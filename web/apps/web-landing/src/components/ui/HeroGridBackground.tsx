'use client'

export default function HeroGridBackground() {
  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Main grid pattern */}
      <div 
        className="absolute inset-0 w-full h-full opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(#1A5799 1px, transparent 1px),
            linear-gradient(90deg, #1A5799 1px, transparent 1px)
          `,
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 0',
          // Apply mask for fade effects
          maskImage: `
            linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%),
            linear-gradient(to bottom, 
              white 0%, 
              rgba(255,255,255,0.7) 8%, 
              transparent 20%, 
              rgba(255,255,255,0.3) 45%, 
              rgba(255,255,255,0.6) 50%, 
              rgba(255,255,255,0.3) 55%, 
              transparent 80%, 
              rgba(255,255,255,0.5) 85%, 
              white 95%
            )
          `,
          WebkitMaskImage: `
            linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%),
            linear-gradient(to bottom, 
              white 0%, 
              rgba(255,255,255,0.7) 8%, 
              transparent 20%, 
              rgba(255,255,255,0.3) 45%, 
              rgba(255,255,255,0.6) 50%, 
              rgba(255,255,255,0.3) 55%, 
              transparent 80%, 
              rgba(255,255,255,0.5) 85%, 
              white 95%
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
              rgba(255,255,255,0.1) 0%,
              transparent 15%,
              transparent 80%,
              rgba(255,255,255,0.3) 100%
            )
          `
        }}
      />
    </div>
  )
}
