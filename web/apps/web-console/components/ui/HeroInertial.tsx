'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function HeroInertial() {
  const containerRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>()
  const clockRef = useRef<THREE.Clock>()
  const innerCoreRef = useRef<THREE.Mesh>()
  const outerShellRef = useRef<THREE.Points>()

  useEffect(() => {
    if (!containerRef.current) return

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Scene setup
    const scene = new THREE.Scene()

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 5

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = false
    containerRef.current.appendChild(renderer.domElement)

    // ===== INNER CORE - Purple geodesic sphere =====
    // Main grid structure (latitude/longitude lines)
    const coreGeometry = new THREE.SphereGeometry(3.8, 48, 48) // High segment count for compact grid
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xc7b5d6, // Purple/lavender color from reference
      wireframe: true,
      transparent: false,
      opacity: 1
    })
    const innerCore = new THREE.Mesh(coreGeometry, coreMaterial)
    innerCore.position.y = -3.0 // Move down to show top portion
    innerCoreRef.current = innerCore
    scene.add(innerCore)

    // Add diagonal grid overlay (rotated 45 degrees)
    const diagonalGeometry = new THREE.SphereGeometry(3.8, 48, 48)
    const diagonalMaterial = new THREE.MeshBasicMaterial({
      color: 0xc7b5d6,
      wireframe: true,
      transparent: false,
      opacity: 1
    })
    const diagonalCore = new THREE.Mesh(diagonalGeometry, diagonalMaterial)
    diagonalCore.position.y = -3.0
    diagonalCore.rotation.z = Math.PI / 4 // Rotate 45 degrees for diagonal effect
    diagonalCore.rotation.x = Math.PI / 4
    scene.add(diagonalCore)

    // ===== OUTER SHELL - Grey particle dots =====
    const particleCount = 3000 // Dense particle field
    const positions = new Float32Array(particleCount * 3)

    // Create evenly distributed particles on sphere surface
    const radius = 4.2
    for (let i = 0; i < particleCount; i++) {
      // Fibonacci sphere distribution for even spacing
      const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Create circular texture for particles
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    const particleTexture = new THREE.CanvasTexture(canvas)

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x888888, // Grey color from reference
      size: 0.06,
      map: particleTexture,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
      depthWrite: false
    })

    const outerShell = new THREE.Points(particleGeometry, particleMaterial)
    outerShell.position.y = -3.0 // Move down to match inner core
    outerShellRef.current = outerShell
    scene.add(outerShell)

    // Clock for delta-time based animation
    const clock = new THREE.Clock()
    clockRef.current = clock

    // Animation parameters
    const INNER_ROTATION_SPEED = (Math.PI * 2) / 150 // 150 seconds per rotation
    const OUTER_ROTATION_SPEED = (Math.PI * 2) / 52.5 // 52.5 seconds (3x faster)
    const RAMP_DURATION = 0.4 // 400ms ramp-in

    let animationStartTime = 0

    // Animation loop
    const animate = () => {
      if (!innerCoreRef.current || !outerShellRef.current) return

      const elapsedTime = clock.getElapsedTime()

      if (animationStartTime === 0) {
        animationStartTime = elapsedTime
      }

      // Soft ramp-in
      const rampProgress = Math.min((elapsedTime - animationStartTime) / RAMP_DURATION, 1)
      const easedProgress = rampProgress // Linear for constant velocity feel

      if (!prefersReducedMotion) {
        // Inner core: counterclockwise (negative rotation)
        innerCoreRef.current.rotation.y = -elapsedTime * INNER_ROTATION_SPEED * easedProgress

        // Outer shell: clockwise (positive rotation)
        outerShellRef.current.rotation.y = elapsedTime * OUTER_ROTATION_SPEED * easedProgress
      }

      renderer.render(scene, camera)
      requestRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return

      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      renderer.dispose()
      coreGeometry.dispose()
      coreMaterial.dispose()
      diagonalGeometry.dispose()
      diagonalMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      particleTexture.dispose()
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
    />
  )
}
