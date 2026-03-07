"use client"

import { Play, Pause, SkipForward, SkipBack, Repeat } from "lucide-react"

interface PlaybackBarProps {
  frame: number
  totalFrames: number
  playing: boolean
  speed: number
  loop: boolean
  fps: number
  onToggle: () => void
  onSetFrame: (f: number) => void
  onStepForward: () => void
  onStepBackward: () => void
  onSetSpeed: (s: number) => void
  onToggleLoop: () => void
}

function fmt(frame: number, fps: number) {
  const sec = frame / fps
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ds = Math.floor((sec % 1) * 10)
  return `${m}:${String(s).padStart(2, "0")}.${ds}`
}

export function PlaybackBar({
  frame,
  totalFrames,
  playing,
  speed,
  loop,
  fps,
  onToggle,
  onSetFrame,
  onStepForward,
  onStepBackward,
  onSetSpeed,
  onToggleLoop,
}: PlaybackBarProps) {
  const pct = totalFrames > 1 ? (frame / (totalFrames - 1)) * 100 : 0

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl rounded-lg bg-black/75 backdrop-blur-xl border border-white/10 text-white z-10 px-4 py-3 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          <button
            onClick={onStepBackward}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button
            onClick={onStepForward}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-[11px] font-mono text-zinc-400 w-12 text-right tabular-nums shrink-0">
          {fmt(frame, fps)}
        </span>

        <div className="flex-1 relative h-5 flex items-center group cursor-pointer">
          <div className="absolute inset-x-0 h-[3px] bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(totalFrames - 1, 0)}
            value={frame}
            onChange={(e) => onSetFrame(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute h-2.5 w-2.5 bg-white rounded-full shadow pointer-events-none -translate-x-1/2 group-hover:scale-125 transition-transform"
            style={{ left: `${pct}%` }}
          />
        </div>

        <span className="text-[11px] font-mono text-zinc-400 w-12 tabular-nums shrink-0">
          {fmt(totalFrames - 1, fps)}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${
                speed === s
                  ? "bg-blue-500/25 text-blue-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          onClick={onToggleLoop}
          className={`p-1.5 rounded transition-colors shrink-0 ${
            loop
              ? "text-blue-400 hover:bg-blue-500/15"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
          }`}
          title={loop ? "Loop: on" : "Loop: off"}
        >
          <Repeat className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
