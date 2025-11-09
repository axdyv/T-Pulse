"use client"

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Line, Text } from "@react-three/drei"
import { UsaMap } from "./UsaMap"

import * as THREE from 'three'
import { TextureLoader } from 'three'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import landData from 'world-atlas/land-110m.json'

// Rough centroid positions for labeling continents (approximate lon/lat)
const CONTINENT_LABELS: { name: string; lon: number; lat: number; color: string }[] = [
  { name: 'North America', lon: -100, lat: 40, color: '#facc15' },
  { name: 'South America', lon: -60, lat: -15, color: '#f97316' },
  { name: 'Europe', lon: 15, lat: 50, color: '#a855f7' },
  { name: 'Africa', lon: 20, lat: 5, color: '#10b981' },
  { name: 'Asia', lon: 90, lat: 35, color: '#ef4444' },
  { name: 'Oceania', lon: 145, lat: -25, color: '#3b82f6' },
  { name: 'Antarctica', lon: 0, lat: -85, color: '#94a3b8' },
]

function ContinentLabels() {
  const labels = useMemo(() => {
    return CONTINENT_LABELS.map(l => {
      const phi = (90 - l.lat) * (Math.PI / 180)
      const theta = (l.lon + 180) * (Math.PI / 180)
      const r = 1.06
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.sin(theta)
      return { ...l, position: [x, y, z] as [number, number, number] }
    })
  }, [])
  return (
    <group>
      {labels.map(l => (
        <Text
          key={l.name}
          position={l.position}
          fontSize={0.06}
          color={l.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.002}
          outlineColor="#000"
          depthOffset={-2}
        >
          {l.name}
        </Text>
      ))}
    </group>
  )
}

function Earth() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const continentRings = useMemo(() => {
    try {
      const landTopo: any = landData
      const raw: any = feature(landTopo, landTopo.objects.land)
      if (!('features' in raw)) return null
      const landFc = raw as FeatureCollection<Geometry>
      const rings: THREE.Vector3[][] = []
      const toXYZ = ([lon, lat]: [number, number]) => {
        const phi = (90 - lat) * (Math.PI / 180)
        const theta = (lon + 180) * (Math.PI / 180)
        const r = 1.001
        const x = r * Math.sin(phi) * Math.cos(theta)
        const y = r * Math.cos(phi)
        const z = r * Math.sin(phi) * Math.sin(theta)
        return [x, y, z] as const
      }
      const addRing = (ring: [number, number][]) => {
        if (ring.length < 2) return
        const pts: THREE.Vector3[] = []
        for (let i = 0; i < ring.length; i++) {
          const [x, y, z] = toXYZ(ring[i])
          pts.push(new THREE.Vector3(x, y, z))
        }
        // close the ring by repeating the first point
        const [x0, y0, z0] = toXYZ(ring[0])
        pts.push(new THREE.Vector3(x0, y0, z0))
        rings.push(pts)
      }
      landFc.features.forEach(f => {
        const geom = f.geometry
        if (geom.type === 'Polygon') {
          (geom.coordinates as [number, number][][]).forEach(ring => addRing(ring))
        } else if (geom.type === 'MultiPolygon') {
          (geom.coordinates as [number, number][][][]).forEach(poly => {
            poly.forEach(ring => addRing(ring))
          })
        }
      })
      return rings
    } catch (e) {
      console.error('Failed to build continent geometry', e)
      return null
    }
  }, [])

  useEffect(() => {
    // Load base earth texture
    const loader = new TextureLoader()
    loader.load('https://raw.githubusercontent.com/itsmruk/earthmaps/main/2_no_clouds_4k.jpg', t => setTexture(t))

    // Build continent outlines from topojson (projected directly onto sphere via lat/long)
  }, [])

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial map={texture ?? undefined} color={texture ? undefined : '#2b5fab'} roughness={0.9} metalness={0.05} />
      </mesh>
      {continentRings && continentRings.map((pts, i) => (
        <Line key={i} points={pts} color="#38bdf8" lineWidth={2.2} transparent opacity={0.9} />
      ))}
      {/* Continent labels for clarity */}
      <ContinentLabels />
    </group>
  )
}


import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

function Scene({ onZoomChange, targetDistance, onTargetDone }: { onZoomChange: (distance: number) => void; targetDistance: number | null; onTargetDone: () => void }) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  useFrame(() => {
    const d = camera.position.length()
    // Animate camera to a target distance if requested
    if (targetDistance) {
      const next = THREE.MathUtils.lerp(d, targetDistance, 0.08)
      const scale = next / d
      camera.position.multiplyScalar(scale)
      camera.updateProjectionMatrix()
      if (Math.abs(next - targetDistance) < 0.01) {
        onTargetDone()
      }
    } else {
      onZoomChange(d)
    }
  })

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 3, 3]} intensity={0.6} />
      <Earth />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1.2}
        maxDistance={6}
      />
    </>
  )
}

export default function GlobeVisualization() {
  const [view, setView] = useState<'globe' | 'usa'>('globe')
  const [targetDistance, setTargetDistance] = useState<number | null>(null)

  const handleZoomChange = useCallback((distance: number) => {
    // Hysteresis to avoid flicker; only auto-switch when not animating
    setView(prev => {
      if (prev === 'globe' && distance < 1.4) return 'usa'
      if (prev === 'usa' && distance > 1.9) return 'globe'
      return prev
    })
  }, [])

  return (
    <div className="relative w-full h-[640px]">
      {/* Globe Layer */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${view === 'usa' ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
          <Scene onZoomChange={handleZoomChange} targetDistance={targetDistance} onTargetDone={() => setTargetDistance(null)} />
        </Canvas>
      </div>

      {/* USA Map Layer */}
      <UsaMap visible={view === 'usa'} onExit={() => { setView('globe'); setTargetDistance(2.6) }} />
      {view !== 'usa' && (
        <div className="absolute bottom-4 left-4 text-xs text-white/60 bg-black/30 px-2 py-1 rounded">
          Scroll / pinch to zoom. Zoom in to view USA states.
        </div>
      )}
    </div>
  )
}
