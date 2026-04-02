"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import api from "@/lib/api";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { RestockEntry, PaginationMeta } from "@/types";

const priorityColors: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700 hover:bg-red-50",
  MEDIUM: "bg-amber-50 text-amber-700 hover:bg-amber-50",
  LOW: "bg-blue-50 text-blue-700 hover:bg-blue-50",
};

const restockSchema = z.object({ quantity: z.coerce.number().int().positive("Quantity must be at least 1") });
type RestockForm = z.infer<typeof restockSchema>;

export default function RestockQueuePage() {
  const [items, setItems] = useState<RestockEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<RestockEntry | null>(null);
  const [filterPriority, setFilterPriority] = useState("all");
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RestockForm>({
    resolver: zodResolver(restockSchema) as any,
  });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (filterPriority !== "all") params.priority = filterPriority;
      const { data } = await api.get("/restock-queue", { params });
      setItems(data.data);
      setPagination(data.meta.pagination);
    } catch { toast.error("Failed to load restock queue"); }
    finally { setLoading(false); }
  }, [page, limit, filterPriority]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const openRestock = (entry: RestockEntry) => {
    setSelected(entry);
    reset({ quantity: entry.threshold - entry.currentStock });
    setDialogOpen(true);
  };

  const onSubmit = async (data: RestockForm) => {
    if (!selected) return;
    try { await api.post(`/restock-queue/${selected.id}/restock`, data); toast.success("Product restocked"); setDialogOpen(false); fetchQueue(); }
    catch (err: any) { toast.error(err.response?.data?.error?.message || "Restock failed"); }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirm({ title: "Remove from Queue", description: "Remove this item from the restock queue?", confirmText: "Remove", variant: "danger" });
    if (!ok) return;
    try { await api.delete(`/restock-queue/${id}`); toast.success("Removed from queue"); fetchQueue(); }
    catch (err: any) { toast.error(err.response?.data?.error?.message || "Remove failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Restock Queue</h1>
        <p className="text-slate-500 text-[15px] mt-0.5">Products that need restocking, ordered by lowest stock</p>
      </div>

      <div className="flex gap-3">
        <Select value={filterPriority} onValueChange={(v) => { if (v) { setFilterPriority(v); setPage(1); } }}>
          <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
            <span>{filterPriority === "all" ? "All Priorities" : filterPriority}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Product</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider text-right">Current Stock</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider text-right">Threshold</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Priority</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <Package className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No items in restock queue</p>
                </TableCell></TableRow>
              ) : (
                items.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <p className="font-semibold text-[14px] text-slate-700">{entry.product.name}</p>
                      <p className="text-[12px] text-slate-400 font-mono">{entry.product.sku}</p>
                    </TableCell>
                    <TableCell><span className="text-[13px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{entry.product.category?.name}</span></TableCell>
                    <TableCell className="text-right font-semibold text-[14px] text-slate-700 tabular-nums">{entry.currentStock}</TableCell>
                    <TableCell className="text-right text-[14px] text-slate-500 tabular-nums">{entry.threshold}</TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-[11px] font-semibold rounded-[4px] ${priorityColors[entry.priority]}`}>{entry.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-8 text-[12px] bg-orange-500 hover:bg-orange-600" onClick={() => openRestock(entry)}>
                          <Package className="h-3 w-3 mr-1" />Restock
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleRemove(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination && (
        <DataTablePagination page={page} totalPages={pagination.totalPages} totalResults={pagination.totalResults}
          limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">Restock: {selected?.product.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-400">Current Stock</p><p className="font-semibold text-slate-700">{selected?.currentStock}</p></div>
              <div><p className="text-slate-400">Min Threshold</p><p className="font-semibold text-slate-700">{selected?.threshold}</p></div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Quantity to Add</Label>
              <Input type="number" min={1} {...register("quantity")} className="h-10 bg-slate-50 border-slate-200 focus:bg-white" />
              {errors.quantity && <p className="text-[13px] text-red-500">{errors.quantity.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 bg-orange-500 hover:bg-orange-600">{isSubmitting ? "Restocking..." : "Confirm Restock"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
