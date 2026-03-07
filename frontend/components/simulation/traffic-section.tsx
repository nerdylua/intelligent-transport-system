"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Car, MapPin, Radio } from "lucide-react"

interface Vehicle {
  id: number
  x: number
  y: number
  angle: number
  speed: number
  isEgo: boolean
  lane: number
  progress: number
  /** For roundabout: which phase the vehicle is in */
  phase?: "approach" | "ring" | "exit"
  /** For roundabout: which arm (0=W,1=N,2=E,3=S) */
  arm?: number
  /** For roundabout: entry angle on the ring */
  ringEntry?: number
  /** For roundabout: how far around the ring to travel (radians) */
  ringArc?: number
  /** For signalised intersection: does this vehicle obey a signal? */
  signalGroup?: "ns" | "ew"
}

export type TopologyId =
  | "intersection"
  | "signalised"
  | "roundabout"
  | "highway-merge"

interface TopologyConfig {
  id: TopologyId
  label: string
  network: string
  description: string
  duration: string
  stepSize: string
  lidarRays: string
  scansOutput: string
  vehicleCounts: number[]
  egoLane: number
}

const TOPOLOGIES: TopologyConfig[] = [
  {
    id: "intersection",
    label: "4-Way Intersection",
    network: "4-way intersection",
    description: "Standard signalised crossroads with 4 approach lanes. The ego vehicle traverses horizontally while cross-traffic flows vertically.",
    duration: "150s",
    stepSize: "0.1s",
    lidarRays: "180",
    scansOutput: "581",
    vehicleCounts: [5, 4, 3, 3],
    egoLane: 0,
  },
  {
    id: "signalised",
    label: "Signalised Intersection",
    network: "4-way signalised",
    description: "Modelled after the SUMO network: 2-phase signal (42s green / 3s yellow per direction, 90s cycle). Vehicles queue behind the stop line while the opposing direction flows. The ego vehicle approaches from the west on the W\u2192E corridor.",
    duration: "150s",
    stepSize: "0.1s",
    lidarRays: "180",
    scansOutput: "581",
    vehicleCounts: [5, 4, 4, 4],
    egoLane: 0,
  },
  {
    id: "roundabout",
    label: "Roundabout",
    network: "Single-lane roundabout",
    description: "Circular junction where vehicles approach from 4 arms, circulate around the ring, and exit at one of the other arms. The ego vehicle enters from the west arm and exits east.",
    duration: "200s",
    stepSize: "0.1s",
    lidarRays: "180",
    scansOutput: "742",
    vehicleCounts: [3, 3, 3, 3],
    egoLane: 0,
  },
  {
    id: "highway-merge",
    label: "Highway Merge",
    network: "3-lane highway + ramp",
    description: "High-speed merge zone where ramp traffic joins a 3-lane highway. The ego vehicle is on the ramp and must find a gap in mainline flow.",
    duration: "120s",
    stepSize: "0.05s",
    lidarRays: "360",
    scansOutput: "1,024",
    vehicleCounts: [4, 5, 5, 4],
    egoLane: 0,
  },
]

type DrawRoadsFn = (ctx: CanvasRenderingContext2D, W: number, H: number, frame?: number) => void
type PosFromProgressFn = (v: Vehicle, p: number, W: number, H: number) => [number, number]
type SpawnFn = (cfg: TopologyConfig) => Vehicle[]
type TickFn = (vehicles: Vehicle[], frame: number, W: number, H: number) => void

function isDark() {
  return document.documentElement.classList.contains("dark")
}

