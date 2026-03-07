"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function usePlayback(totalFrames: number, fps: number = 10) {
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const speedRef = useRef(1)
  const loopRef = useRef(true)
  const [uiFrame, setUiFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [loop, setLoopState] = useState(true)

  const duration = totalFrames > 0 ? totalFrames / fps : 1

  useEffect(() => {
    timeRef.current = 0
    playingRef.current = false
    setUiFrame(0)
    setPlaying(false)
  }, [totalFrames, fps])

  const lastUiUpdate = useRef(0)
  const updateUI = useCallback(() => {
    const now = performance.now()
    if (now - lastUiUpdate.current > 80) {
      lastUiUpdate.current = now
      const frame = Math.min(
        Math.floor(timeRef.current * fps),
        Math.max(totalFrames - 1, 0),
      )
      setUiFrame(frame)
    }
  }, [fps, totalFrames])

  const tick = useCallback(
    (delta: number) => {
      const dt = Math.min(delta, 0.05)

      if (playingRef.current && totalFrames > 0) {
        timeRef.current += dt * speedRef.current
        if (timeRef.current >= duration) {
          if (loopRef.current) {
            timeRef.current = 0
          } else {
            timeRef.current = (totalFrames - 1) / fps
            playingRef.current = false
            setPlaying(false)
          }
        }
      }

      const raw = timeRef.current * fps
      const frame = Math.min(Math.floor(raw), Math.max(totalFrames - 1, 0))
      const t = raw - frame

      if (playingRef.current) updateUI()

      return { frame, t }
    },
    [totalFrames, fps, duration, updateUI],
  )

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          playingRef.current = !playingRef.current
          setPlaying(playingRef.current)
          break
        case "ArrowRight":
          e.preventDefault()
          timeRef.current = Math.min(
            timeRef.current + 1 / fps,
            (totalFrames - 1) / fps,
          )
          setUiFrame(Math.floor(timeRef.current * fps))
          break
        case "ArrowLeft":
          e.preventDefault()
          timeRef.current = Math.max(timeRef.current - 1 / fps, 0)
          setUiFrame(Math.floor(timeRef.current * fps))
          break
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [totalFrames, fps])

  const toggle = useCallback(() => {
    playingRef.current = !playingRef.current
    setPlaying(playingRef.current)
  }, [])

  const stepForward = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    timeRef.current = Math.min(
      timeRef.current + 1 / fps,
      (totalFrames - 1) / fps,
    )
    setUiFrame(Math.floor(timeRef.current * fps))
  }, [totalFrames, fps])

  const stepBackward = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    timeRef.current = Math.max(timeRef.current - 1 / fps, 0)
    setUiFrame(Math.floor(timeRef.current * fps))
  }, [fps])

  const setFrame = useCallback(
    (f: number | ((prev: number) => number)) => {
      if (typeof f === "function") {
        const prev = Math.floor(timeRef.current * fps)
        const next = f(prev)
        timeRef.current = next / fps
      } else {
        timeRef.current = f / fps
      }
      setUiFrame(Math.floor(timeRef.current * fps))
    },
    [fps],
  )

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s
    setSpeedState(s)
  }, [])

  const toggleLoop = useCallback(() => {
    loopRef.current = !loopRef.current
    setLoopState(loopRef.current)
  }, [])

  return {
    tick,
    timeRef,
    frame: uiFrame,
    playing,
    speed,
    loop,
    totalFrames,
    fps,
    toggle,
    setFrame,
    stepForward,
    stepBackward,
    setSpeed,
    toggleLoop,
  }
}
