"use client"

import { useState } from "react"
import { Eye, EyeOff, ChevronRight, ChevronDown } from "lucide-react"

interface StreamNode {
  key: string
  label: string
  children?: StreamNode[]
}

const STREAMS: StreamNode[] = [
  { key: "vehicle", label: "/vehicle" },
  { key: "trajectory", label: "/trajectory" },
  {
    key: "objects",
    label: "/objects",
    children: [{ key: "labels", label: "/labels" }],
  },
  { key: "lidar", label: "/lidar" },
  { key: "camera", label: "/camera" },
  { key: "grid", label: "/grid" },
]

interface StreamPanelProps {
  streams: Record<string, boolean>
  onToggle: (key: string) => void
}

function StreamRow({
  node,
  streams,
  onToggle,
  depth = 0,
}: {
  node: StreamNode
  streams: Record<string, boolean>
  onToggle: (key: string) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const on = streams[node.key] !== false
  const hasChildren = !!node.children?.length

  return (
    <>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-white/[0.04] rounded cursor-pointer select-none group"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <button
          onClick={() => onToggle(node.key)}
          className="shrink-0 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {on ? (
            <Eye className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>

        <span
          onClick={() => onToggle(node.key)}
          className={`text-xs font-mono truncate ${on ? "text-zinc-200" : "text-zinc-600"}`}
        >
          {node.label}
        </span>
      </div>

      {hasChildren &&
        expanded &&
        node.children!.map((child) => (
          <StreamRow
            key={child.key}
            node={child}
            streams={streams}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

export function StreamPanel({ streams, onToggle }: StreamPanelProps) {
  return (
    <div className="absolute top-4 left-4 w-48 rounded-lg bg-black/75 backdrop-blur-xl border border-white/10 text-white z-20 shadow-2xl">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          Streams
        </h3>
      </div>
      <div className="py-0.5 max-h-[calc(100vh-14rem)] overflow-y-auto thin-scrollbar">
        {STREAMS.map((s) => (
          <StreamRow key={s.key} node={s} streams={streams} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}