const drawIntersection: DrawRoadsFn = (ctx, W, H) => {
  const cx = W / 2, cy = H / 2, roadW = 44
  const dark = isDark()
  ctx.fillStyle = dark ? "#1e293b" : "#f1f5f9"
  ctx.fillRect(0, 0, W, H)
  const roadColor = dark ? "#334155" : "#94a3b8"
  const lineColor = dark ? "#475569" : "#cbd5e1"
  const markColor = dark ? "#fbbf24" : "#f59e0b"

  ctx.fillStyle = roadColor
  ctx.fillRect(0, cy - roadW / 2, W, roadW)
  ctx.fillRect(cx - roadW / 2, 0, roadW, H)

  ctx.setLineDash([8, 8])
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, cy); ctx.lineTo(cx - roadW / 2, cy)
  ctx.moveTo(cx + roadW / 2, cy); ctx.lineTo(W, cy)
  ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - roadW / 2)
  ctx.moveTo(cx, cy + roadW / 2); ctx.lineTo(cx, H)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = markColor
  ctx.fillRect(cx - roadW / 2, cy - roadW / 2, roadW, roadW)
  ctx.fillStyle = dark ? "#1e293b" : "#f8fafc"
  ctx.fillRect(cx - roadW / 2 + 3, cy - roadW / 2 + 3, roadW - 6, roadW - 6)
}

const spawnIntersection: SpawnFn = (cfg) => {
  const vehicles: Vehicle[] = []
  let id = 0
  const angles = [0, Math.PI, -Math.PI / 2, Math.PI / 2]
  cfg.vehicleCounts.forEach((count, lane) => {
    for (let i = 0; i < count; i++) {
      vehicles.push({
        id: id++, x: 0, y: 0,
        angle: angles[lane],
        speed: 0.3 + Math.random() * 0.4,
        isEgo: false, lane, progress: Math.random() * -0.3,
      })
    }
  })
  vehicles.push({
    id: id++, x: 0, y: 0,
    angle: angles[cfg.egoLane],
    speed: 0.35 + Math.random() * 0.25,
    isEgo: true, lane: cfg.egoLane, progress: -0.15,
  })
  return vehicles
}

const posIntersection: PosFromProgressFn = (v, p, W, H) => {
  const cx = W / 2, cy = H / 2, hw = 11
  switch (v.lane) {
    case 0: return [p * W, cy - hw]
    case 1: return [(1 - p) * W, cy + hw]
    case 2: return [cx + hw, p * H]
    case 3: return [cx - hw, (1 - p) * H]
    default: return [0, 0]
  }
}

const SIG_CYCLE_FRAMES = 480
const SIG_NS_GREEN_END = Math.round(SIG_CYCLE_FRAMES * 42 / 90)
const SIG_NS_YELLOW_END = Math.round(SIG_CYCLE_FRAMES * 45 / 90)
const SIG_EW_GREEN_END = Math.round(SIG_CYCLE_FRAMES * 87 / 90)

function getSignalState(frame: number): { ns: "green" | "yellow" | "red"; ew: "green" | "yellow" | "red" } {
  const t = frame % SIG_CYCLE_FRAMES
  if (t < SIG_NS_GREEN_END) return { ns: "green", ew: "red" }
  if (t < SIG_NS_YELLOW_END) return { ns: "yellow", ew: "red" }
  if (t < SIG_EW_GREEN_END) return { ns: "red", ew: "green" }
  return { ns: "red", ew: "yellow" }
}

const SIG_ROAD_W = 44
const SIG_HW = 11

const SIG_STOP: Record<number, number> = { 0: 0.46, 1: 0.46, 2: 0.44, 3: 0.44 }

