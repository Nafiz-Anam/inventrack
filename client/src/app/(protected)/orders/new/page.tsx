"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import api from "@/lib/api";
import { Product } from "@/types";

const orderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Select a product"),
        quantity: z.number().int().positive("Qty must be at least 1"),
      })
    )
    .min(1, "Add at least one item"),
});

type OrderForm = z.infer<typeof orderSchema>;

export default function CreateOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema) as any,
    defaultValues: {
      customerName: "",
      notes: "",
      items: [{ productId: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");

  useEffect(() => {
    api.get("/products", { params: { limit: 100, status: "ACTIVE" } }).then((res) => {
      setProducts(res.data.data);
    });
  }, []);

  const selectedProductIds = watchItems.map((item) => item.productId).filter(Boolean);

  const getItemSubtotal = (index: number) => {
    const product = products.find((p) => p.id === watchItems[index]?.productId);
    if (!product) return 0;
    return Number(product.price) * (watchItems[index]?.quantity || 0);
  };

  const getTotal = () => {
    return watchItems.reduce((sum, _, i) => sum + getItemSubtotal(i), 0);
  };

  const hasStockError = watchItems.some((item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return p && item.quantity > p.stock;
  });

  const hasDuplicates = (() => {
    const ids = watchItems.map((i) => i.productId).filter(Boolean);
    return new Set(ids).size !== ids.length;
  })();

  const hasEmptyProduct = watchItems.some((item) => !item.productId);
  const hasInvalidQty = watchItems.some((item) => !item.quantity || item.quantity < 1);
  const customerName = watch("customerName");
  const isFormValid = !!customerName && !hasEmptyProduct && !hasInvalidQty && !hasStockError && !hasDuplicates;

  const getProductLabel = (productId: string) => {
    const p = products.find((p) => p.id === productId);
    return p ? p.name : null;
  };

  const onSubmit = async (data: OrderForm) => {
    const ids = data.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      toast.error("This product is already added to the order.");
      return;
    }

    // Check stock availability
    for (const item of data.items) {
      const p = products.find((pr) => pr.id === item.productId);
      if (p && item.quantity > p.stock) {
        toast.error(`Only ${p.stock} items available for "${p.name}"`);
        return;
      }
    }

    setLoading(true);
    try {
      await api.post("/orders", data);
      toast.success("Order created successfully");
      router.push("/orders");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Create New Order</h1>
          <p className="text-slate-500 text-[15px] mt-0.5">Fill in the order details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Order items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Items header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-700">Order Items</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[13px] border-slate-200"
                onClick={() => append({ productId: "", quantity: 1 })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Column labels */}
            <div className="hidden sm:grid grid-cols-[1fr_100px_100px_40px] gap-3 px-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Quantity</span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Subtotal</span>
              <span></span>
            </div>

            {/* Item rows */}
            <div className="space-y-3">
              {fields.map((field, index) => {
                const selectedProduct = products.find((p) => p.id === watchItems[index]?.productId);
                const subtotal = getItemSubtotal(index);
                const productName = getProductLabel(watchItems[index]?.productId);
                const qty = watchItems[index]?.quantity || 0;
                const stockExceeded = selectedProduct && qty > selectedProduct.stock;

                return (
                  <div key={field.id} className={`p-4 bg-white border rounded-lg transition-colors ${stockExceeded ? "border-amber-300 bg-amber-50/30" : "border-slate-200"}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_40px] gap-3 items-start">
                      {/* Product select */}
                      <div>
                        <Label className="sm:hidden text-slate-500 text-[12px] mb-1.5 block">Product</Label>
                        <Select
                          value={watchItems[index]?.productId || ""}
                          onValueChange={(v) => v && setValue(`items.${index}.productId` as const, v)}
                        >
                          <SelectTrigger className="w-full h-10 bg-slate-50 border-slate-200">
                            <span className={`truncate ${productName ? "text-slate-700" : "text-slate-400"}`}>
                              {productName || "Select a product"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {products
                              .filter(
                                (p) =>
                                  p.status === "ACTIVE" &&
                                  (!selectedProductIds.includes(p.id) || p.id === watchItems[index]?.productId)
                              )
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} — ${Number(p.price).toFixed(2)} ({p.stock} avail)
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-slate-400 mt-1 pl-1 h-4">
                          {selectedProduct
                            ? `$${Number(selectedProduct.price).toFixed(2)} each · ${selectedProduct.stock} in stock`
                            : "\u00A0"}
                        </p>
                        {errors.items?.[index]?.productId && (
                          <p className="text-[12px] text-red-500 mt-0.5">{errors.items?.[index]?.productId?.message}</p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <Label className="sm:hidden text-slate-500 text-[12px] mb-1.5 block">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          className={`h-10 bg-slate-50 text-center tabular-nums ${stockExceeded ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="text-right pt-2.5">
                        <Label className="sm:hidden text-slate-500 text-[12px] mb-1.5 block">Subtotal</Label>
                        <p className="text-[15px] font-semibold text-slate-700 tabular-nums">
                          ${subtotal.toFixed(2)}
                        </p>
                      </div>

                      {/* Remove */}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-red-500"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stock warning */}
                    {stockExceeded && (
                      <div className="flex items-center gap-2 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-[13px] text-amber-700">
                          Only <span className="font-bold">{selectedProduct.stock} {selectedProduct.stock === 1 ? "item" : "items"}</span> available in stock for <span className="font-semibold">{selectedProduct.name}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {errors.items?.message && (
              <p className="text-[13px] text-red-500">{errors.items.message}</p>
            )}
          </div>

          {/* Right column - Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Customer info */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <h2 className="text-[15px] font-semibold text-slate-700">Customer Info</h2>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[13px] font-medium">Customer Name</Label>
                  <Input
                    {...register("customerName")}
                    placeholder="Enter customer name"
                    className="h-10 bg-slate-50 border-slate-200 focus:bg-white"
                  />
                  {errors.customerName && (
                    <p className="text-[12px] text-red-500">{errors.customerName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500 text-[13px] font-medium">Notes (optional)</Label>
                  <Textarea
                    {...register("notes")}
                    placeholder="Order notes..."
                    className="bg-slate-50 border-slate-200 focus:bg-white min-h-[70px] text-[13.5px]"
                  />
                </div>
              </div>

              {/* Order summary */}
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h2 className="text-[15px] font-semibold text-slate-700 mb-4">Order Summary</h2>

                <div className="space-y-2 mb-4">
                  {watchItems.map((item, i) => {
                    const p = products.find((pr) => pr.id === item.productId);
                    if (!p) return null;
                    return (
                      <div key={i} className="flex justify-between text-[13px]">
                        <span className="text-slate-500 truncate mr-2">
                          {p.name} x{item.quantity || 0}
                        </span>
                        <span className="text-slate-700 font-medium tabular-nums shrink-0">
                          ${(Number(p.price) * (item.quantity || 0)).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                  <span className="text-[13px] font-medium text-slate-500">Total</span>
                  <span className="text-xl font-bold text-slate-800 tabular-nums">
                    ${getTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="w-full h-11 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-[14px] font-semibold disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-lg animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Create Order
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 border-slate-200 text-slate-500"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
