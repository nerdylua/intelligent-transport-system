"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Grid, Sky, Environment } from "@react-three/drei"
import { useCallback, useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react"
import * as THREE from "three"

import { useSceneData, type SceneData } from "@/hooks/use-scene-data"
import { usePlayback } from "@/hooks/use-playback"

import { PointCloud } from "./point-cloud"
import { VehicleModel } from "./vehicle-model"
import { TrajectoryLine } from "./trajectory-line"
import { BoundingBoxes } from "./bounding-boxes"
import { StreamPanel } from "./stream-panel"
import { PlaybackBar } from "./playback-bar"
import { CameraFeed } from "./camera-feed"
import { MetricsPanel } from "./metrics-panel"
import { GroundPlane } from "./ground-plane"

const DEFAULT_STREAMS: Record<string, boolean> = {
  vehicle: true,
  trajectory: true,
  objects: true,
  labels: true,
  lidar: true,
  camera: true,
  grid: true,
}

const STREAM_CHILDREN: Record<string, string[]> = {
  objects: ["labels"],
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  while (diff > Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  return a + diff * t
}

/**
 * Catmull-Rom spline for smoother car path interpolation.
 * Uses 4 surrounding trajectory keyframes for cubic interpolation
 * instead of simple linear lerp between 2 frames.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

/**
 * Frame-rate-independent damping.
 * Converts a fixed lerp factor to a delta-time-aware one so camera
 * smoothing behaves identically at 30fps, 60fps, or 144fps.
 */
function damp(factor: number, delta: number): number {
  return 1 - Math.pow(1 - factor, delta * 60)
}

/*
 * SceneCore — runs inside Canvas.
 *
 * All animation happens in useFrame via refs.
 * React state is only updated at ~8 Hz for UI elements.
 */
function SceneCore({
  data,
  playbackTick,
  getFramePoints,
  streams,
  onUiUpdate,
}: {
  data: SceneData
  playbackTick: (delta: number) => { frame: number; t: number }
  getFramePoints: (frame: number) => Float32Array | null
  streams: Record<string, boolean>
  onUiUpdate: (frame: number, metrics: { speed: number; acceleration: number; wheelAngle: number } | undefined) => void
}) {
  const { gl } = useThree()

  // ── Object refs ──
  const vehicleRef = useRef<THREE.Group>(null)
  const relGroupRef = useRef<THREE.Group>(null)
  const gridGroupRef = useRef<THREE.Group>(null)
  const pcRef = useRef<{ update: (pts: Float32Array | null) => void }>(null)
  const boxRef = useRef<{ update: (objs: typeof data.objects[0]) => void }>(null)

  // ── Camera state ──
  const smoothTarget = useRef(new THREE.Vector3())
  const smoothCamPos = useRef(new THREE.Vector3())
  const camInitialized = useRef(false)
  const userYawOffset = useRef(0)
  const userPitch = useRef(0.35)
  const userDistance = useRef(22)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // ── Animation cache ──
  const lastFrame = useRef(-1)
  const lastUiUpdate = useRef(0)
  const interpPos = useRef(new THREE.Vector3())
  const interpYaw = useRef(0)
  const [renderFrame, setRenderFrame] = useState(0)

  // ── Reusable temp vectors (avoid per-frame allocations → reduces GC jitter) ──
  const _tmpDesiredTarget = useRef(new THREE.Vector3())
  const _tmpIdealCamPos = useRef(new THREE.Vector3())

  // ── Pre-cache all point cloud frames for instant switching ──
  const pointCloudCache = useMemo(() => {
    const cache = new Map<number, Float32Array | null>()
    for (let i = 0; i < data.frameCount; i++) {
      cache.set(i, getFramePoints(i))
    }
    return cache
  }, [data.frameCount, getFramePoints])

  // Reset camera and animation state when sequence data changes
  useEffect(() => {
    camInitialized.current = false
    lastFrame.current = -1
    userYawOffset.current = 0
    userPitch.current = 0.35
    userDistance.current = 22
  }, [data])

  // Mouse handlers for camera orbit
  useEffect(() => {
    const canvas = gl.domElement
    // Use an independent DOM query for cursor styling to satisfy react-hooks/immutability
    // (the linter traces canvas.style mutations back to the gl hook return value)
    const setCursor = (c: string) => {
      const el = document.querySelector<HTMLCanvasElement>("canvas")
      if (el) el.style.cursor = c
    }
    const onDown = (e: PointerEvent) => { if (e.button === 0) { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; setCursor("grabbing") } }
    const onMove = (e: PointerEvent) => { if (!isDragging.current) return; const dx = e.clientX - lastMouse.current.x; const dy = e.clientY - lastMouse.current.y; lastMouse.current = { x: e.clientX, y: e.clientY }; userYawOffset.current -= dx * 0.005; userPitch.current = Math.max(0.05, Math.min(1.2, userPitch.current - dy * 0.004)) }
    const onUp = () => { isDragging.current = false; setCursor("grab") }
    const onDblClick = () => { userYawOffset.current = 0; userPitch.current = 0.35; userDistance.current = 22 }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); userDistance.current = Math.max(8, Math.min(60, userDistance.current + e.deltaY * 0.03)) }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointerleave", onUp); canvas.addEventListener("dblclick", onDblClick); canvas.addEventListener("wheel", onWheel, { passive: false }); setCursor("grab")
    return () => { canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointerleave", onUp); canvas.removeEventListener("dblclick", onDblClick); canvas.removeEventListener("wheel", onWheel) }
  }, [gl])

  useFrame(({ camera }, delta) => {
    // Clamp delta to avoid huge jumps when tab is backgrounded
    const dt = Math.min(delta, 0.05)

    // ── 1. Advance playback clock ──
    const { frame, t } = playbackTick(dt)

    // ── 2. Interpolate ego car pose using Catmull-Rom spline ──
    const traj = data.trajectory
    const fc = data.frameCount
    const i0 = Math.max(frame - 1, 0)
    const i1 = frame
    const i2 = Math.min(frame + 1, fc - 1)
    const i3 = Math.min(frame + 2, fc - 1)
    const p0 = traj[i0], p1 = traj[i1], p2 = traj[i2], p3 = traj[i3]

    if (p1 && p2) {
      interpPos.current.set(
        catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        0,
        catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      )
      interpYaw.current = lerpAngle(p1.yaw, p2.yaw, t)
    }

    // ── 3. Position objects directly via refs ──
    if (vehicleRef.current) {
      vehicleRef.current.position.copy(interpPos.current)
      vehicleRef.current.rotation.set(0, interpYaw.current, 0)
    }
    if (relGroupRef.current) {
      relGroupRef.current.position.copy(interpPos.current)
      relGroupRef.current.rotation.set(0, interpYaw.current, 0)
    }
    if (gridGroupRef.current) {
      gridGroupRef.current.position.set(interpPos.current.x, 0.01, interpPos.current.z)
    }

    // ── 4. Update point cloud / objects only when frame changes ──
    if (frame !== lastFrame.current) {
      lastFrame.current = frame
      if (pcRef.current) pcRef.current.update(pointCloudCache.get(frame) ?? null)
      if (boxRef.current) boxRef.current.update(data.objects[frame] ?? [])
    }

    // ── 5. Camera: third-person chase with frame-rate-independent damping ──
    const pos = interpPos.current
    const desiredTarget = _tmpDesiredTarget.current.set(pos.x, 1.2, pos.z)

    const dist = userDistance.current
    const pitch = userPitch.current
    const totalYaw = interpYaw.current + userYawOffset.current
    const idealCamPos = _tmpIdealCamPos.current.set(
      pos.x - Math.sin(totalYaw) * dist * Math.cos(pitch),
      10 + dist * Math.sin(pitch),
      pos.z - Math.cos(totalYaw) * dist * Math.cos(pitch),
    )

    if (!camInitialized.current) {
      smoothCamPos.current.copy(idealCamPos)
      smoothTarget.current.copy(desiredTarget)
      camera.position.copy(idealCamPos)
      camera.lookAt(desiredTarget)
      camInitialized.current = true
    } else {
      // Use delta-time-aware damping so smoothing is consistent across frame rates
      const camDamp = damp(0.12, dt)
      const targetDamp = damp(0.15, dt)
      smoothCamPos.current.lerp(idealCamPos, camDamp)
      smoothTarget.current.lerp(desiredTarget, targetDamp)
      camera.position.copy(smoothCamPos.current)
      camera.lookAt(smoothTarget.current)
    }

    // ── 6. Throttled UI update (~8 Hz) ──
    const now = performance.now()
    if (now - lastUiUpdate.current > 120) {
      lastUiUpdate.current = now
      setRenderFrame(frame)
      onUiUpdate(frame, data.metrics[frame])
    }
  })

  return (
    <>
      <color attach="background" args={["#0f0f1a"]} />
      <fog attach="fog" args={["#0f0f1a", 80, 200]} />
      <Environment preset="city" background={false} />
      <Sky distance={450000} sunPosition={[100, 40, 100]} inclination={0.52} azimuth={0.25} turbidity={8} rayleigh={0.5} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 30]} intensity={1.0} color="#fef3c7" castShadow />
      <directionalLight position={[-30, 50, -20]} intensity={0.3} color="#e0e7ff" />
      <GroundPlane visible />

      {streams.grid && (
        <group ref={gridGroupRef}>
          <Grid args={[300, 300]} cellSize={2} cellThickness={0.4} cellColor="#1a1a30" sectionSize={10} sectionThickness={0.8} sectionColor="#252540" fadeDistance={80} infiniteGrid />
        </group>
      )}

      {streams.trajectory && (
        <TrajectoryLine trajectory={data.trajectory} currentFrame={renderFrame} visible />
      )}

      {/* Ego vehicle — positioned by useFrame */}
      <group ref={vehicleRef} visible={streams.vehicle}>
        <VehicleModel />
      </group>

      {/* Vehicle-relative group (LiDAR + objects) — positioned by useFrame */}
      <group ref={relGroupRef}>
        <ImperativePointCloud ref={pcRef} visible={streams.lidar} />
        <ImperativeBoundingBoxes ref={boxRef} visible={streams.objects} showLabels={streams.labels} />
      </group>
    </>
  )
}

