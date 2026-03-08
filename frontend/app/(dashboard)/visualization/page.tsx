"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Monitor } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Monitor className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Desktop Only
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            The 3D visualization requires too many assets to load on mobile devices. Please open this page on a desktop or laptop for the best experience.
          </p>
          <Link
            href="/simulation"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Back to Overview
          </Link>
        </div>
      </div>
    )
  }

  return <AVScene />
}
