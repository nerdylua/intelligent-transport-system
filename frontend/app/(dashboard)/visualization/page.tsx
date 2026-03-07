"use client"

import dynamic from "next/dynamic"

const AVScene = dynamic(() => import("@/components/visualization/av-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500 mb-3" />
        <p className="text-sm text-zinc-500">Initializing 3D engine&hellip;</p>
      </div>
    </div>
  ),
})

export default function VisualizationPage() {
  return <AVScene />
}