const drawSignalised: DrawRoadsFn = (ctx, W, H, frame = 0) => {
  const cx = W / 2, cy = H / 2, roadW = SIG_ROAD_W
  const dark = isDark()
  ctx.fillStyle = dark ? "#1e293b" : "#f1f5f9"
  ctx.fillRect(0, 0, W, H)
  const roadColor = dark ? "#334155" : "#94a3b8"
  const lineColor = dark ? "#475569" : "#cbd5e1"

  ctx.fillStyle = roadColor
  ctx.fillRect(0, cy - roadW / 2, W, roadW)
  ctx.fillRect(cx - roadW / 2, 0, roadW, H)

  // lane dividers
  ctx.setLineDash([8, 8])
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, cy); ctx.lineTo(cx - roadW / 2, cy)
  ctx.moveTo(cx + roadW / 2, cy); ctx.lineTo(W, cy)
  ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - roadW / 2)
  ctx.moveTo(cx, cy + roadW / 2); ctx.lineTo(cx, H)
  ctx.stroke()
  ctx.setLineDash([])

  // junction box
  ctx.fillStyle = dark ? "#1e293b" : "#f8fafc"
  ctx.fillRect(cx - roadW / 2, cy - roadW / 2, roadW, roadW)

  // stop lines (thick white lines at each approach)
  ctx.strokeStyle = dark ? "#e2e8f0" : "#334155"
  ctx.lineWidth = 2.5
  // W approach stop line
  ctx.beginPath(); ctx.moveTo(cx - roadW / 2, cy - roadW / 2); ctx.lineTo(cx - roadW / 2, cy); ctx.stroke()
  // E approach stop line
  ctx.beginPath(); ctx.moveTo(cx + roadW / 2, cy); ctx.lineTo(cx + roadW / 2, cy + roadW / 2); ctx.stroke()
  // N approach stop line
  ctx.beginPath(); ctx.moveTo(cx, cy - roadW / 2); ctx.lineTo(cx + roadW / 2, cy - roadW / 2); ctx.stroke()
  // S approach stop line
  ctx.beginPath(); ctx.moveTo(cx - roadW / 2, cy + roadW / 2); ctx.lineTo(cx, cy + roadW / 2); ctx.stroke()

  // traffic light indicators
  const sig = getSignalState(frame)
  const lightR = 5
  const drawLight = (x: number, y: number, state: "green" | "yellow" | "red") => {
    ctx.beginPath()
    ctx.arc(x, y, lightR, 0, Math.PI * 2)
    ctx.fillStyle = state === "green" ? "#22c55e" : state === "yellow" ? "#eab308" : "#ef4444"
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 10
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(x, y, lightR + 2, 0, Math.PI * 2)
    ctx.strokeStyle = dark ? "#475569" : "#64748b"
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  // EW lights near the stop lines
  drawLight(cx - roadW / 2 - 10, cy - 8, sig.ew)
  drawLight(cx + roadW / 2 + 10, cy + 8, sig.ew)
  // NS lights near the stop lines
  drawLight(cx + 8, cy - roadW / 2 - 10, sig.ns)
  drawLight(cx - 8, cy + roadW / 2 + 10, sig.ns)
}

const spawnSignalised: SpawnFn = (cfg) => {
  const vehicles: Vehicle[] = []
  let id = 0
  const angles = [0, Math.PI, -Math.PI / 2, Math.PI / 2]
  const groups: ("ew" | "ns")[] = ["ew", "ew", "ns", "ns"]
  cfg.vehicleCounts.forEach((count, lane) => {
    for (let i = 0; i < count; i++) {
      vehicles.push({
        id: id++, x: 0, y: 0,
        angle: angles[lane],
        speed: 0.5 + Math.random() * 0.2,
        isEgo: false, lane,
        progress: 0.05 + i * 0.055, // spread out along the approach
        signalGroup: groups[lane],
      })
    }
  })
  vehicles.push({
    id: id++, x: 0, y: 0,
    angle: angles[cfg.egoLane],
    speed: 0.55,
    isEgo: true, lane: cfg.egoLane,
    progress: 0.02,
    signalGroup: groups[cfg.egoLane],
  })
  return vehicles
}

const posSignalised: PosFromProgressFn = (v, p, W, H) => {
  const cx = W / 2, cy = H / 2
  switch (v.lane) {
    case 0: return [p * W, cy - SIG_HW]       // W->E
    case 1: return [(1 - p) * W, cy + SIG_HW]  // E->W
    case 2: return [cx + SIG_HW, p * H]        // N->S
    case 3: return [cx - SIG_HW, (1 - p) * H]  // S->N
    default: return [0, 0]
  }
}

