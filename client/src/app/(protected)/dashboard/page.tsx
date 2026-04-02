"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart, Clock, CheckCircle, AlertTriangle, DollarSign, Package, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { DashboardStats } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  Area, AreaChart,
} from "recharts";
import { format } from "date-fns";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin" />
      </div>
    );
  }

  if (!stats) return <p className="text-slate-400">Failed to load dashboard.</p>;

  const outOfStockCount = stats.productSummary.filter(p => p.stock === 0).length;

  // Stat cards data — 2 rows x 4 columns
  const statCards = [
    // Row 1: Revenue, Products, Low Stock, Out of Stock
    { title: "Revenue Today", value: `$${Number(stats.revenueToday).toFixed(2)}`, icon: DollarSign, bg: "bg-orange-50", iconColor: "text-orange-500", trend: "today", up: true },
    { title: "Total Products", value: stats.totalProducts, icon: Package, bg: "bg-blue-50", iconColor: "text-blue-500", trend: `${stats.totalCategories} categories`, up: true },
    { title: "Low Stock", value: stats.lowStockItems, icon: AlertTriangle, bg: "bg-yellow-50", iconColor: "text-yellow-600", trend: "items", up: false },
    { title: "Out of Stock", value: outOfStockCount, icon: Package, bg: "bg-red-50", iconColor: "text-red-500", trend: "unavailable", up: false },
    // Row 2: Orders, Pending, Delivered, Cancelled
    { title: "Orders Today", value: stats.totalOrdersToday, icon: ShoppingCart, bg: "bg-slate-100", iconColor: "text-slate-500", trend: "today", up: true },
    { title: "Pending", value: stats.pendingOrders, icon: Clock, bg: "bg-amber-50", iconColor: "text-amber-500", trend: "active", up: false },
    { title: "Delivered", value: stats.completedOrders, icon: CheckCircle, bg: "bg-emerald-50", iconColor: "text-emerald-500", trend: "completed", up: true },
    { title: "Cancelled", value: stats.ordersByStatus?.find(o => o.status === "CANCELLED")?.count || 0, icon: ShoppingCart, bg: "bg-slate-100", iconColor: "text-slate-400", trend: "orders", up: false },
  ];

  // Chart colors
  const barColors: Record<string, string> = {
    PENDING: "#f59e0b", CONFIRMED: "#3b82f6", SHIPPED: "#8b5cf6", DELIVERED: "#10b981", CANCELLED: "#ef4444",
  };

  // Pie chart data for stock distribution
  const stockDistribution = [
    { name: "In Stock", value: stats.totalProducts - stats.lowStockItems - outOfStockCount, fill: "#10b981" },
    { name: "Low Stock", value: stats.lowStockItems, fill: "#f59e0b" },
    { name: "Out of Stock", value: outOfStockCount, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-[15px] mt-0.5">Overview of your inventory and orders</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[13px] text-slate-400">{format(new Date(), "EEEE, MMM d, yyyy")}</p>
        </div>
      </div>

      {/* KPI Cards - 2 rows x 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`h-[18px] w-[18px] ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-[22px] font-bold text-slate-800 tracking-tight leading-none">{card.value}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[12px] text-slate-400 font-medium">{card.title}</p>
                <span className={`text-[11px] font-medium ${card.up ? "text-emerald-500" : "text-slate-400"}`}>
                  {card.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts - 2 rows x 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending vs Completed — Butterfly / Comparison Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-semibold text-slate-700">Pending vs Completed — Last 7 Days</CardTitle>
            </div>
            <div className="flex items-center gap-6 mt-1">
              <div className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-sm bg-amber-400" /><span className="text-[11px] text-slate-500">Pending</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-sm bg-emerald-500" /><span className="text-[11px] text-slate-500">Completed</span></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(stats.revenueChart || []).map((day) => {
                const total = day.total || 1;
                const pendingPct = Math.round((day.pending / total) * 100);
                const completedPct = Math.round((day.completed / total) * 100);
                const pendingWidth = total > 0 ? Math.max((day.pending / Math.max(...(stats.revenueChart || []).map(d => Math.max(d.pending, d.completed, 1)))) * 100, day.pending > 0 ? 8 : 0) : 0;
                const completedWidth = total > 0 ? Math.max((day.completed / Math.max(...(stats.revenueChart || []).map(d => Math.max(d.pending, d.completed, 1)))) * 100, day.completed > 0 ? 8 : 0) : 0;
                const dateLabel = format(new Date(day.date + "T00:00:00"), "EEE");
                const dateFull = format(new Date(day.date + "T00:00:00"), "MMM d");
                return (
                  <div key={day.date} className="grid grid-cols-[1fr_50px_1fr] items-center gap-1 h-8">
                    {/* Left bar — Pending (grows right to left) */}
                    <div className="flex items-center justify-end gap-2">
                      {day.pending > 0 && (
                        <span className="text-[11px] text-amber-600 font-semibold tabular-nums">{day.pending} ({pendingPct}%)</span>
                      )}
                      <div className="h-6 rounded-sm bg-amber-400/80" style={{ width: `${pendingWidth}%`, minWidth: day.pending > 0 ? "4px" : "0" }} />
                    </div>
                    {/* Center — Day label */}
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-slate-600 leading-none">{dateLabel}</p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">{dateFull}</p>
                    </div>
                    {/* Right bar — Completed (grows left to right) */}
                    <div className="flex items-center gap-2">
                      <div className="h-6 rounded-sm bg-emerald-500/80" style={{ width: `${completedWidth}%`, minWidth: day.completed > 0 ? "4px" : "0" }} />
                      {day.completed > 0 && (
                        <span className="text-[11px] text-emerald-600 font-semibold tabular-nums">{day.completed} ({completedPct}%)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Revenue - Last 7 Days (Area) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-[15px] font-semibold text-slate-700">Revenue — Last 7 Days</CardTitle>
              </div>
              <span className="text-[12px] text-slate-400">
                Total: ${stats.revenueChart?.reduce((s, d) => s + d.revenue, 0).toFixed(2)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stats.revenueChart || []} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(d: string) => format(new Date(d + "T00:00:00"), "MMM d")} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", padding: "6px 10px" }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
                  labelFormatter={(label: any) => format(new Date(String(label) + "T00:00:00"), "EEE, MMM d")} />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#revenueGrad)"
                  dot={{ r: 4, fill: "#fff", stroke: "#f97316", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders by Status (Bar) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-[15px] font-semibold text-slate-700">Orders by Status</CardTitle>
              </div>
              <span className="text-[12px] text-slate-400">{stats.ordersByStatus?.reduce((s, o) => s + o.count, 0) || 0} total</span>
            </div>
          </CardHeader>
          <CardContent>
            {stats.ordersByStatus && (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.ordersByStatus} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", padding: "8px 12px" }} />
                  <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]} barSize={40}>
                    {stats.ordersByStatus.map((entry) => (
                      <Cell key={entry.status} fill={barColors[entry.status] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stock Health (Pie) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold text-slate-700">Stock Health</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stockDistribution} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {stockDistribution.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                  formatter={(value: string) => <span className="text-[12px] text-slate-500 ml-1">{value}</span>} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", padding: "8px 12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row - Products, Orders, Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product Stock Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-semibold text-slate-700">Product Stock Levels</CardTitle>
              <span className="text-[12px] text-slate-400">{stats.productSummary.length} products</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_90px] gap-2 px-5 py-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Stock</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Status</span>
            </div>
            {/* Table rows */}
            <div className="max-h-[320px] overflow-y-auto">
              {stats.productSummary.map((p) => {
                const isLow = p.stock <= p.minStockThreshold && p.stock > 0;
                const isOut = p.stock === 0;
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_80px_90px] gap-2 px-5 py-3 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-slate-700 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.category.name}</p>
                    </div>
                    <div className="text-right self-center">
                      <span className="text-[14px] font-semibold text-slate-700 tabular-nums">{p.stock}</span>
                    </div>
                    <div className="text-right self-center">
                      {isOut ? (
                        <Badge className="bg-red-50 text-red-600 hover:bg-red-50 border-0 text-[10px] font-semibold rounded-[4px]">Out</Badge>
                      ) : isLow ? (
                        <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50 border-0 text-[10px] font-semibold rounded-[4px]">Low</Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-[10px] font-semibold rounded-[4px]">OK</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px] font-semibold text-slate-700">Recent Orders</CardTitle>
              <span className="text-[12px] text-slate-400">{stats.recentOrders?.length || 0} latest</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="grid grid-cols-[1fr_80px_70px] gap-2 px-5 py-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Order</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Total</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Status</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {(stats.recentOrders || []).map((o) => {
                const statusStyle: Record<string, string> = {
                  PENDING: "bg-amber-50 text-amber-700", CONFIRMED: "bg-blue-50 text-blue-700",
                  SHIPPED: "bg-violet-50 text-violet-700", DELIVERED: "bg-emerald-50 text-emerald-700",
                  CANCELLED: "bg-red-50 text-red-600",
                };
                return (
                  <div key={o.id} className="grid grid-cols-[1fr_80px_70px] gap-2 px-5 py-3 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-mono text-orange-600 font-semibold">{o.orderNumber}</p>
                      <p className="text-[11px] text-slate-400">{o.customerName} &middot; {o._count.items} items</p>
                    </div>
                    <div className="text-right self-center">
                      <span className="text-[13px] font-semibold text-slate-700 tabular-nums">${Number(o.totalAmount).toFixed(2)}</span>
                    </div>
                    <div className="text-right self-center">
                      <Badge className={`border-0 text-[9px] font-semibold rounded-[4px] ${statusStyle[o.status] || "bg-slate-100 text-slate-600"}`}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px] font-semibold text-slate-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="max-h-[320px] overflow-y-auto">
              {stats.recentActivities.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No recent activity</p>
              ) : (
                stats.recentActivities.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                    <div className="mt-1 shrink-0">
                      <div className={`h-2 w-2 rounded-sm ${
                        a.action === "CREATE" ? "bg-emerald-500" :
                        a.action === "UPDATE" ? "bg-blue-500" :
                        a.action === "DELETE" ? "bg-red-500" :
                        a.action === "CANCEL" ? "bg-amber-500" :
                        "bg-orange-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-600 leading-snug">{a.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">
                          {format(new Date(a.createdAt), "MMM d, h:mm a")}
                        </span>
                        {a.user && (
                          <>
                            <span className="text-slate-300">&middot;</span>
                            <span className="text-[11px] text-slate-400">{a.user.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded shrink-0 self-start mt-0.5">
                      {a.action}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
