"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radar, Layers, Navigation } from "lucide-react"

function useSlamAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 600, H = 400
    canvas.width = W
    canvas.height = H

    const trajectory: [number, number][] = []
    const gridCells: { x: number; y: number; opacity: number }[] = []
    const cellSize = 4
    let currentIdx = 0
    let frame = 0

    for (let i = 0; i < 300; i++) {
      const t = i / 300
      const x = 80 + t * 440
      const y = H / 2 + Math.sin(t * 8) * 30 + Math.cos(t * 3) * 50
      trajectory.push([x, Math.max(40, Math.min(H - 40, y))])
    }

    function addScanCells(px: number, py: number) {
      const numRays = 24
      for (let r = 0; r < numRays; r++) {
        const angle = (r / numRays) * Math.PI * 2
        const dist = 30 + Math.random() * 60
        const hx = px + Math.cos(angle) * dist
        const hy = py + Math.sin(angle) * dist

        if (Math.random() > 0.5) {
          gridCells.push({
            x: Math.round(hx / cellSize) * cellSize,
            y: Math.round(hy / cellSize) * cellSize,
            opacity: 0.3 + Math.random() * 0.7,
          })
        }
      }
    }

    let animId: number
    function tick() {
      const isDark = document.documentElement.classList.contains("dark")

      ctx!.fillStyle = isDark ? "#0f172a" : "#f8fafc"
      ctx!.fillRect(0, 0, W, H)

      ctx!.fillStyle = isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.03)"
      for (let x = 0; x < W; x += cellSize) {
        for (let y = 0; y < H; y += cellSize) {
          ctx!.fillRect(x, y, cellSize - 0.5, cellSize - 0.5)
        }
      }

      for (const cell of gridCells) {
        const alpha = cell.opacity * 0.8
        ctx!.fillStyle = isDark
          ? `rgba(96,165,250,${alpha})`
          : `rgba(59,130,246,${alpha})`
        ctx!.fillRect(cell.x, cell.y, cellSize, cellSize)
      }

      if (currentIdx < trajectory.length) {
        const [px, py] = trajectory[currentIdx]
        if (frame % 3 === 0) addScanCells(px, py)
        currentIdx++
      } else {
        currentIdx = 0
        gridCells.length = 0
      }

      if (currentIdx > 1) {
        ctx!.beginPath()
        ctx!.moveTo(trajectory[0][0], trajectory[0][1])
        for (let i = 1; i < currentIdx; i++) {
          ctx!.lineTo(trajectory[i][0], trajectory[i][1])
        }
        ctx!.strokeStyle = isDark ? "#f87171" : "#ef4444"
        ctx!.lineWidth = 2
        ctx!.stroke()

        const [cx, cy] = trajectory[currentIdx - 1]

        ctx!.beginPath()
        ctx!.arc(cx, cy, 18, 0, Math.PI * 2)
        ctx!.strokeStyle = isDark ? "rgba(248,113,113,0.3)" : "rgba(239,68,68,0.2)"
        ctx!.lineWidth = 1
        ctx!.stroke()

        ctx!.beginPath()
        ctx!.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx!.fillStyle = "#ef4444"
        ctx!.fill()
      }

      const [sx, sy] = trajectory[0]
      ctx!.fillStyle = "#22c55e"
      ctx!.beginPath()
      ctx!.arc(sx, sy, 5, 0, Math.PI * 2)
      ctx!.fill()

      ctx!.fillStyle = isDark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.5)"
      ctx!.font = "11px var(--font-mono, monospace)"
      ctx!.fillText(`Scans: ${currentIdx}/${trajectory.length}`, 12, 20)
      ctx!.fillText(`Grid cells: ${gridCells.length}`, 12, 34)

      frame++
      animId = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(animId)
  }, [canvasRef])
}

export function SlamSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useSlamAnimation(canvasRef)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-violet-500" />
          <CardTitle>LiDAR SLAM Pipeline</CardTitle>
          <Badge variant="secondary" className="ml-auto">Correlative Scan Matching</Badge>
        </div>
        <CardDescription>
          Occupancy grid mapping with Bresenham ray-tracing, Gaussian likelihood field,
          and exhaustive CSM pose search (4,851 candidates per scan).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="rounded-xl border overflow-hidden bg-muted/30">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ imageRendering: "crisp-edges" }}
            />
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Pipeline Stages</h4>
              </div>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">1</span>
                  Noise filter (0.05m &ndash; 81m)
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">2</span>
                  Polar → Cartesian conversion
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">3</span>
                  Scan discretization (0.1m/cell)
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">4</span>
                  Occupancy grid + ray tracing
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">5</span>
                  Gaussian blur → likelihood field
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">6</span>
                  CSM exhaustive pose search
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-xs text-foreground bg-muted rounded px-1.5 py-0.5">7</span>
                  Map update with best pose
                </li>
              </ol>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Legend</h4>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Start position</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span>Current pose estimate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-6 rounded bg-blue-500/60" />
                  <span>Occupied grid cells</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 bg-red-500" />
                  <span>Estimated trajectory</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
