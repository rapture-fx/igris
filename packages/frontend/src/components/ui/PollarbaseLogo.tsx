'use client';

import React from 'react';

interface PollarbaseLogoProps {
  className?: string;
  width?: number;
  height?: number;
  color?: string;
}

export function PollarbaseLogo({ 
  className = '', 
  width = 40, 
  height = 40, 
  color = '#1e293b' 
}: PollarbaseLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cross/Plus pattern logo matching the provided design */}
      <g fill={color}>
        {/* Top-left arm */}
        <path
          d="M10 10 L40 10 Q45 10 45 15 L45 25 Q45 30 40 30 L30 30 L30 40 Q30 45 25 45 L15 45 Q10 45 10 40 L10 15 Q10 10 15 10 Z"
        />
        
        {/* Top-right arm */}
        <path
          d="M55 10 L85 10 Q90 10 90 15 L90 40 Q90 45 85 45 L70 45 Q65 45 65 40 L65 30 L55 30 Q50 30 50 25 L50 15 Q50 10 55 10 Z"
        />
        
        {/* Bottom-right arm */}
        <path
          d="M85 55 L85 85 Q85 90 80 90 L55 90 Q50 90 50 85 L50 70 Q50 65 55 65 L65 65 L65 55 Q65 50 70 50 L80 50 Q85 50 85 55 Z"
        />
        
        {/* Bottom-left arm */}
        <path
          d="M10 55 L10 85 Q10 90 15 90 L40 90 Q45 90 45 85 L45 70 Q45 65 40 65 L30 65 L30 55 Q30 50 25 50 L15 50 Q10 50 10 55 Z"
        />
        
        {/* Center connecting element */}
        <rect 
          x="30" 
          y="30" 
          width="40" 
          height="40" 
          rx="8" 
          ry="8"
        />
        
        {/* Inner detail for visual depth */}
        <rect 
          x="40" 
          y="40" 
          width="20" 
          height="20" 
          rx="4" 
          ry="4"
          fill="white"
          fillOpacity="0.15"
        />
      </g>
    </svg>
  );
}

export default PollarbaseLogo; 