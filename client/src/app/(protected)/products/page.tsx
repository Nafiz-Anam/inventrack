"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SortableHeader } from "@/components/ui/sortable-header";
import api from "@/lib/api";
import { Product, Category, PaginationMeta } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useConfirm } from "@/components/ui/confirm-dialog";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  categoryId: z.string().min(1, "Category is required"),
  price: z.coerce.number().positive("Price must be positive"),
  stock: z.coerce.number().int().min(0),
  minStockThreshold: z.coerce.number().int().min(0).optional().default(5),
  status: z.enum(["ACTIVE", "OUT_OF_STOCK"]).optional().default("ACTIVE"),
  description: z.string().optional(),
});
type ProductForm = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const confirm = useConfirm();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema) as any,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit, sortBy, order };
      if (search) params.search = search;
      if (filterCategory !== "all") params.categoryId = filterCategory;
      if (filterStatus !== "all") params.status = filterStatus;
      const { data } = await api.get("/products", { params });
      setProducts(data.data);
      setPagination(data.meta.pagination);
    } catch { toast.error("Failed to load products"); }
    finally { setLoading(false); }
  }, [page, limit, search, filterCategory, filterStatus, sortBy, order]);

  useEffect(() => { api.get("/categories", { params: { limit: 100 } }).then((res) => setCategories(res.data.data)); }, []);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSort = (field: string, dir: "asc" | "desc") => { setSortBy(field); setOrder(dir); setPage(1); };
  const openCreate = () => { setEditing(null); reset({ name: "", sku: "", categoryId: "", price: 0, stock: 0, minStockThreshold: 5, status: "ACTIVE", description: "" }); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); reset({ name: p.name, sku: p.sku, categoryId: p.categoryId, price: Number(p.price), stock: p.stock, minStockThreshold: p.minStockThreshold, status: p.status, description: p.description || "" }); setDialogOpen(true); };

  const onSubmit = async (formData: ProductForm) => {
    try {
      if (editing) { await api.patch(`/products/${editing.id}`, formData); toast.success("Product updated"); }
      else { await api.post("/products", formData); toast.success("Product created"); }
      setDialogOpen(false); fetchProducts();
    } catch (err: any) { toast.error(err.response?.data?.error?.message || "Operation failed"); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Delete Product", description: "Are you sure you want to delete this product? This cannot be undone.", confirmText: "Delete", variant: "danger" });
    if (!ok) return;
    try { await api.delete(`/products/${id}`); toast.success("Product deleted"); fetchProducts(); }
    catch (err: any) { toast.error(err.response?.data?.error?.message || "Delete failed"); }
  };

  const stockBadge = (p: Product) => {
    if (p.status === "OUT_OF_STOCK") return <Badge className="bg-red-50 text-red-600 hover:bg-red-50 border-0 text-[11px] font-semibold rounded-[4px]">Out of Stock</Badge>;
    if (p.stock <= p.minStockThreshold) return <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50 border-0 text-[11px] font-semibold rounded-[4px]">Low Stock</Badge>;
    return <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0 text-[11px] font-semibold rounded-[4px]">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-[15px] mt-0.5">Manage your product inventory</p>
        </div>
        <Button onClick={openCreate} className="bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-10 text-[13.5px] font-semibold">
          <Plus className="h-4 w-4 mr-1.5" />Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search products..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 w-64 h-10 bg-white border-slate-200" />
        </div>
        <Select value={filterCategory} onValueChange={(v) => { if (v) { setFilterCategory(v); setPage(1); } }}>
          <SelectTrigger className="w-48 h-10 bg-white border-slate-200">
            <span className="truncate">{filterCategory === "all" ? "All Categories" : categories.find(c => c.id === filterCategory)?.name || "Category"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { if (v) { setFilterStatus(v); setPage(1); } }}>
          <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
            <span>{filterStatus === "all" ? "All Statuses" : filterStatus === "ACTIVE" ? "Active" : "Out of Stock"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead><SortableHeader label="Product" field="name" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">SKU</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Category</TableHead>
                <TableHead><SortableHeader label="Price" field="price" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Stock" field="stock" currentSort={sortBy} currentOrder={order} onSort={handleSort} /></TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="h-6 w-6 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin mx-auto" />
                </TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <Package className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-[14px]">No products found</p>
                </TableCell></TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <p className="font-semibold text-[14px] text-slate-700">{p.name}</p>
                      {p.description && <p className="text-[12px] text-slate-400 truncate max-w-[200px]">{p.description}</p>}
                    </TableCell>
                    <TableCell className="text-slate-400 font-mono text-[12.5px]">{p.sku}</TableCell>
                    <TableCell><span className="text-[13px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{p.category?.name}</span></TableCell>
                    <TableCell className="text-right font-semibold text-[14px] text-slate-700 tabular-nums">${Number(p.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-[14px] text-slate-700 tabular-nums">{p.stock}</TableCell>
                    <TableCell>{stockBadge(p)}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-orange-600" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        {isAdmin && (<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>)}
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
        <DialogContent className="max-w-[560px] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-[17px] font-bold text-slate-800">
                {editing ? "Edit Product" : "Add New Product"}
              </DialogTitle>
              <p className="text-[13px] text-slate-400 mt-0.5">
                {editing ? "Update the product details below" : "Fill in the details to add a new product"}
              </p>
            </DialogHeader>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
              {/* Name + SKU row */}
              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Product Name</Label>
                  <Input {...register("name")} placeholder="e.g. iPhone 15 Pro" className="h-10 bg-white border-slate-200" />
                  {errors.name && <p className="text-[12px] text-red-500">{errors.name.message}</p>}
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">SKU</Label>
                  <Input {...register("sku")} placeholder="ELEC-001" className="h-10 bg-white border-slate-200 font-mono text-[13px]" />
                  {errors.sku && <p className="text-[12px] text-red-500">{errors.sku.message}</p>}
                </div>
              </div>

              {/* Category + Status row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Category</Label>
                  <Select value={watch("categoryId") || ""} onValueChange={(v) => v && setValue("categoryId", v)}>
                    <SelectTrigger className="h-10 bg-white border-slate-200">
                      <span className={watch("categoryId") ? "text-slate-700" : "text-slate-400"}>
                        {watch("categoryId") ? categories.find(c => c.id === watch("categoryId"))?.name || "Select" : "Select category"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && <p className="text-[12px] text-red-500">{errors.categoryId.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Status</Label>
                  <Select value={watch("status") || "ACTIVE"} onValueChange={(v) => v && setValue("status", v as "ACTIVE" | "OUT_OF_STOCK")}>
                    <SelectTrigger className="h-10 bg-white border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-sm ${watch("status") === "OUT_OF_STOCK" ? "bg-red-500" : "bg-emerald-500"}`} />
                        <span className="text-slate-700">{watch("status") === "OUT_OF_STOCK" ? "Out of Stock" : "Active"}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-emerald-500" />Active
                        </div>
                      </SelectItem>
                      <SelectItem value="OUT_OF_STOCK">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-red-500" />Out of Stock
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Price + Stock + Threshold row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Price ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]">$</span>
                    <Input type="number" step="0.01" {...register("price")} placeholder="0.00" className="h-10 pl-7 bg-white border-slate-200 tabular-nums" />
                  </div>
                  {errors.price && <p className="text-[12px] text-red-500">{errors.price.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Stock Qty</Label>
                  <Input type="number" {...register("stock")} placeholder="0" className="h-10 bg-white border-slate-200 tabular-nums" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Min Threshold</Label>
                  <Input type="number" {...register("minStockThreshold")} placeholder="5" className="h-10 bg-white border-slate-200 tabular-nums" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-slate-600 text-[12.5px] font-semibold uppercase tracking-wide">Description</Label>
                <Textarea {...register("description")} placeholder="Brief product description (optional)" className="bg-white border-slate-200 min-h-[80px] text-[13.5px] resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-10 px-5 border-slate-200 text-slate-600">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-10 px-6 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-[13.5px] font-semibold">
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-lg animate-spin" />
                ) : editing ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
