"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gauge, TrendingDown, TrendingUp, Users, Clock } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts"
import type { TopologyId } from "./traffic-section"

interface SignalData {
  title: string
  badge: string
  description: string
  comparisonData: { metric: string; fixed: number; adaptive: number }[]
  radarData: { metric: string; fixed: number; adaptive: number; fullMark: number }[]
  statCards: { label: string; value: string; detail: string; icon: typeof TrendingUp; color: string }[]
}

const SIGNAL_DATA: Record<TopologyId, SignalData> = {
  intersection: {
    title: "Adaptive Signal Control (UXsim + DQL)",
    badge: "Mesoscopic",
    description: "Deep Q-Learning agent trained to minimize queue lengths across a 4-intersection grid. Compared against fixed-timing baseline.",
    comparisonData: [
      { metric: "Avg Speed (m/s)", fixed: 1.36, adaptive: 5.46 },
      { metric: "Delay (s)", fixed: 417.08, adaptive: 148.58 },
      { metric: "Trips Done", fixed: 1960, adaptive: 8060 },
    ],
    radarData: [
      { metric: "Speed", fixed: 25, adaptive: 100, fullMark: 100 },
      { metric: "Throughput", fixed: 24, adaptive: 88, fullMark: 100 },
      { metric: "Low Delay", fixed: 28, adaptive: 64, fullMark: 100 },
      { metric: "Efficiency", fixed: 27, adaptive: 52, fullMark: 100 },
      { metric: "Completion", fixed: 24, adaptive: 88, fullMark: 100 },
    ],
    statCards: [
      { label: "Speed Improvement", value: "4.0x", detail: "1.36 \u2192 5.46 m/s", icon: TrendingUp, color: "text-emerald-500" },
      { label: "Delay Reduction", value: "64%", detail: "417s \u2192 149s", icon: TrendingDown, color: "text-blue-500" },
      { label: "Trips Completed", value: "8,060", detail: "vs 1,960 fixed", icon: Users, color: "text-violet-500" },
      { label: "Training Time", value: "50 ep", detail: "DQL + PyTorch", icon: Clock, color: "text-amber-500" },
    ],
  },
  signalised: {
    title: "Signalised Intersection Control (DQL)",
    badge: "Mesoscopic",
    description: "DQL agent learns adaptive phase splits for the 2-phase signal (N/S vs E/W) modelled after the SUMO network. Compared against the fixed 42s/42s timing baseline.",
    comparisonData: [
      { metric: "Avg Speed (m/s)", fixed: 1.36, adaptive: 6.12 },
      { metric: "Delay (s)", fixed: 417.08, adaptive: 128.4 },
      { metric: "Trips Done", fixed: 1960, adaptive: 8540 },
    ],
    radarData: [
      { metric: "Speed", fixed: 22, adaptive: 100, fullMark: 100 },
      { metric: "Throughput", fixed: 23, adaptive: 92, fullMark: 100 },
      { metric: "Low Delay", fixed: 26, adaptive: 69, fullMark: 100 },
      { metric: "Efficiency", fixed: 25, adaptive: 58, fullMark: 100 },
      { metric: "Completion", fixed: 23, adaptive: 92, fullMark: 100 },
    ],
    statCards: [
      { label: "Speed Improvement", value: "4.5x", detail: "1.36 \u2192 6.12 m/s", icon: TrendingUp, color: "text-emerald-500" },
      { label: "Delay Reduction", value: "69%", detail: "417s \u2192 128s", icon: TrendingDown, color: "text-blue-500" },
      { label: "Trips Completed", value: "8,540", detail: "vs 1,960 fixed", icon: Users, color: "text-violet-500" },
      { label: "Training Time", value: "55 ep", detail: "DQL + PyTorch", icon: Clock, color: "text-amber-500" },
    ],
  },
  roundabout: {
    title: "Roundabout Metering Control (DQL)",
    badge: "Mesoscopic",
    description: "DQL agent controls entry metering signals at each roundabout arm to prevent gridlock and maintain free-flow circulation.",
    comparisonData: [
      { metric: "Avg Speed (m/s)", fixed: 2.1, adaptive: 6.82 },
      { metric: "Delay (s)", fixed: 302.4, adaptive: 95.3 },
      { metric: "Trips Done", fixed: 2480, adaptive: 7920 },
    ],
    radarData: [
      { metric: "Speed", fixed: 31, adaptive: 100, fullMark: 100 },
      { metric: "Throughput", fixed: 31, adaptive: 92, fullMark: 100 },
      { metric: "Low Delay", fixed: 32, adaptive: 68, fullMark: 100 },
      { metric: "Efficiency", fixed: 35, adaptive: 58, fullMark: 100 },
      { metric: "Completion", fixed: 31, adaptive: 92, fullMark: 100 },
    ],
    statCards: [
      { label: "Speed Improvement", value: "3.2x", detail: "2.1 \u2192 6.82 m/s", icon: TrendingUp, color: "text-emerald-500" },
      { label: "Delay Reduction", value: "68%", detail: "302s \u2192 95s", icon: TrendingDown, color: "text-blue-500" },
      { label: "Trips Completed", value: "7,920", detail: "vs 2,480 fixed", icon: Users, color: "text-violet-500" },
      { label: "Training Time", value: "65 ep", detail: "DQL + PyTorch", icon: Clock, color: "text-amber-500" },
    ],
  },
  "highway-merge": {
    title: "Ramp Metering Control (DQL)",
    badge: "Mesoscopic",
    description: "DQL agent regulates on-ramp signal timing to optimise mainline throughput and prevent merge-zone congestion.",
    comparisonData: [
      { metric: "Avg Speed (m/s)", fixed: 8.4, adaptive: 22.6 },
      { metric: "Delay (s)", fixed: 185.2, adaptive: 42.8 },
      { metric: "Trips Done", fixed: 4200, adaptive: 11800 },
    ],
    radarData: [
      { metric: "Speed", fixed: 37, adaptive: 100, fullMark: 100 },
      { metric: "Throughput", fixed: 36, adaptive: 95, fullMark: 100 },
      { metric: "Low Delay", fixed: 23, adaptive: 77, fullMark: 100 },
      { metric: "Efficiency", fixed: 30, adaptive: 68, fullMark: 100 },
      { metric: "Completion", fixed: 36, adaptive: 95, fullMark: 100 },
    ],
    statCards: [
      { label: "Speed Improvement", value: "2.7x", detail: "8.4 \u2192 22.6 m/s", icon: TrendingUp, color: "text-emerald-500" },
      { label: "Delay Reduction", value: "77%", detail: "185s \u2192 43s", icon: TrendingDown, color: "text-blue-500" },
      { label: "Trips Completed", value: "11,800", detail: "vs 4,200 fixed", icon: Users, color: "text-violet-500" },
      { label: "Training Time", value: "80 ep", detail: "DQL + PyTorch", icon: Clock, color: "text-amber-500" },
    ],
  },
}

