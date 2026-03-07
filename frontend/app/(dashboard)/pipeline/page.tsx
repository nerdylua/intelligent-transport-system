"use client"

import { motion } from "framer-motion"
import { Car, Gauge, Radar, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { usePipelineWs, type PipelineId } from "@/hooks/use-pipeline-ws"
import { PipelineCard } from "@/components/pipeline/pipeline-card"
import { LogTerminal } from "@/components/pipeline/log-terminal"

const PIPELINES: {
  id: PipelineId
  name: string
  description: string
  icon: typeof Car
  iconColor: string
  accentColor: string
}[] = [
  {
    id: "sumo",
    name: "SUMO Traffic Sim",
    description:
      "Run microscopic traffic simulation with a LiDAR-equipped ego vehicle. Generates Carmen-format scan logs for the SLAM pipeline.",
    icon: Car,
    iconColor: "text-blue-500",
    accentColor: "bg-blue-500",
  },
  {
    id: "dql",
    name: "DQL Signal Training",
    description:
      "Train a Deep Q-Learning agent for adaptive traffic signal control on a 4-intersection grid. 50 episodes, ~2 min.",
    icon: Gauge,
    iconColor: "text-emerald-500",
    accentColor: "bg-emerald-500",
  },
  {
    id: "slam",
    name: "SLAM Benchmark",
    description:
      "Run CPU baseline CSM on synthetic LiDAR data (200 scans). Produces occupancy grid, trajectory, and FPGA-estimated timing.",
    icon: Radar,
    iconColor: "text-violet-500",
    accentColor: "bg-violet-500",
  },
]

export default function PipelinePage() {
  const {
    connected,
    logs,
    statuses,
    runPipeline,
    stopPipeline,
  } = usePipelineWs("ws://localhost:8000/ws")

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Pipeline Runner
            </h1>
            <p className="text-muted-foreground mt-1">
              Execute and monitor ITS processing pipelines in real-time
            </p>
          </div>
          <Badge
            variant={connected ? "default" : "secondary"}
            className="gap-1.5 shrink-0"
          >
            {connected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PIPELINES.map((p) => (
            <PipelineCard
              key={p.id}
              {...p}
              status={statuses[p.id]}
              disabled={!connected}
              onRun={() => runPipeline(p.id)}
              onStop={() => stopPipeline(p.id)}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <LogTerminal logs={logs} />
        </motion.div>
      </div>
    </div>
  )
}
