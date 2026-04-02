"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Eye, Search, CalendarDays, ShoppingCart,
  MoreHorizontal, CheckCircle, Truck, Package, XCircle, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SortableHeader } from "@/components/ui/sortable-header";
import api from "@/lib/api";
import { Order, PaginationMeta } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 hover:bg-amber-50",
  CONFIRMED: "bg-blue-50 text-blue-700 hover:bg-blue-50",
  SHIPPED: "bg-violet-50 text-violet-700 hover:bg-violet-50",
  DELIVERED: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  CANCELLED: "bg-red-50 text-red-600 hover:bg-red-50",
};

const VALID_TRANSITIONS: Record<string, { status: string; label: string; icon: any }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Mark Confirmed", icon: CheckCircle },
  ],
  CONFIRMED: [
    { status: "SHIPPED", label: "Mark Shipped", icon: Truck },
  ],
  SHIPPED: [
    { status: "DELIVERED", label: "Mark Delivered", icon: Package },
  ],
  DELIVERED: [],
  CANCELLED: [],
};

const statusLabels: Record<string, string> = {
  all: "All Statuses", PENDING: "Pending", CONFIRMED: "Confirmed",
  SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled",
};

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sortBy, order };
      if (search) params.search = search;
      if (filterStatus !== "all") params.status = filterStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await api.get("/orders", { params });
      setOrders(data.data);
      setPagination(data.meta.pagination);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  }, [page, limit, search, filterStatus, startDate, endDate, sortBy, order]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSort = (field: string, dir: "asc" | "desc") => { setSortBy(field); setOrder(dir); setPage(1); };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      if (status === "CANCELLED") {
        await api.post(`/orders/${orderId}/cancel`);
      } else {
        await api.patch(`/orders/${orderId}/status`, { status });
      }
      toast.success(`Order ${status.toLowerCase()}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to update status");
    }
  };

  const handleCancel = async (orderId: string) => {
    const ok = await confirm({ title: "Cancel Order", description: "Cancel this order? Stock will be restored to inventory.", confirmText: "Cancel Order", variant: "danger" });
    if (!ok) return;
    await updateStatus(orderId, "CANCELLED");
  };

  const canCancel = (status: string) => !["DELIVERED", "CANCELLED"].includes(status);

  const handleDelete = async (orderId: string) => {
    const ok = await confirm({ title: "Delete Order", description: "Permanently delete this order? This cannot be undone.", confirmText: "Delete", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success("Order deleted");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to delete order");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="text-slate-500 text-[15px] mt-0.5">Manage customer orders</p>
        </div>
        <Link href="/orders/new">
          <Button className="bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-10 text-[13.5px] font-semibold">
            <Plus className="h-4 w-4 mr-1.5" />New Order
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search orders..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 w-64 h-10 bg-white border-slate-200" />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { if (v) { setFilterStatus(v); setPage(1); } }}>
          <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
            <span>{statusLabels[filterStatus] || filterStatus}</span>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-36 h-10 bg-white border-slate-200 text-[13px]" />
          <span className="text-slate-400 text-[13px]">to</span>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-36 h-10 bg-white border-slate-200 text-[13px]" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead><SortableHeader label="Order #" field="orderNumber" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Customer" field="customerName" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Items</TableHead>
                <TableHead><SortableHeader label="Total" field="totalAmount" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</TableHead>
                <TableHead><SortableHeader label="Date" field="createdAt" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <ShoppingCart className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No orders found</p>
                </TableCell></TableRow>
              ) : (
                orders.map((o) => {
                  const transitions = VALID_TRANSITIONS[o.status] || [];
                  const showCancel = canCancel(o.status);
                  return (
                    <TableRow key={o.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-[12.5px] text-orange-600 font-semibold">{o.orderNumber}</TableCell>
                      <TableCell className="font-semibold text-[14px] text-slate-700">{o.customerName}</TableCell>
                      <TableCell><span className="text-[13px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{o.items?.length || 0} items</span></TableCell>
                      <TableCell className="text-right font-bold text-[14px] text-slate-800 tabular-nums">${Number(o.totalAmount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-[11px] font-semibold rounded-[4px] ${statusStyles[o.status]}`}>{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-[13px]">{format(new Date(o.createdAt.slice(0, 10) + "T00:00:00"), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* View */}
                            <DropdownMenuItem onClick={() => router.push(`/orders/${o.id}`)} className="gap-2 text-[13px]">
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                              View Details
                            </DropdownMenuItem>

                            {/* Status transitions */}
                            {transitions.length > 0 && <DropdownMenuSeparator />}
                            {transitions.map((t) => (
                              <DropdownMenuItem key={t.status} onClick={() => updateStatus(o.id, t.status)} className="gap-2 text-[13px]">
                                <t.icon className="h-3.5 w-3.5 text-slate-400" />
                                {t.label}
                              </DropdownMenuItem>
                            ))}

                            {/* Cancel */}
                            {showCancel && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCancel(o.id)} className="gap-2 text-[13px] text-red-600 focus:text-red-600">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Cancel Order
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Delete - Admin only */}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(o.id)} className="gap-2 text-[13px] text-red-600 focus:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Order
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination && (
        <DataTablePagination page={page} totalPages={pagination.totalPages} totalResults={pagination.totalResults}
          limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
      )}
    </div>
  );
}
