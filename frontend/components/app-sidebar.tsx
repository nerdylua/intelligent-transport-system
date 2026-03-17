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
      <SidebarHeader className="px-4 py-5 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="flex items-center gap-3 w-full group">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#18181b] dark:bg-white">
            <div className="h-2 w-2 rounded-sm bg-white/20 dark:bg-black/20"></div>
          </div>
          <div className="flex flex-col flex-1 truncate">
            <span className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">ITS System</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
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
                      className={`h-9 px-2.5 my-0.5 rounded-lg transition-colors ${isActive
                        ? "bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 font-medium"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                        }`}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center gap-3"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false)
                        }}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                        <span className="text-[13px] tracking-tight">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between rounded-lg bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center gap-2">
            {!mounted ? (
              <Sun className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            ) : theme === "dark" ? (
              <Moon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            )}
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Theme</span>
          </div>
          {mounted ? (
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              className="scale-75 origin-right"
            />
          ) : (
            <div className="w-[34px] h-[20px] scale-75 origin-right rounded-full bg-zinc-200 dark:bg-zinc-800" />
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
