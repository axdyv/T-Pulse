"use client"

import { useEffect, useRef, useCallback } from 'react'

interface Star {
  x: number
  y: number
  z: number
  size: number
  opacity: number
  speed: number
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match viewport
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Create stars
    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      z: Math.random() * 1000,
      size: Math.random() * 2,
      opacity: Math.random(),
      speed: 0.5 + Math.random() * 0.5
    }))

    // Animation function
    function animate() {
      if (!ctx || !canvas) return

      ctx.fillStyle = 'rgba(6, 6, 23, 0.2)' // Matches your bg-[#060617] with some transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      stars.forEach(star => {
        // Update star position
        star.z -= star.speed
        if (star.z <= 0) {
          star.z = 1000
          star.x = Math.random() * canvas.width
          star.y = Math.random() * canvas.height
        }

        // Calculate star position relative to center
        const x = (star.x - canvas.width / 2) * (1000 / star.z) + canvas.width / 2
        const y = (star.y - canvas.height / 2) * (1000 / star.z) + canvas.height / 2

        // Calculate size based on z position
        const size = star.size * (1000 / star.z)

        // Draw star with gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.beginPath()
        ctx.fillStyle = gradient
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  )
}