/*
 * ImperativePointCloud — updates via ref.update() instead of React props.
 * Uses a ref to hold data and a counter to force re-render only when needed.
 */
const ImperativePointCloud = forwardRef<
  { update: (pts: Float32Array | null) => void },
  { visible: boolean }
>(function ImperativePointCloud({ visible }, ref) {
  const [pts, setPts] = useState<Float32Array | null>(null)
  useImperativeHandle(ref, () => ({
    update: (newPts: Float32Array | null) => {
      setPts(newPts)
    }
  }), [])
  return <PointCloud points={pts} visible={visible} />
})

const ImperativeBoundingBoxes = forwardRef<
  { update: (objs: Array<{ label: string; x: number; y: number; z: number; w: number; h: number; l: number; yaw?: number }>) => void },
  { visible: boolean; showLabels: boolean }
>(function ImperativeBoundingBoxes({ visible, showLabels }, ref) {
  const [boxes, setBoxes] = useState<Array<{ label: string; x: number; y: number; z: number; w: number; h: number; l: number; yaw?: number }>>([])
  useImperativeHandle(ref, () => ({
    update: (objs: Array<{ label: string; x: number; y: number; z: number; w: number; h: number; l: number; yaw?: number }>) => {
      setBoxes(objs)
    }
  }), [])
  return <BoundingBoxes boxes={boxes} visible={visible} showLabels={showLabels} />
})

