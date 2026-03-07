"use client"

import { useEffect, useRef, useState } from "react"
import type { LogEntry, PipelineId } from "@/hooks/use-pipeline-ws"

const PIPELINE_COLORS: Record<PipelineId, string> = {
  sumo: "text-blue-400",
  dql: "text-emerald-400",
  slam: "text-violet-400",
}

const PIPELINE_LABELS: Record<PipelineId, string> = {
  sumo: "SUMO",
  dql: " DQL",
  slam: "SLAM",
}

const FILTERS = [
  { key: "all" as const, label: "All" },
  { key: "sumo" as const, label: "SUMO" },
  { key: "dql" as const, label: "DQL" },
  { key: "slam" as const, label: "SLAM" },
]

interface LogTerminalProps {
  logs: LogEntry[]
}

export function LogTerminal({ logs }: LogTerminalProps) {
  const [filter, setFilter] = useState<"all" | PipelineId>("all")
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  const filtered =
    filter === "all" ? logs : logs.filter((l) => l.pipeline === filter)

  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filtered.length])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    stickRef.current = scrollHeight - scrollTop - clientHeight < 60
  }

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {filtered.length} lines
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[420px] overflow-y-auto bg-zinc-950 p-3 font-mono text-[12px] leading-[1.65]"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Run a pipeline to see output here&hellip;
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={i}
              className="flex gap-2.5 hover:bg-white/[0.02] rounded px-1 -mx-1"
            >
              <span className="text-zinc-600 select-none shrink-0 tabular-nums">
                {entry.ts}
              </span>
              <span
                className={`${PIPELINE_COLORS[entry.pipeline]} select-none shrink-0 font-semibold`}
              >
                [{PIPELINE_LABELS[entry.pipeline]}]
              </span>
              <span className="text-zinc-300 break-all">{entry.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