const tickSignalised: TickFn = (vehicles, frame) => {
  const sig = getSignalState(frame)
  const MOVE_SPEED = 0.006
  const CREEP_SPEED = 0.0002
  const CAR_GAP = 0.04

  // group by lane, sort by progress (leader first)
  const byLane: Record<number, Vehicle[]> = {}
  for (const v of vehicles) {
    if (!byLane[v.lane]) byLane[v.lane] = []
    byLane[v.lane].push(v)
  }

  for (const lane in byLane) {
    byLane[lane].sort((a, b) => b.progress - a.progress)

    for (let i = 0; i < byLane[lane].length; i++) {
      const v = byLane[lane][i]
      const stopP = SIG_STOP[v.lane]
      const mySignal = v.signalGroup === "ns" ? sig.ns : sig.ew
      const isRed = mySignal === "red" || mySignal === "yellow"

      // Has this car already passed the stop line?
      const pastStop = v.progress > stopP + 0.02

      // Should stop for red: only if approaching and not yet past
      const shouldStopForSignal = isRed && !pastStop && v.progress > 0

      // Check car ahead
      let blockedByCar = false
      if (i > 0) {
        const ahead = byLane[lane][i - 1]
        const gap = ahead.progress - v.progress
        if (gap < CAR_GAP) blockedByCar = true
      }

      if (blockedByCar) {
        // creep slightly to close up but not overlap
        v.progress += CREEP_SPEED
      } else if (shouldStopForSignal) {
        // decelerate as we approach the stop line, stop right at it
        const distToStop = stopP - v.progress
        if (distToStop < 0.01) {
          // hold at stop line
          v.progress += 0
        } else if (distToStop < 0.05) {
          v.progress += CREEP_SPEED * 2
        } else {
          // still approaching, slow down
          v.progress += v.speed * MOVE_SPEED * Math.min(1, distToStop / 0.1)
        }
      } else {
        v.progress += v.speed * MOVE_SPEED
      }

      if (v.progress > 1.12) v.progress = -0.08
    }
  }
}

const RING_R = 80
const ARM_OUTWARD = [Math.PI, -Math.PI / 2, 0, Math.PI / 2]
const ARM_RING_ANGLE = [Math.PI, -Math.PI / 2, 0, Math.PI / 2]

