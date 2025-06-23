'use client'

import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sphere, OrbitControls, Stars, Text } from '@react-three/drei'
import * as THREE from 'three'

// Data points representing global data processing locations
const dataPoints = [
  { lat: 40.7128, lng: -74.0060, name: 'New York', intensity: 0.8 },
  { lat: 51.5074, lng: -0.1278, name: 'London', intensity: 0.9 },
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo', intensity: 0.7 },
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco', intensity: 1.0 },
  { lat: 52.5200, lng: 13.4050, name: 'Berlin', intensity: 0.6 },
  { lat: -33.8688, lng: 151.2093, name: 'Sydney', intensity: 0.5 },
  { lat: 19.0760, lng: 72.8777, name: 'Mumbai', intensity: 0.8 },
  { lat: -23.5505, lng: -46.6333, name: 'São Paulo', intensity: 0.4 },
]

// Convert lat/lng to 3D sphere coordinates
function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Animated data point component
function DataPoint({ position, intensity, name }: { 
  position: THREE.Vector3, 
  intensity: number, 
  name: string 
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = React.useState(false)
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(
        intensity * (1 + Math.sin(state.clock.elapsedTime * 2) * 0.1) * (hovered ? 1.5 : 1)
      )
    }
  })
  
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial 
          color="#10b981" 
          transparent 
          opacity={0.8}
        />
      </mesh>
      {hovered && (
        <Text
          position={[0, 0.1, 0]}
          fontSize={0.05}
          color="#1a1a1a"
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      )}
    </group>
  )
}

// Animated globe wireframe
function Globe() {
  const globeRef = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.005
    }
  })
  
  return (
    <mesh ref={globeRef}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshBasicMaterial 
        color="#6366f1" 
        wireframe 
        transparent 
        opacity={0.1}
      />
    </mesh>
  )
}

// Floating data particles
function DataParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(100 * 3)
    for (let i = 0; i < 100; i++) {
      const radius = 2.5 + Math.random() * 1.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.cos(phi)
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    return positions
  }, [])
  
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.1
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1
    }
  })
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={100}
          array={particlePositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color="#10b981" 
        transparent 
        opacity={0.6}
      />
    </points>
  )
}

// Main scene component
function Scene() {
  const { camera } = useThree()
  
  React.useEffect(() => {
    camera.position.set(0, 0, 6)
  }, [camera])
  
  return (
    <>
      <OrbitControls 
        enableZoom={true}
        enablePan={false}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.5}
        minDistance={4}
        maxDistance={10}
      />
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      <Stars 
        radius={100} 
        depth={50} 
        count={1000} 
        factor={4} 
        saturation={0} 
        fade={true}
      />
      
      <Globe />
      <DataParticles />
      
      {dataPoints.map((point, index) => {
        const position = latLngToVector3(point.lat, point.lng, 2.05)
        return (
          <DataPoint
            key={index}
            position={position}
            intensity={point.intensity}
            name={point.name}
          />
        )
      })}
    </>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mercury-accent"></div>
    </div>
  )
}

// Main component
export default function DataGlobe({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        className="bg-transparent"
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      
      {/* Overlay content */}
      <div className="absolute top-4 left-4 text-mercury-primary">
        <h3 className="text-lg font-semibold mb-2">Global Data Processing</h3>
        <p className="text-sm text-gray-600">
          Real-time data intelligence across {dataPoints.length} major regions
        </p>
      </div>
      
      {/* Stats overlay */}
      <div className="absolute bottom-4 right-4 bg-mercury-surface/80 backdrop-blur-sm rounded-lg p-3">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-mercury-accent rounded-full mr-2"></div>
            <span>Active Nodes</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-mercury-secondary rounded-full mr-2"></div>
            <span>Processing</span>
          </div>
        </div>
      </div>
    </div>
  )
} 