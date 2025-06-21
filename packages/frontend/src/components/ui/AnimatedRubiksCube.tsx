'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const AnimatedRubiksCube = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  const animationIdRef = useRef<number>()

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.set(8, 8, 8)
    camera.lookAt(0, 0, 0)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(400, 400)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace

    mountRef.current.appendChild(renderer.domElement)

    // Enhanced lighting setup for metallic appearance
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight.position.set(15, 15, 10)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 4096
    directionalLight.shadow.mapSize.height = 4096
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 50
    directionalLight.shadow.camera.left = -20
    directionalLight.shadow.camera.right = 20
    directionalLight.shadow.camera.top = 20
    directionalLight.shadow.camera.bottom = -20
    scene.add(directionalLight)

    // Additional lights for metallic reflections
    const pointLight1 = new THREE.PointLight(0x4080ff, 0.8, 100)
    pointLight1.position.set(-10, 10, 10)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xff8040, 0.6, 100)
    pointLight2.position.set(10, -10, -10)
    scene.add(pointLight2)

    const rimLight = new THREE.DirectionalLight(0x8080ff, 0.5)
    rimLight.position.set(-5, 0, 5)
    scene.add(rimLight)

    // Create main cube group
    const cubeGroup = new THREE.Group()
    scene.add(cubeGroup)

    // Black metallic material with high-end finish
    const blackMetallicMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0a,
      metalness: 0.95,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
      envMapIntensity: 1.5,
      transparent: false
    })

    // Create environment map for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const envTexture = pmremGenerator.fromScene(scene).texture
    blackMetallicMaterial.envMap = envTexture

    // Create individual cube pieces (3x3x3 = 27 pieces)
    const cubes: THREE.Mesh[] = []
    const cubeSize = 0.95
    const gap = 0.05
    const spacing = cubeSize + gap

    // Rounded cube geometry function
    const createRoundedCube = (size: number) => {
      const geometry = new THREE.BoxGeometry(size, size, size, 8, 8, 8)
      
      // Apply rounding to vertices for smooth edges
      const positionAttribute = geometry.getAttribute('position')
      const vertex = new THREE.Vector3()
      
      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i)
        
        // Apply subtle rounding by normalizing and scaling
        const length = vertex.length()
        vertex.normalize()
        vertex.multiplyScalar(Math.min(length, size * 0.48))
        
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z)
      }
      
      geometry.computeVertexNormals()
      return geometry
    }

    // Create 3x3x3 cube structure
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const geometry = createRoundedCube(cubeSize)
          const cube = new THREE.Mesh(geometry, blackMetallicMaterial.clone())
          
          cube.position.set(x * spacing, y * spacing, z * spacing)
          cube.castShadow = true
          cube.receiveShadow = true
          
          // Add subtle edge definition
          const edges = new THREE.EdgesGeometry(geometry)
          const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x333333, 
            linewidth: 1,
            transparent: true,
            opacity: 0.4
          })
          const wireframe = new THREE.LineSegments(edges, lineMaterial)
          cube.add(wireframe)
          
          // Store original position for solving algorithm
          cube.userData = {
            originalPosition: { x, y, z },
            currentPosition: { x, y, z }
          }
          
          cubes.push(cube)
          cubeGroup.add(cube)
        }
      }
    }

    // Rubik's cube solving algorithm
    interface Move {
      face: 'R' | 'L' | 'U' | 'D' | 'F' | 'B'
      clockwise: boolean
      duration: number
      startTime: number
      completed: boolean
    }

    // Generate realistic solving sequence
    const generateSolvingMoves = (): Move[] => {
      const faces: Array<'R' | 'L' | 'U' | 'D' | 'F' | 'B'> = ['R', 'L', 'U', 'D', 'F', 'B']
      const moves: Move[] = []
      
      // Scrambling phase (0-3s)
      for (let i = 0; i < 8; i++) {
        moves.push({
          face: faces[Math.floor(Math.random() * faces.length)],
          clockwise: Math.random() > 0.5,
          duration: 0.4,
          startTime: i * 0.3,
          completed: false
        })
      }
      
      // Solving bottom layer (3-8s)
      const bottomMoves = ['D', 'R', 'U', 'R\'', 'D\'', 'F', 'U', 'F\'']
      bottomMoves.forEach((move, i) => {
        moves.push({
          face: move.replace('\'', '') as 'R' | 'L' | 'U' | 'D' | 'F' | 'B',
          clockwise: !move.includes('\''),
          duration: 0.6,
          startTime: 3 + i * 0.6,
          completed: false
        })
      })
      
      // Solving middle layer (8-12s)
      const middleMoves = ['R', 'U', 'R\'', 'F', 'R', 'F\'', 'U\'', 'R\'']
      middleMoves.forEach((move, i) => {
        moves.push({
          face: move.replace('\'', '') as 'R' | 'L' | 'U' | 'D' | 'F' | 'B',
          clockwise: !move.includes('\''),
          duration: 0.5,
          startTime: 8 + i * 0.5,
          completed: false
        })
      })
      
      // Solving top layer (12-15s)
      const topMoves = ['U', 'R', 'U\'', 'L\'', 'U', 'R\'', 'U\'', 'L']
      topMoves.forEach((move, i) => {
        moves.push({
          face: move.replace('\'', '') as 'R' | 'L' | 'U' | 'D' | 'F' | 'B',
          clockwise: !move.includes('\''),
          duration: 0.4,
          startTime: 12 + i * 0.375,
          completed: false
        })
      })
      
      return moves
    }

    // Get cubes for each face
    const getFaceCubes = (face: string) => {
      return cubes.filter(cube => {
        const pos = cube.userData.currentPosition
        switch (face) {
          case 'R': return pos.x === 1
          case 'L': return pos.x === -1
          case 'U': return pos.y === 1
          case 'D': return pos.y === -1
          case 'F': return pos.z === 1
          case 'B': return pos.z === -1
          default: return false
        }
      })
    }

    // Animation variables
    let time = 0
    let cycleStartTime = 0
    let currentMoves = generateSolvingMoves()

    // Animation loop
    const animate = () => {
      time += 0.016 // ~60fps

      // Global rotation - continuous 360° rotation
      cubeGroup.rotation.y += 0.008 // Primary Y-axis rotation
      cubeGroup.rotation.x += 0.003 // Slow X-axis tumbling
      cubeGroup.rotation.z += 0.001 // Subtle Z-axis wobble

      // Cycle management (18 second cycles)
      const cycleTime = time - cycleStartTime
      if (cycleTime > 18) {
        cycleStartTime = time
        currentMoves = generateSolvingMoves()
        
        // Reset all rotations
        cubes.forEach(cube => {
          cube.rotation.set(0, 0, 0)
        })
      }

      // Execute solving moves
      currentMoves.forEach(move => {
        const moveTime = cycleTime - move.startTime
        if (moveTime >= 0 && moveTime <= move.duration && !move.completed) {
          const progress = moveTime / move.duration
          
          // Smooth easing function
          const easeInOutCubic = (t: number) => {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
          }
          
          const easedProgress = easeInOutCubic(progress)
          const faceCubes = getFaceCubes(move.face)
          
          const rotationAmount = (move.clockwise ? 1 : -1) * Math.PI / 2 * easedProgress
          
          faceCubes.forEach(cube => {
            switch (move.face) {
              case 'R':
              case 'L':
                cube.rotation.x = rotationAmount
                break
              case 'U':
              case 'D':
                cube.rotation.y = rotationAmount
                break
              case 'F':
              case 'B':
                cube.rotation.z = rotationAmount
                break
            }
          })
          
          if (progress >= 1) {
            move.completed = true
          }
        }
      })

      // Subtle breathing effect for individual cubes
      cubes.forEach((cube, index) => {
        const breathe = 1 + 0.01 * Math.sin(time * 1.5 + index * 0.1)
        cube.scale.setScalar(breathe)
      })

      // Dynamic lighting for enhanced metallic appearance
      pointLight1.intensity = 0.8 + 0.2 * Math.sin(time * 0.8)
      pointLight2.intensity = 0.6 + 0.2 * Math.cos(time * 1.2)
      
      pointLight1.position.x = Math.sin(time * 0.3) * 10
      pointLight1.position.z = Math.cos(time * 0.3) * 10
      
      pointLight2.position.x = Math.cos(time * 0.4) * 8
      pointLight2.position.z = Math.sin(time * 0.4) * 8

      renderer.render(scene, camera)
      animationIdRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup function
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      
      // Dispose of resources
      renderer.dispose()
      pmremGenerator.dispose()
      cubes.forEach(cube => {
        cube.geometry.dispose()
        if (Array.isArray(cube.material)) {
          cube.material.forEach(mat => mat.dispose())
        } else {
          cube.material.dispose()
        }
      })
    }
  }, [])

  return (
    <div 
      ref={mountRef} 
      className="w-96 h-96 flex items-center justify-center rounded-3xl"
      style={{
        background: 'radial-gradient(circle at center, rgba(26,26,26,0.8) 0%, rgba(10,10,10,0.9) 70%, rgba(0,0,0,1) 100%)',
        boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5), 0 0 60px rgba(64,128,255,0.1)'
      }}
    />
  )
}

export default AnimatedRubiksCube