const drawRoundabout: DrawRoadsFn = (ctx, W, H) => {
  const cx = W / 2, cy = H / 2, roadW = 40
  const dark = isDark()
  ctx.fillStyle = dark ? "#1e293b" : "#f1f5f9"
  ctx.fillRect(0, 0, W, H)
  const roadColor = dark ? "#334155" : "#94a3b8"
  const markColor = dark ? "#fbbf24" : "#f59e0b"
  const lineColor = dark ? "#475569" : "#cbd5e1"

  // approach roads
  ctx.fillStyle = roadColor
  ctx.fillRect(0, cy - roadW / 2, cx - 60, roadW)
  ctx.fillRect(cx + 60, cy - roadW / 2, W - cx - 60, roadW)
  ctx.fillRect(cx - roadW / 2, 0, roadW, cy - 60)
  ctx.fillRect(cx - roadW / 2, cy + 60, roadW, H - cy - 60)

  // ring road
  ctx.beginPath()
  ctx.arc(cx, cy, RING_R, 0, Math.PI * 2)
  ctx.lineWidth = roadW
  ctx.strokeStyle = roadColor
  ctx.stroke()

  // centre island
  ctx.beginPath()
  ctx.arc(cx, cy, RING_R - roadW / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = dark ? "#1e293b" : "#f1f5f9"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, RING_R - roadW / 2 - 2, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = markColor
  ctx.stroke()

  // Direction arrow on ring (clockwise indicator)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 10])
  ctx.beginPath()
  ctx.arc(cx, cy, RING_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // yield lines at entries
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = dark ? "#e2e8f0" : "#475569"
  ctx.lineWidth = 1.5
  for (const outAngle of ARM_OUTWARD) {
    const ex = cx + Math.cos(outAngle) * (RING_R + roadW / 2)
    const ey = cy + Math.sin(outAngle) * (RING_R + roadW / 2)
    const perp = outAngle + Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(ex + Math.cos(perp) * (roadW / 2), ey + Math.sin(perp) * (roadW / 2))
    ctx.lineTo(ex - Math.cos(perp) * (roadW / 2), ey - Math.sin(perp) * (roadW / 2))
    ctx.stroke()
  }
  ctx.setLineDash([])
}

const spawnRoundabout: SpawnFn = (cfg) => {
  const vehicles: Vehicle[] = []
  let id = 0

  for (let arm = 0; arm < 4; arm++) {
    const count = cfg.vehicleCounts[arm] || 3
    for (let i = 0; i < count; i++) {
      // Each vehicle will travel 1-3 exits around the ring (clockwise)
      const exitsToTravel = 1 + Math.floor(Math.random() * 3)
      const ringArc = (exitsToTravel / 4) * Math.PI * 2

      // initial angle: pointing inward toward centre (opposite of outward)
      const initAngle = ARM_OUTWARD[arm] + Math.PI

      vehicles.push({
        id: id++, x: 0, y: 0,
        angle: initAngle,
        speed: 0.5 + Math.random() * 0.3,
        isEgo: false, lane: arm,
        progress: -(0.05 + i * 0.18),
        phase: "approach",
        arm,
        ringEntry: ARM_RING_ANGLE[arm],
        ringArc,
      })
    }
  }

  // Ego: enters from west, exits east (PI around the ring clockwise)
  vehicles.push({
    id: id++, x: 0, y: 0,
    angle: 0, // pointing right (toward centre from west)
    speed: 0.6,
    isEgo: true, lane: 0,
    progress: -0.15,
    phase: "approach",
    arm: 0,
    ringEntry: ARM_RING_ANGLE[0], // PI
    ringArc: Math.PI,             // half circle clockwise to 0 (east)
  })
  return vehicles
}

/** Get x,y on the roundabout given a vehicle and its progress within its current phase */
function roundaboutPos(v: Vehicle, W: number, H: number): [number, number] {
  const cx = W / 2, cy = H / 2
  const arm = v.arm ?? 0
  const outAngle = ARM_OUTWARD[arm]
  const ringConnect = RING_R + 20

  if (v.phase === "approach") {
    const p = Math.max(0, Math.min(1, v.progress))
    // Start far out along the arm, end at the ring connection
    const farDist = ringConnect + 100
    const dist = farDist - p * (farDist - ringConnect)
    return [cx + Math.cos(outAngle) * dist, cy + Math.sin(outAngle) * dist]
  }

  if (v.phase === "ring") {
    const entryAngle = v.ringEntry ?? 0
    const arc = v.ringArc ?? Math.PI
    const p = Math.max(0, Math.min(1, v.progress))
    // Clockwise = decreasing angle in standard math coords
    const angle = entryAngle - p * arc
    return [cx + Math.cos(angle) * RING_R, cy + Math.sin(angle) * RING_R]
  }

  if (v.phase === "exit") {
    const entryAngle = v.ringEntry ?? 0
    const arc = v.ringArc ?? Math.PI
    const exitAngleOnRing = entryAngle - arc
    const p = Math.max(0, Math.min(1, v.progress))
    const dist = ringConnect + p * 100
    return [cx + Math.cos(exitAngleOnRing) * dist, cy + Math.sin(exitAngleOnRing) * dist]
  }

  return [cx, cy]
}

const posRoundabout: PosFromProgressFn = (v, _p, W, H) => {
  return roundaboutPos(v, W, H)
}

const tickRoundabout: TickFn = (vehicles, _frame, W, H) => {
  const SPEED = 0.007

  for (const v of vehicles) {
    const spd = v.speed * SPEED

    if (v.phase === "approach") {
      v.progress += spd
      if (v.progress >= 1.0) {
        v.phase = "ring"
        v.progress = 0
      }
    } else if (v.phase === "ring") {
      v.progress += spd
      if (v.progress >= 1.0) {
        v.phase = "exit"
        v.progress = 0
      }
    } else if (v.phase === "exit") {
      v.progress += spd
      if (v.progress >= 1.0) {
        v.phase = "approach"
        v.progress = -(0.05 + Math.random() * 0.2)
        v.ringArc = ((1 + Math.floor(Math.random() * 3)) / 4) * Math.PI * 2
      }
    }

    // Compute angle from direction of travel
    const [curX, curY] = roundaboutPos(v, W, H)

    // Use a small look-ahead within the SAME phase to avoid jumps
    const lookP = Math.min(v.progress + 0.02, 0.99)
    const lookV = { ...v, progress: lookP }
    // Only look ahead within same phase (don't cross phase boundaries)
    const [nextX, nextY] = roundaboutPos(lookV, W, H)

    const dx = nextX - curX
    const dy = nextY - curY
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      v.angle = Math.atan2(dy, dx)
    }
  }
}

const HW_LANE_H = 34
const HW_TOTAL_H = HW_LANE_H * 3
const HW_MERGE_X_FRAC = 0.55

const drawHighwayMerge: DrawRoadsFn = (ctx, W, H) => {
  const dark = isDark()
  ctx.fillStyle = dark ? "#1e293b" : "#f1f5f9"
  ctx.fillRect(0, 0, W, H)
  const roadColor = dark ? "#334155" : "#94a3b8"
  const lineColor = dark ? "#475569" : "#cbd5e1"
  const markColor = dark ? "#fbbf24" : "#f59e0b"

  const cy = H / 2
  const mergeX = W * HW_MERGE_X_FRAC

  // main highway (3 lanes)
  ctx.fillStyle = roadColor
  ctx.fillRect(0, cy - HW_TOTAL_H / 2, W, HW_TOTAL_H)

  // lane dividers
  ctx.setLineDash([12, 8])
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, cy - HW_LANE_H / 2); ctx.lineTo(W, cy - HW_LANE_H / 2)
  ctx.moveTo(0, cy + HW_LANE_H / 2); ctx.lineTo(W, cy + HW_LANE_H / 2)
  ctx.stroke()
  ctx.setLineDash([])

  // on-ramp curve
  const rampStartY = H - 40
  const rampW = HW_LANE_H
  const bottomEdge = cy + HW_TOTAL_H / 2

  ctx.beginPath()
  ctx.moveTo(0, rampStartY - rampW / 2)
  ctx.lineTo(W * 0.12, rampStartY - rampW / 2)
  ctx.bezierCurveTo(
    W * 0.28, rampStartY - rampW / 2,
    W * 0.40, bottomEdge + 15,
    mergeX, bottomEdge
  )
  // bottom edge of ramp
  ctx.lineTo(mergeX, bottomEdge + 1)
  ctx.bezierCurveTo(
    W * 0.40, bottomEdge + 15 + rampW,
    W * 0.28, rampStartY + rampW / 2,
    W * 0.12, rampStartY + rampW / 2
  )
  ctx.lineTo(0, rampStartY + rampW / 2)
  ctx.closePath()
  ctx.fillStyle = roadColor
  ctx.fill()

  // merge zone dashes
  ctx.setLineDash([5, 7])
  ctx.strokeStyle = markColor
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(mergeX - 15, bottomEdge)
  ctx.lineTo(mergeX + 50, bottomEdge)
  ctx.stroke()
  ctx.setLineDash([])

  // highway edge lines
  ctx.strokeStyle = dark ? "#e2e8f0" : "#475569"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, cy - HW_TOTAL_H / 2); ctx.lineTo(W, cy - HW_TOTAL_H / 2)
  ctx.moveTo(mergeX + 50, bottomEdge); ctx.lineTo(W, bottomEdge)
  ctx.stroke()
}

