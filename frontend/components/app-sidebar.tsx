"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Activity,
  Terminal,
  View,
  Sun,
  Moon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"

const navItems = [
  { title: "Overview", href: "/simulation", icon: Activity },
  { title: "Pipeline", href: "/pipeline", icon: Terminal },
  { title: "Visualization", href: "/visualization", icon: View },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { isMobile, setOpenMobile } = useSidebar()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Sidebar className="border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#09090b]">
      <SidebarHeader className="px-5 py-6 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <Link href="/" className="flex items-center gap-3 w-full group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18181b] dark:bg-white shadow-sm transition-transform group-hover:scale-105">
            <div className="h-2.5 w-2.5 rounded-sm bg-white/20 dark:bg-black/20"></div>
          </div>
          <div className="flex flex-col flex-1 truncate">
            <span className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">ITS System</span>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">Simulation Platform</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        <SidebarGroup>
          <div className="px-2 mb-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Navigation</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-11 px-3 my-1 rounded-xl transition-all duration-200 ${isActive
                        ? "bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-700/50"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                        }`}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center gap-3.5"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false)
                        }}
                      >
                        <item.icon className={`h-5 w-5 ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                        <span className="text-[14px] tracking-tight">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900/50 p-3 border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 transition-colors group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700">
              {!mounted ? (
                <Sun className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              ) : theme === "dark" ? (
                <Moon className="h-4 w-4 text-emerald-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Theme</span>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {mounted ? (theme === "dark" ? "Dark mode" : "Light mode") : "System mode"}
              </span>
            </div>
          </div>
          <div className="flex h-6 w-10 shrink-0 items-center rounded-full bg-zinc-200 dark:bg-zinc-800 p-0.5 transition-colors">
            <div
              className={`h-5 w-5 rounded-full bg-white dark:bg-zinc-950 shadow-sm transition-transform duration-300 ${
                mounted && theme === "dark" ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
