"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Package,
    FolderTree,
    ShoppingCart,
    AlertTriangle,
    Activity,
    LogOut,
    X,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/categories", label: "Categories", icon: FolderTree },
    { href: "/products", label: "Products", icon: Package },
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/restock-queue", label: "Restock Queue", icon: AlertTriangle },
    { href: "/activity-log", label: "Activity Log", icon: Activity },
    { href: "/users", label: "Users", icon: Users, adminOnly: true },
] as const;

interface SidebarProps {
    open?: boolean;
    onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
    const pathname = usePathname();
    const logout = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);

    return (
        <aside
            className={cn(
                "flex flex-col h-full w-[260px] bg-white border-r border-slate-200/80",
                "fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transition-transform duration-300",
                open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            )}
        >
            <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100">
                <Link href="/dashboard" className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <Package className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold text-[17px] text-slate-800 tracking-tight">
                        InvenTrack
                    </span>
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-8 w-8"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {/* <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Menu</p> */}
                {navItems.filter((item) => !("adminOnly" in item && item.adminOnly) || user?.role === "ADMIN").map((item) => {
                    const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-200",
                                isActive
                                    ? "bg-linear-to-r from-orange-500 to-orange-600 text-white"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-[18px] w-[18px]",
                                    isActive
                                        ? "text-white/90"
                                        : "text-slate-400",
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User + Footer */}
            <div className="border-t border-slate-100">
                <div className="p-3">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="h-9 w-9 rounded-lg bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                            {user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="text-[13px] font-semibold text-slate-700 truncate">
                                    {user?.name || "User"}
                                </p>
                                <Badge
                                    variant={user?.role === "ADMIN" ? "default" : "secondary"}
                                    className={cn(
                                        "text-[9px] px-1.5 py-0 h-4 font-bold tracking-wide rounded-[4px]",
                                        user?.role === "ADMIN"
                                            ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                            : "bg-slate-200 text-slate-500 hover:bg-slate-200",
                                    )}
                                >
                                    {user?.role || "USER"}
                                </Badge>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                        </div>
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-400 bg-red-50 hover:text-red-600 hover:bg-red-100 shrink-0"
                                        onClick={() => { logout(); window.location.href = "/login"; }}
                                    />
                                }
                            >
                                <LogOut className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>Sign Out</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-sm bg-emerald-500" />
                            <span className="text-[10px] text-slate-400">System Online</span>
                        </div>
                        <span className="text-[10px] text-slate-300">v1.0.0</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