const spawnHighwayMerge: SpawnFn = (cfg) => {
  const vehicles: Vehicle[] = []
  let id = 0
  cfg.vehicleCounts.forEach((count, lane) => {
    for (let i = 0; i < count; i++) {
      vehicles.push({
        id: id++, x: 0, y: 0,
        angle: 0,
        speed: 0.5 + Math.random() * 0.2, // all lanes similar speed
        isEgo: false, lane,
        progress: -(Math.random() * 0.3),
      })
    }
  })
  vehicles.push({
    id: id++, x: 0, y: 0,
    angle: 0,
    speed: 0.55,
    isEgo: true, lane: 0,
    progress: -0.1,
  })
  return vehicles
}

/** Compute position along the ramp bezier at parameter t (0..1) */
function rampPoint(t: number, W: number, H: number): [number, number] {
  const cy = H / 2
  const bottomEdge = cy + HW_TOTAL_H / 2
  const rampStartY = H - 40
  const mergeX = W * HW_MERGE_X_FRAC

  // The ramp has two segments: straight (t=0..0.15) then curve (t=0.15..1)
  if (t < 0.15) {
    const lt = t / 0.15
    return [lt * W * 0.12, rampStartY]
  }

  // Cubic bezier from (W*0.12, rampStartY) to (mergeX, bottomEdge)
  const bt = (t - 0.15) / 0.85
  const p0x = W * 0.12, p0y = rampStartY
  const p1x = W * 0.28, p1y = rampStartY
  const p2x = W * 0.40, p2y = bottomEdge + 15 + HW_LANE_H / 2
  const p3x = mergeX, p3y = bottomEdge

  const omt = 1 - bt
  const x = omt * omt * omt * p0x + 3 * omt * omt * bt * p1x + 3 * omt * bt * bt * p2x + bt * bt * bt * p3x
  const y = omt * omt * omt * p0y + 3 * omt * omt * bt * p1y + 3 * omt * bt * bt * p2y + bt * bt * bt * p3y
  return [x, y]
}

