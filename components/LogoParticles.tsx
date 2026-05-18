'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  opacity: number
  drift: number
  sparkle: number
  x: number
  y: number
}

interface Props {
  size?: number
}

export default function LogoParticles({ size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const CX = size / 2
    const CY = size / 2
    const LOGO_RADIUS = size * 0.37

    const particles: Particle[] = []

    const spawn = () => {
      const angle = Math.random() * Math.PI * 2
      const r = LOGO_RADIUS + Math.random() * 4
      particles.push({
        angle,
        radius: r,
        speed: (Math.random() * 0.018 + 0.006) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 1.6 + 0.4,
        opacity: Math.random() * 0.5 + 0.5,
        drift: Math.random() * 0.3 + 0.08,
        sparkle: Math.random() * Math.PI * 2,
        x: CX + Math.cos(angle) * r,
        y: CY + Math.sin(angle) * r,
      })
    }

    for (let i = 0; i < 22; i++) spawn()

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rotation: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.beginPath()
      ctx.moveTo(0, -s * 2.2)
      ctx.lineTo(s * 0.45, -s * 0.45)
      ctx.lineTo(s * 2.2, 0)
      ctx.lineTo(s * 0.45, s * 0.45)
      ctx.lineTo(0, s * 2.2)
      ctx.lineTo(-s * 0.45, s * 0.45)
      ctx.lineTo(-s * 2.2, 0)
      ctx.lineTo(-s * 0.45, -s * 0.45)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const maxRadius = size * 0.49

    let frame: number
    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      if (particles.length < 36 && Math.random() < 0.18) spawn()

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.angle += p.speed
        p.radius += p.drift * 0.28
        p.opacity -= 0.0038
        p.sparkle += 0.08
        p.size += 0.007
        p.x = CX + Math.cos(p.angle) * p.radius
        p.y = CY + Math.sin(p.angle) * p.radius

        if (p.opacity <= 0 || p.radius > maxRadius) {
          particles.splice(i, 1)
          continue
        }

        const twinkle = 0.65 + 0.35 * Math.sin(p.sparkle)
        const alpha = p.opacity * twinkle

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#ffffff'
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(200,220,255,0.9)'
        drawStar(ctx, p.x, p.y, p.size, p.sparkle * 0.4)
        ctx.restore()

        ctx.save()
        ctx.globalAlpha = alpha * 0.22
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5)
        grad.addColorStop(0, 'rgba(200,210,255,1)')
        grad.addColorStop(1, 'rgba(200,210,255,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
    />
  )
}
