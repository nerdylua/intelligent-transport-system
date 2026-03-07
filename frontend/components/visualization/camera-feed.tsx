"use client"

import { useEffect, useRef } from "react"

interface CameraFeedProps {
  visible: boolean
  cameraUrl: string | null
  playing: boolean
  speed: number
  timeRef: React.RefObject<number>
}

/**
 * CameraFeed — plays the camera video naturally.
 *
 * Instead of seeking per-frame (which causes stuttering/cutting),
 * we simply play/pause the video at the matching speed.
 * On pause or slider change, we do a one-time seek.
 */
export function CameraFeed({ visible, cameraUrl, playing, speed, timeRef }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wasPlaying = useRef(false)

  // Play/pause sync + speed
  useEffect(() => {
    const v = videoRef.current
    if (!v || !cameraUrl) return

    if (playing) {
      // Sync video time to playback time before playing
      const targetTime = timeRef.current ?? 0
      if (Math.abs(v.currentTime - targetTime) > 0.5) {
        v.currentTime = targetTime
      }
      v.playbackRate = speed
      v.play().catch(() => { })
      wasPlaying.current = true
    } else {
      v.pause()
      // On pause, seek to the exact playback position
      if (wasPlaying.current) {
        const targetTime = timeRef.current ?? 0
        v.currentTime = targetTime
        wasPlaying.current = false
      }
    }
  }, [playing, speed, cameraUrl, timeRef])

  // Periodic sync — only while playing, once per second
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const v = videoRef.current
      if (!v || !timeRef.current) return
      const drift = Math.abs(v.currentTime - timeRef.current)
      if (drift > 0.5) {
        v.currentTime = timeRef.current
      }
    }, 1000)
    return () => clearInterval(id)
  }, [playing, timeRef])

  if (!visible || !cameraUrl) return null

  return (
    <div className="absolute top-4 right-4 w-[25rem] rounded-lg overflow-hidden border border-white/15 bg-black/60 backdrop-blur z-10 shadow-2xl">
      <div className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-zinc-400 font-mono z-20 tracking-wide flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        /camera/image_02
      </div>
      <video
        ref={videoRef}
        src={cameraUrl}
        muted
        playsInline
        preload="auto"
        className="w-full h-auto block"
        style={{ aspectRatio: "640 / 360" }}
      />
    </div>
  )
}