const posHighwayMerge: PosFromProgressFn = (v, p, W, H) => {
  const cy = H / 2
  const mergeX = W * HW_MERGE_X_FRAC

  if (v.lane === 0) {
    // ramp phase then highway phase
    if (p < 0.6) {
      return rampPoint(p / 0.6, W, H)
    }
    // merged onto bottom highway lane
    const t = (p - 0.6) / 0.4
    return [mergeX + t * (W - mergeX), cy + HW_LANE_H]
  }
  // highway lanes
  switch (v.lane) {
    case 1: return [p * W, cy + HW_LANE_H]    // bottom
    case 2: return [p * W, cy]                 // middle
    case 3: return [p * W, cy - HW_LANE_H]    // top
    default: return [0, 0]
  }
}

interface TopologyRenderer {
  draw: DrawRoadsFn
  pos: PosFromProgressFn
  spawn: SpawnFn
  tick?: TickFn
}

const TOPOLOGY_RENDERERS: Record<TopologyId, TopologyRenderer> = {
  intersection: { draw: drawIntersection, pos: posIntersection, spawn: spawnIntersection },
  signalised: { draw: drawSignalised, pos: posSignalised, spawn: spawnSignalised, tick: tickSignalised },
  roundabout: { draw: drawRoundabout, pos: posRoundabout, spawn: spawnRoundabout, tick: tickRoundabout },
  "highway-merge": { draw: drawHighwayMerge, pos: posHighwayMerge, spawn: spawnHighwayMerge },
}

function useTrafficAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  topologyId: TopologyId,
) {
  const vehiclesRef = useRef<Vehicle[]>([])
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 600, H = 400
    canvas.width = W
    canvas.height = H

    const renderer = TOPOLOGY_RENDERERS[topologyId]
    const cfg = TOPOLOGIES.find(t => t.id === topologyId)!
    vehiclesRef.current = renderer.spawn(cfg)
    frameRef.current = 0

    function drawVehicle(v: Vehicle) {
      const [x, y] = renderer.pos(v, v.progress, W, H)
      v.x = x; v.y = y
      const dark = isDark()

      ctx!.save()
      ctx!.translate(x, y)

      // For highway-merge, compute angle from movement direction
      if (topologyId === "highway-merge") {
        // Create a shallow copy to avoid mutating the vehicle for look-ahead
        const lookV = { ...v, progress: v.progress + 0.01 }
        const [nx, ny] = renderer.pos(lookV, lookV.progress, W, H)
        const dx = nx - x, dy = ny - y
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          v.angle = Math.atan2(dy, dx)
        }
      }
      // For roundabout, angle is already set in tickRoundabout

      ctx!.rotate(v.angle)

      if (v.isEgo) {
        ctx!.fillStyle = "#ef4444"
        ctx!.shadowColor = "#ef4444"
        ctx!.shadowBlur = 12
      } else {
        ctx!.fillStyle = dark ? "#60a5fa" : "#3b82f6"
        ctx!.shadowBlur = 0
      }

      const vl = 14, vw = 8
      ctx!.beginPath()
      ctx!.roundRect(-vl / 2, -vw / 2, vl, vw, 2)
      ctx!.fill()
      ctx!.shadowBlur = 0

      if (v.isEgo) {
        ctx!.strokeStyle = "rgba(239,68,68,0.15)"
        ctx!.lineWidth = 1
        for (let a = -0.8; a <= 0.8; a += 0.2) {
          ctx!.beginPath()
          ctx!.moveTo(vl / 2, 0)
          ctx!.lineTo(vl / 2 + 50 * Math.cos(a), 50 * Math.sin(a))
          ctx!.stroke()
        }
        ctx!.beginPath()
        ctx!.arc(vl / 2, 0, 50, -0.8, 0.8)
        ctx!.strokeStyle = "rgba(239,68,68,0.25)"
        ctx!.stroke()
      }

      ctx!.restore()
    }

    let animId: number
    function tick() {
      renderer.draw(ctx!, W, H, frameRef.current)

      if (renderer.tick) {
        renderer.tick(vehiclesRef.current, frameRef.current, W, H)
      } else {
        for (const v of vehiclesRef.current) {
          v.progress += v.speed * 0.004
          if (v.progress > 1.1) v.progress = -0.1
        }
      }

      for (const v of vehiclesRef.current) {
        drawVehicle(v)
      }

      frameRef.current++
      animId = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(animId)
  }, [canvasRef, topologyId])
}

export function TrafficSection({ topology, onTopologyChange }: {
  topology?: TopologyId
  onTopologyChange?: (id: TopologyId) => void
}) {
  const [localTopology, setLocalTopology] = useState<TopologyId>("intersection")
  const activeTopology = topology ?? localTopology
  const setTopology = onTopologyChange ?? setLocalTopology

  const canvasRef = useRef<HTMLCanvasElement>(null)
  useTrafficAnimation(canvasRef, activeTopology)

  const cfg = TOPOLOGIES.find(t => t.id === activeTopology)!

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-blue-500" />
          <CardTitle>Traffic Simulation (SUMO)</CardTitle>
          <Badge variant="secondary" className="ml-auto">Microscopic</Badge>
        </div>
        <CardDescription>
          Vehicle-level traffic simulation with synthetic LiDAR generation.
          The red ego vehicle carries a {cfg.lidarRays === "360" ? "360" : "180"}-ray LiDAR scanner producing Carmen-format logs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            Road Topology
          </label>
          <Select value={activeTopology} onValueChange={(v) => setTopology(v as TopologyId)}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPOLOGIES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <h4 className="text-sm font-medium">Simulation Parameters</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono">{cfg.network}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono">{cfg.duration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Step size</span>
                  <span className="font-mono">{cfg.stepSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LiDAR rays</span>
                  <span className="font-mono">{cfg.lidarRays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scans output</span>
                  <span className="font-mono">{cfg.scansOutput}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium">Scenario</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {cfg.description}
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium">Legend</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-red-500" />
                  <span>Ego vehicle (LiDAR equipped)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-blue-500" />
                  <span>Traffic vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="h-3 w-3 text-red-400" />
                  <span>LiDAR scan cone</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-amber-500" />
                  <span>Signalised junction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { TOPOLOGIES }
export type { TopologyConfig }
