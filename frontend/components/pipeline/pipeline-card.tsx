"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { PipelineId, PipelineStatus } from "@/hooks/use-pipeline-ws"

interface PipelineCardProps {
  id: PipelineId
  name: string
  description: string
  icon: LucideIcon
  iconColor: string
  accentColor: string
  status: PipelineStatus
  disabled: boolean
  onRun: () => void
  onStop: () => void
}

const statusConfig: Record<
  PipelineStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  idle: { label: "Idle", variant: "secondary" },
  running: { label: "Running", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  stopped: { label: "Stopped", variant: "secondary" },
}

export function PipelineCard({
  name,
  description,
  icon: Icon,
  iconColor,
  accentColor,
  status,
  disabled,
  onRun,
  onStop,
}: PipelineCardProps) {
  const isRunning = status === "running"
  const cfg = statusConfig[status]

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${accentColor}`} />
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentColor}/10`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <h3 className="font-semibold text-sm">{name}</h3>
          </div>
          <Badge variant={cfg.variant} className="gap-1 text-[11px]">
            {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === "completed" && <CheckCircle2 className="h-3 w-3" />}
            {status === "error" && <XCircle className="h-3 w-3" />}
            {cfg.label}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          {description}
        </p>

        <Button
          size="sm"
          variant={isRunning ? "destructive" : "default"}
          className="w-full"
          disabled={disabled}
          onClick={isRunning ? onStop : onRun}
        >
          {isRunning ? (
            <>
              <Square className="h-3.5 w-3.5 mr-1.5" /> Stop
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Run
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
