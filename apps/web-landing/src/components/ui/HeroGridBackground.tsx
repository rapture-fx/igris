'use client'

export default function HeroGridBackground() {
  return (
    <div 
      className="opacity-20"
      style={{
        backgroundImage: `
          linear-gradient(#382d70 1px, transparent 1px),
          linear-gradient(90deg, #382d70 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
      }}
    />
  )
}
