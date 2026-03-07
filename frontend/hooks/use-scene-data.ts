"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface Pose {
  x: number
  y: number
  z: number
  yaw: number
}

export interface SceneMetrics {
  speed: number
  acceleration: number
  wheelAngle: number
}

export interface SceneObject {
  label: string
  x: number
  y: number
  z: number
  w: number
  h: number
  l: number
  yaw?: number
}

export interface ManifestEntry {
  id: string
  drive: string
  label: string
  path: string
}

export interface SceneData {
  sequenceId: string
  drive: string
  label: string
  frameCount: number
  fps: number
  duration: number
  pointsPerFrame: number
  hasCamera: boolean
  trajectory: Pose[]
  metrics: SceneMetrics[]
  objects: SceneObject[][]
}

export interface UseSceneDataReturn {
  data: SceneData | null
  loading: boolean
  error: string | null
  getFramePoints: (frame: number) => Float32Array | null
  manifest: ManifestEntry[]
  activeSequence: string | null
  setActiveSequence: (id: string) => void
  cameraUrl: string | null
}

export function useSceneData(): UseSceneDataReturn {
  const [manifest, setManifest] = useState<ManifestEntry[]>([])
  const [activeSequence, setActiveSequenceState] = useState<string | null>(null)
  const [data, setData] = useState<SceneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pcBuffer = useRef<ArrayBuffer | null>(null)
  const floatsPerFrame = useRef(0)
  const cameraUrl = useRef<string | null>(null)

  useEffect(() => {
    fetch("/data/kitti/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error("manifest.json not found")
        return r.json()
      })
      .then((m: ManifestEntry[]) => {
        setManifest(m)
        if (m.length > 0 && !activeSequence) {
          // default to the longest sequence
          const longest = m.reduce((a, b) => (a.id > b.id ? a : b))
          setActiveSequenceState(longest.id)
        }
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeSequence || manifest.length === 0) return

    const entry = manifest.find((m) => m.id === activeSequence)
    if (!entry) return

    setLoading(true)
    setError(null)
    setData(null)
    pcBuffer.current = null

    const basePath = entry.path

    Promise.all([
      fetch(`${basePath}/scene.json`).then((r) => {
        if (!r.ok) throw new Error(`scene.json not found for ${entry.drive}`)
        return r.json()
      }),
      fetch(`${basePath}/pointclouds.bin`).then((r) => {
        if (!r.ok) throw new Error(`pointclouds.bin not found for ${entry.drive}`)
        return r.arrayBuffer()
      }),
    ])
      .then(([scene, buf]: [SceneData, ArrayBuffer]) => {
        pcBuffer.current = buf
        floatsPerFrame.current = scene.pointsPerFrame * 4

        // Check if camera video exists
        cameraUrl.current = scene.hasCamera
          ? `${basePath}/camera.mp4`
          : null

        setData(scene)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [activeSequence, manifest])

  const getFramePoints = useCallback(
    (frame: number): Float32Array | null => {
      if (!pcBuffer.current || floatsPerFrame.current === 0) return null
      const offset = frame * floatsPerFrame.current * 4
      const len = floatsPerFrame.current * 4
      if (offset + len > pcBuffer.current.byteLength) return null
      return new Float32Array(pcBuffer.current, offset, floatsPerFrame.current)
    },
    [],
  )

  const setActiveSequence = useCallback((id: string) => {
    setActiveSequenceState(id)
  }, [])

  return {
    data,
    loading,
    error,
    getFramePoints,
    manifest,
    activeSequence,
    setActiveSequence,
    cameraUrl: cameraUrl.current,
  }
}
