'use client'

import { motion } from 'framer-motion'

export function AnimatedDotGrid() {
  return (
    <div className="absolute inset-0 z-0">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="dot-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <motion.circle
              cx="15"
              cy="15"
              r="1"
              fill="#E0E0E0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, staggerChildren: 0.1 }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
    </div>
  )
} 