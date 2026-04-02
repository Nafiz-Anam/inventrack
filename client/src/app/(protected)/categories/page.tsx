"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SortableHeader } from "@/components/ui/sortable-header";
import api from "@/lib/api";
import { Category, PaginationMeta } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useConfirm } from "@/components/ui/confirm-dialog";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const confirm = useConfirm();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sortBy, order };
      if (search) params.search = search;
      const { data } = await api.get("/categories", { params });
      setCategories(data.data);
      setPagination(data.meta.pagination);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sortBy, order]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSort = (field: string, dir: "asc" | "desc") => {
    setSortBy(field);
    setOrder(dir);
    setPage(1);
  };

  const openCreate = () => { setEditing(null); reset({ name: "", description: "" }); setDialogOpen(true); };
  const openEdit = (cat: Category) => { setEditing(cat); reset({ name: cat.name, description: cat.description || "" }); setDialogOpen(true); };

  const onSubmit = async (formData: CategoryForm) => {
    try {
      if (editing) { await api.patch(`/categories/${editing.id}`, formData); toast.success("Category updated"); }
      else { await api.post("/categories", formData); toast.success("Category created"); }
      setDialogOpen(false);
      fetchCategories();
    } catch (err: any) { toast.error(err.response?.data?.error?.message || "Operation failed"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Category", description: "Are you sure you want to delete this category? This cannot be undone.", confirmText: "Delete", variant: "danger" });
    if (!ok) return;
    try { await api.delete(`/categories/${id}`); toast.success("Category deleted"); fetchCategories(); }
    catch (err: any) { toast.error(err.response?.data?.error?.message || "Delete failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Categories</h1>
          <p className="text-slate-500 text-[15px] mt-0.5">Manage product categories</p>
        </div>
        <Button onClick={openCreate} className="bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-10 text-[13.5px] font-semibold">
          <Plus className="h-4 w-4 mr-1.5" />Add Category
        </Button>
      </div>

      <div className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search categories..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-10 bg-white border-slate-200" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>
                  <SortableHeader label="Name" field="name" currentSort={sortBy} currentOrder={order} onSort={handleSort} />
                </TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Description</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Products</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : categories.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <FolderTree className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No categories found</p>
                </TableCell></TableRow>
              ) : (
                categories.map((cat) => (
                  <TableRow key={cat.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-[14px] text-slate-700">{cat.name}</TableCell>
                    <TableCell className="text-slate-500 text-[13.5px] max-w-xs truncate">{cat.description || "—"}</TableCell>
                    <TableCell>
                      <span className="text-[13px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">{cat._count?.products ?? 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={cat.isActive
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-[11px] font-semibold rounded-[4px]"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-100 border-0 text-[11px] font-semibold rounded-[4px]"
                      }>{cat.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-orange-600" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDelete(cat.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
        <DataTablePagination
          page={page} totalPages={pagination.totalPages} totalResults={pagination.totalResults}
          limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{editing ? "Edit Category" : "Create Category"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Name</Label>
              <Input {...register("name")} placeholder="e.g. Electronics" className="h-10 bg-slate-50 border-slate-200 focus:bg-white" />
              {errors.name && <p className="text-[13px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-[13px] font-medium">Description</Label>
              <Textarea {...register("description")} placeholder="Optional description" className="bg-slate-50 border-slate-200 focus:bg-white min-h-[80px]" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 bg-linear-to-r from-orange-500 to-orange-600">
                {isSubmitting ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
