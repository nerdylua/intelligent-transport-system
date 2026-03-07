"use client"

import { memo, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import type { Pose } from "@/hooks/use-scene-data"

interface TrajectoryLineProps {
  trajectory: Pose[]
  currentFrame: number
  visible: boolean
}

const HALF_WIDTH = 0.9 // half the ego vehicle width (~1.8m)
const PAST_COLOR = new THREE.Color("#3b82f6")
const FUTURE_COLOR = new THREE.Color("#3b82f6")

/**
 * Build a flat ribbon mesh from trajectory points.
 * For each segment, we offset left/right perpendicular to the travel direction
 * to create a strip with the car's width. This makes the trajectory look like
 * a lane/path rather than a thin wire, preventing objects from visually
 * intersecting it.
 */
function buildRibbonGeometry(
  points: [number, number, number][],
  halfWidth: number,
): { positions: Float32Array; indices: Uint32Array; uvs: Float32Array } | null {
  const n = points.length
  if (n < 2) return null

  const positions = new Float32Array(n * 2 * 3) // 2 vertices per point (left/right), 3 components
  const uvs = new Float32Array(n * 2 * 2)
  const indices = new Uint32Array((n - 1) * 6) // 2 triangles per segment

  let cumulativeLen = 0

  for (let i = 0; i < n; i++) {
    // Compute tangent direction
    let dx: number, dz: number
    if (i === 0) {
      dx = points[1][0] - points[0][0]
      dz = points[1][2] - points[0][2]
    } else if (i === n - 1) {
      dx = points[n - 1][0] - points[n - 2][0]
      dz = points[n - 1][2] - points[n - 2][2]
    } else {
      dx = points[i + 1][0] - points[i - 1][0]
      dz = points[i + 1][2] - points[i - 1][2]
    }

    // Normalize tangent
    const len = Math.sqrt(dx * dx + dz * dz) || 1
    dx /= len
    dz /= len

    // Perpendicular (rotate 90 degrees)
    const nx = -dz
    const nz = dx

    const y = points[i][1]
    const x = points[i][0]
    const z = points[i][2]

    // Left vertex
    const li = i * 2
    positions[li * 3] = x + nx * halfWidth
    positions[li * 3 + 1] = y
    positions[li * 3 + 2] = z + nz * halfWidth

    // Right vertex
    const ri = li + 1
    positions[ri * 3] = x - nx * halfWidth
    positions[ri * 3 + 1] = y
    positions[ri * 3 + 2] = z - nz * halfWidth

    // Cumulative length for UV mapping
    if (i > 0) {
      const segDx = points[i][0] - points[i - 1][0]
      const segDz = points[i][2] - points[i - 1][2]
      cumulativeLen += Math.sqrt(segDx * segDx + segDz * segDz)
    }

    const u = cumulativeLen * 0.5
    uvs[li * 2] = u; uvs[li * 2 + 1] = 0
    uvs[ri * 2] = u; uvs[ri * 2 + 1] = 1
  }

  // Build triangle indices
  for (let i = 0; i < n - 1; i++) {
    const base = i * 6
    const tl = i * 2
    const tr = tl + 1
    const bl = (i + 1) * 2
    const br = bl + 1

    indices[base] = tl
    indices[base + 1] = bl
    indices[base + 2] = tr
    indices[base + 3] = tr
    indices[base + 4] = bl
    indices[base + 5] = br
  }

  return { positions, indices, uvs }
}

const RibbonMesh = memo(function RibbonMesh({
  points,
  color,
  opacity,
  dashed,
}: {
  points: [number, number, number][]
  color: THREE.Color
  opacity: number
  dashed?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const geoRef = useRef<THREE.BufferGeometry>(null)

  const ribbon = useMemo(() => buildRibbonGeometry(points, HALF_WIDTH), [points])

  useEffect(() => {
    const g = geoRef.current
    if (!g || !ribbon) return
    g.setAttribute("position", new THREE.Float32BufferAttribute(ribbon.positions, 3))
    g.setAttribute("uv", new THREE.Float32BufferAttribute(ribbon.uvs, 2))
    g.setIndex(new THREE.BufferAttribute(ribbon.indices, 1))
    g.computeVertexNormals()
    g.computeBoundingSphere()
  }, [ribbon])

  if (!ribbon || points.length < 2) return null

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <bufferGeometry ref={geoRef} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={dashed ? opacity * 0.4 : opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
})

/**
 * Center-line drawn over the ribbon for a cleaner look
 */
import { Line } from "@react-three/drei"

const CenterLine = memo(function CenterLine({
  points,
  color,
  lineWidth,
  opacity,
  dashed,
}: {
  points: [number, number, number][]
  color: string
  lineWidth: number
  opacity: number
  dashed?: boolean
}) {
  if (points.length < 2) return null

  // Raise center line slightly above ribbon
  const raised = useMemo(() =>
    points.map((p): [number, number, number] => [p[0], p[1] + 0.01, p[2]]),
    [points]
  )

  return (
    <Line
      points={raised}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      {...(dashed ? { dashed: true, dashSize: 0.4, gapSize: 0.3 } : {})}
    />
  )
})

/*
 * Optimized trajectory rendering with a flat ribbon mesh showing the vehicle's
 * width, plus a center line for clarity. Split into past (solid) and future (dashed).
 */
export const TrajectoryLine = memo(function TrajectoryLine({
  trajectory,
  currentFrame,
  visible,
}: TrajectoryLineProps) {
  // Pre-compute ALL points once (only recompute when trajectory ref changes)
  // Raised to y=0.12 to sit above ground geometry and avoid z-fighting
  const allPoints = useMemo(() => {
    return trajectory.map(
      (p): [number, number, number] => [p.x, 0.12, p.z],
    )
  }, [trajectory])

  // Split into past and future based on current frame
  const pastPoints = useMemo(() => {
    if (currentFrame < 1) return null
    return allPoints.slice(0, currentFrame + 1)
  }, [allPoints, currentFrame])

  const futurePoints = useMemo(() => {
    if (currentFrame >= allPoints.length - 1) return null
    return allPoints.slice(currentFrame)
  }, [allPoints, currentFrame])

  if (!visible) return null

  return (
    <group>
      {/* Past path — solid ribbon + center line */}
      {pastPoints && pastPoints.length >= 2 && (
        <>
          <RibbonMesh points={pastPoints} color={PAST_COLOR} opacity={0.18} />
          <CenterLine points={pastPoints} color="#3b82f6" lineWidth={2.5} opacity={0.9} />
        </>
      )}
      {/* Future path — dashed / translucent */}
      {futurePoints && futurePoints.length >= 2 && (
        <>
          <RibbonMesh points={futurePoints} color={FUTURE_COLOR} opacity={0.08} dashed />
          <CenterLine points={futurePoints} color="#3b82f6" lineWidth={1.5} opacity={0.3} dashed />
        </>
      )}
    </group>
  )
})
