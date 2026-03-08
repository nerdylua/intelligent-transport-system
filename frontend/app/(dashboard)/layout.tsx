"use client"

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const routeLabels: Record<string, string> = {
    "/simulation": "Overview",
    "/pipeline": "Pipeline",
    "/visualization": "Visualization",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const pageLabel = routeLabels[pathname] ?? pathname.replace("/", "");

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col min-h-screen">
                <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4">
                    <SidebarTrigger className="-ml-1 size-8" />
                    <Separator orientation="vertical" className="mr-2 !h-6" />
                    <nav className="flex items-center gap-2 text-lg">
                        <span className="text-zinc-500 dark:text-zinc-400">Home</span>
                        <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{pageLabel}</span>
                    </nav>
                </header>
                {children}
            </SidebarInset>
        </SidebarProvider>
    );
}