/* ── Sequence selector ── */
function SequenceSelector({ manifest, active, onChange }: { manifest: { id: string; label: string }[]; active: string | null; onChange: (id: string) => void }) {
  if (manifest.length <= 1) return null
  return (
    <div className="absolute top-4 left-56 z-20">
      <select value={active ?? ""} onChange={(e) => onChange(e.target.value)} className="bg-black/75 backdrop-blur-xl border border-white/10 text-white text-xs font-mono rounded-lg px-3 py-2 shadow-2xl outline-none focus:border-blue-500/50 cursor-pointer appearance-none pr-7"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
        {manifest.map((m) => <option key={m.id} value={m.id} className="bg-zinc-900">{m.label}</option>)}
      </select>
    </div>
  )
}

/*
 * Loading screen with progress bar — shown while scene data loads
 * and while Three.js compiles shaders / warms up the GPU pipeline.
 */
function LoadingScreen({ message, progress }: { message: string; progress?: number }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center w-64">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500 mb-3" />
        <p className="text-sm text-zinc-500 mb-3">{message}</p>
        {progress !== undefined && (
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AVScene() {
  const { data, loading, error, getFramePoints, manifest, activeSequence, setActiveSequence, cameraUrl } = useSceneData()
  const playback = usePlayback(data?.frameCount ?? 0, data?.fps ?? 10)
  const [streams, setStreams] = useState(DEFAULT_STREAMS)
  const [sceneReady, setSceneReady] = useState(false)

  // UI-only state (throttled from SceneCore)
  const [, setUiFrame] = useState(0)
  const [uiMetrics, setUiMetrics] = useState<{ speed: number; acceleration: number; wheelAngle: number } | undefined>()

  const onUiUpdate = useCallback((frame: number, metrics: { speed: number; acceleration: number; wheelAngle: number } | undefined) => {
    setUiFrame(frame)
    setUiMetrics(metrics)
  }, [])

  const toggleStream = useCallback((key: string) => {
    setStreams((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      const children = STREAM_CHILDREN[key]
      if (children) children.forEach((c) => { next[c] = next[key] })
      return next
    })
  }, [])

  // Reset ready state when data changes (sequence switch)
  useEffect(() => {
    if (data) {
      // Allow a brief warm-up for the GPU/Three.js to compile shaders
      queueMicrotask(() => setSceneReady(false))
      const timer = setTimeout(() => setSceneReady(true), 400)
      return () => clearTimeout(timer)
    }
  }, [data])

  if (loading) {
    return <LoadingScreen message="Loading scene data&hellip;" />
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <p className="text-sm text-red-400">Error: {error ?? "No data"}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 relative bg-zinc-950 overflow-hidden">
      {/* Overlay loading screen during warm-up — canvas renders underneath to pre-compile */}
      {!sceneReady && (
        <div className="absolute inset-0 z-50">
          <LoadingScreen message="Preparing scene&hellip;" />
        </div>
      )}
      <Canvas
        camera={{ position: [0, 12, -20], fov: 55, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        shadows
        frameloop="always"
      >
        <SceneCore
          data={data}
          playbackTick={playback.tick}
          getFramePoints={getFramePoints}
          streams={streams}
          onUiUpdate={onUiUpdate}
        />
      </Canvas>

      <StreamPanel streams={streams} onToggle={toggleStream} />
      <SequenceSelector manifest={manifest} active={activeSequence} onChange={setActiveSequence} />

      <CameraFeed
        visible={streams.camera}
        cameraUrl={cameraUrl}
        playing={playback.playing}
        speed={playback.speed}
        timeRef={playback.timeRef}
      />

      {uiMetrics && (
        <MetricsPanel speed={uiMetrics.speed} acceleration={uiMetrics.acceleration} wheelAngle={uiMetrics.wheelAngle} />
      )}

      <PlaybackBar
        frame={playback.frame}
        totalFrames={playback.totalFrames}
        playing={playback.playing}
        speed={playback.speed}
        loop={playback.loop}
        fps={playback.fps}
        onToggle={playback.toggle}
        onSetFrame={playback.setFrame}
        onStepForward={playback.stepForward}
        onStepBackward={playback.stepBackward}
        onSetSpeed={playback.setSpeed}
        onToggleLoop={playback.toggleLoop}
      />
    </div>
  )
}
