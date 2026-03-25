/**
 * TiltCard — A glassmorphism card with JS-powered 3D mouse-tracking tilt.
 * Drop-in replacement for a <div className="card">.
 * 
 * Usage:
 *   <TiltCard className="my-card">...</TiltCard>
 *   <TiltCard maxDeg={8} className="card violet">...</TiltCard>
 */
import { useMouseTilt } from '../hooks/useMouseTilt'

interface TiltCardProps {
  children: React.ReactNode
  className?: string
  maxDeg?: number
  style?: React.CSSProperties
  onClick?: () => void
}

export function TiltCard({ children, className = '', maxDeg = 10, style, onClick }: TiltCardProps) {
  const { ref, onMouseMove, onMouseLeave } = useMouseTilt({ maxDeg })

  return (
    <div
      ref={ref}
      className={`card tilt-card ${className}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {/* Holographic shimmer layer */}
      <div className="tilt-shimmer" aria-hidden="true" />
      {children}
    </div>
  )
}
