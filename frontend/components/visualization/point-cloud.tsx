"use client"

import { memo, useEffect, useRef } from "react"
import * as THREE from "three"

interface PointCloudProps {
  points: Float32Array | null // 4 floats per point: x, y, z, classification
  visible: boolean
}

/*
 * Optimized point cloud with classification-based coloring.
 *
 * Uses a fixed-capacity buffer allocated once and re-filled on each frame
 * change via setDrawRange — avoids creating new Float32Arrays / BufferAttributes
 * every frame (major GC pressure reduction).
 *
 * Classification channel (4th float):
 *  -1 = padding (hidden)
 *   0 = ground (dark road gray)
 *   1 = low objects (blue gradient)
 *   2 = high objects (warm gradient)
 */
const MAX_POINTS = 15000

export const PointCloud = memo(function PointCloud({ points, visible }: PointCloudProps) {
  const geoRef = useRef<THREE.BufferGeometry>(null)
  const initialized = useRef(false)

  useEffect(() => {
    const g = geoRef.current
    if (!g || !points) return

    const count = points.length / 4
    if (count <= 0) return

    // Lazily create fixed-size buffer attributes once
    if (!initialized.current) {
      const capacity = Math.max(count, MAX_POINTS)
      g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3))
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3))
      initialized.current = true
    }

    const posAttr = g.getAttribute("position") as THREE.BufferAttribute
    const colAttr = g.getAttribute("color") as THREE.BufferAttribute
    const positions = posAttr.array as Float32Array
    const colors = colAttr.array as Float32Array

    let visibleCount = 0
    for (let i = 0; i < count; i++) {
      const x = points[i * 4]
      const y = points[i * 4 + 1]
      const z = points[i * 4 + 2]
      const cls = points[i * 4 + 3]

      if (cls < 0) continue

      const idx = visibleCount * 3
      positions[idx] = x
      positions[idx + 1] = y
      positions[idx + 2] = z

      if (cls === 0) {
        const v = 0.25 + Math.random() * 0.08
        colors[idx] = v
        colors[idx + 1] = v
        colors[idx + 2] = v + 0.03
      } else if (cls === 1) {
        const t = Math.max(0, Math.min(1, y / 2.0))
        colors[idx] = 0.1 + t * 0.2
        colors[idx + 1] = 0.5 + t * 0.3
        colors[idx + 2] = 0.9 - t * 0.2
      } else {
        const t = Math.max(0, Math.min(1, (y - 2) / 4.0))
        colors[idx] = 0.9 + t * 0.1
        colors[idx + 1] = 0.5 - t * 0.2
        colors[idx + 2] = 0.1
      }

      visibleCount++
    }

    // Update draw range instead of replacing buffers
    g.setDrawRange(0, visibleCount)
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    g.computeBoundingSphere()
  }, [points])

  if (!points) return null

  return (
    <points visible={visible} frustumCulled={false}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial
        size={0.06}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  )
})
