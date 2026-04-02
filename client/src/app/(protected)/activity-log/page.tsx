"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ShoppingCart, Package, FolderTree, AlertTriangle, Activity as ActivityIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import api from "@/lib/api";
import { Activity, PaginationMeta } from "@/types";
import { format } from "date-fns";

const entityIcons: Record<string, any> = {
  Order: ShoppingCart,
  Product: Package,
  Category: FolderTree,
  RestockQueue: AlertTriangle,
};

const actionStyles: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  UPDATE: "bg-blue-50 text-blue-700 hover:bg-blue-50",
  DELETE: "bg-red-50 text-red-600 hover:bg-red-50",
  CANCEL: "bg-amber-50 text-amber-700 hover:bg-amber-50",
  RESTOCK: "bg-orange-50 text-orange-700 hover:bg-orange-50",
};

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (filterEntity !== "all") params.entityType = filterEntity;
      const { data } = await api.get("/activity-log", { params });
      setActivities(data.data);
      setPagination(data.meta.pagination);
    } catch {
      toast.error("Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterEntity]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const entityLabels: Record<string, string> = {
    all: "All Types", Order: "Orders", Product: "Products",
    Category: "Categories", RestockQueue: "Restock",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
        <p className="text-slate-500 text-[15px] mt-0.5">Recent system actions and events</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterEntity} onValueChange={(v) => { if (v) { setFilterEntity(v); setPage(1); } }}>
          <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
            <span>{entityLabels[filterEntity] || filterEntity}</span>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(entityLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[90px]">Action</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Description</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">User</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : activities.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <ActivityIcon className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No activity recorded</p>
                </TableCell></TableRow>
              ) : (
                activities.map((a) => {
                  const Icon = entityIcons[a.entityType] || ActivityIcon;
                  return (
                    <TableRow key={a.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <Badge className={`border-0 text-[11px] font-semibold rounded-[4px] ${actionStyles[a.action] || "bg-slate-100 text-slate-600 hover:bg-slate-100"}`}>
                          {a.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="text-[13.5px] text-slate-700">{a.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{a.entityType}</span>
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-500">
                        {a.user?.name || a.user?.email || "—"}
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-400">
                        {format(new Date(a.createdAt), "MMM d, h:mm a")}
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
