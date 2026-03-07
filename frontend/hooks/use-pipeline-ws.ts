"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type PipelineId = "sumo" | "dql" | "slam"
export type PipelineStatus =
  | "idle"
  | "running"
  | "completed"
  | "error"
  | "stopped"

export interface LogEntry {
  pipeline: PipelineId
  line: string
  ts: string
}

export interface MetricPoint {
  pipeline: PipelineId
  data: Record<string, number | string>
}

const INITIAL_STATUSES: Record<PipelineId, PipelineStatus> = {
  sumo: "idle",
  dql: "idle",
  slam: "idle",
}

const MAX_LOGS = 5000
const TRIM_TO = 4000

export function usePipelineWs(url: string) {
  const [connected, setConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [statuses, setStatuses] = useState<Record<PipelineId, PipelineStatus>>(
    { ...INITIAL_STATUSES },
  )
  const [metrics, setMetrics] = useState<Record<string, MetricPoint[]>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const connectRef = useRef<(() => void) | undefined>(undefined)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      switch (msg.type) {
        case "log":
          if (msg.pipeline && msg.line) {
            setLogs((prev) => {
              const next = [
                ...prev,
                {
                  pipeline: msg.pipeline as PipelineId,
                  line: msg.line as string,
                  ts: (msg.ts as string) || "",
                },
              ]
              return next.length > MAX_LOGS ? next.slice(-TRIM_TO) : next
            })
          }
          break

        case "status":
          if (msg.pipeline && msg.status) {
            setStatuses((prev) => ({
              ...prev,
              [msg.pipeline]: msg.status as PipelineStatus,
            }))
          }
          break

        case "metric":
          if (msg.pipeline && msg.data) {
            setMetrics((prev) => ({
              ...prev,
              [msg.pipeline]: [
                ...(prev[msg.pipeline] || []),
                { pipeline: msg.pipeline as PipelineId, data: msg.data },
              ],
            }))
          }
          break
      }
    }

    wsRef.current = ws
  }, [url])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const runPipeline = useCallback((id: PipelineId) => {
    wsRef.current?.send(JSON.stringify({ action: "run", pipeline: id }))
  }, [])

  const stopPipeline = useCallback((id: PipelineId) => {
    wsRef.current?.send(JSON.stringify({ action: "stop", pipeline: id }))
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
    setMetrics({})
  }, [])

  return {
    connected,
    logs,
    statuses,
    metrics,
    runPipeline,
    stopPipeline,
    clearLogs,
  }
}