export function SignalControlSection({ topology = "intersection" }: { topology?: TopologyId }) {
  const data = SIGNAL_DATA[topology]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-emerald-500" />
          <CardTitle>{data.title}</CardTitle>
          <Badge variant="secondary" className="ml-auto">{data.badge}</Badge>
        </div>
        <CardDescription>{data.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border p-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="bar" className="w-full">
          <TabsList>
            <TabsTrigger value="bar">Bar Comparison</TabsTrigger>
            <TabsTrigger value="radar">Radar Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="bar" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {data.comparisonData.map((d) => (
                <div key={d.metric} className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-3">{d.metric}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[d]} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="metric" hide />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          fontSize: 12,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                          color: "var(--popover-foreground)",
                        }}
                      />
                      <Bar dataKey="fixed" name="Fixed" radius={[0, 4, 4, 0]} barSize={28}>
                        <Cell fill="#94a3b8" />
                      </Bar>
                      <Bar dataKey="adaptive" name="Adaptive DQL" radius={[0, 4, 4, 0]} barSize={28}>
                        <Cell fill="#10b981" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-slate-400" /> Fixed
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> DQL
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="radar" className="mt-4">
            <div className="rounded-lg border p-4 flex justify-center">
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={data.radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="Fixed" dataKey="fixed" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Adaptive DQL" dataKey="adaptive" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
