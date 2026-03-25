/**
 * useMouseTilt — Dynamic 3D tilt tracking for glass cards.
 * Attach the returned ref to any card element and the event handlers
 * to its onMouseMove / onMouseLeave props.
 */
import { useRef, useCallback } from 'react'

interface TiltOptions {
  maxDeg?: number   // maximum tilt degrees (default: 12)
  scale?: number    // scale on hover (default: 1.02)
  glare?: boolean   // compute glare position (default: true)
}

export function useMouseTilt(opts: TiltOptions = {}) {
  const { maxDeg = 12, scale = 1.02 } = opts
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef<number | null>(null)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return

    if (raf.current) cancelAnimationFrame(raf.current)

    raf.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      // Normalise cursor position to [-1, 1]
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1   // +1 = right
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1   // +1 = bottom

      const rotX = -ny * maxDeg   // tilt up when mouse is at bottom
      const rotY =  nx * maxDeg   // tilt right when mouse is at right

      el.style.transition = 'transform 0.08s linear, box-shadow 0.2s ease'
      el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale}) translateZ(10px)`

      // Inner neon glow shifts toward cursor
      const gx = 50 + nx * 30
      const gy = 50 + ny * 30
      el.style.background = `
        radial-gradient(circle at ${gx}% ${gy}%, rgba(0,229,255,0.07) 0%, transparent 60%),
        rgba(10, 22, 40, 0.70)
      `
    })
  }, [maxDeg, scale])

  const onMouseLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (raf.current) cancelAnimationFrame(raf.current)

    el.style.transition = 'transform 0.5s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.4s ease, background 0.5s ease'
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateZ(0)'
    el.style.background = ''
  }, [])

  return { ref, onMouseMove, onMouseLeave }
}
