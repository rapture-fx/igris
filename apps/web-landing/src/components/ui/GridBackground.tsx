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
          backgroundSize: '32px 32px'
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
          backgroundSize: '48px 48px'
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
          backgroundSize: '64px 64px'
        }}
      />
      
      {/* Subtle gradient fade for seamless integration */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />
    </div>
  )
}