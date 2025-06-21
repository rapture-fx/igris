'use client';

import React from 'react';

interface CompanyLogoProps {
  className?: string;
  width?: number;
  height?: number;
  color?: string;
}

export function CompanyLogo({ 
  className = '', 
  width = 64, 
  height = 64, 
  color = '#1e293b' 
}: CompanyLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cross/Plus pattern logo based on the provided image */}
      <g fill={color}>
        {/* Top-left arm */}
        <path
          d="M20 20 L80 20 Q90 20 90 30 L90 50 Q90 60 80 60 L60 60 L60 80 Q60 90 50 90 L30 90 Q20 90 20 80 L20 30 Q20 20 30 20 Z"
        />
        
        {/* Top-right arm */}
        <path
          d="M120 20 L180 20 Q190 20 190 30 L190 80 Q190 90 180 90 L150 90 Q140 90 140 80 L140 60 L120 60 Q110 60 110 50 L110 30 Q110 20 120 20 Z"
        />
        
        {/* Bottom-right arm */}
        <path
          d="M180 120 L180 180 Q180 190 170 190 L120 190 Q110 190 110 180 L110 150 Q110 140 120 140 L140 140 L140 120 Q140 110 150 110 L170 110 Q180 110 180 120 Z"
        />
        
        {/* Bottom-left arm */}
        <path
          d="M20 120 L20 180 Q20 190 30 190 L80 190 Q90 190 90 180 L90 150 Q90 140 80 140 L60 140 L60 120 Q60 110 50 110 L30 110 Q20 110 20 120 Z"
        />
        
        {/* Center connecting square */}
        <rect 
          x="60" 
          y="60" 
          width="80" 
          height="80" 
          rx="15" 
          ry="15"
        />
        
        {/* Inner detail for depth */}
        <rect 
          x="80" 
          y="80" 
          width="40" 
          height="40" 
          rx="8" 
          ry="8"
          fill="white"
          fillOpacity="0.15"
        />
      </g>
    </svg>
  );
}

export default CompanyLogo; 