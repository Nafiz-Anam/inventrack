"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Truck, CheckCircle, XCircle, Package } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";
import { Order } from "@/types";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const confirm = useConfirm();

  const fetchOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data.order);
    } catch {
      toast.error("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      if (status === "CANCELLED") {
        await api.post(`/orders/${id}/cancel`);
      } else {
        await api.patch(`/orders/${id}/status`, { status });
      }
      toast.success(`Order ${status.toLowerCase()}`);
      fetchOrder();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Failed to update");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-orange-200 border-t-orange-600 rounded-lg animate-spin" />
      </div>
    );
  }

  if (!order) return <p>Order not found</p>;

  const allowedTransitions = TRANSITIONS[order.status] || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(order.createdAt.slice(0, 10) + "T00:00:00"), "MMM d, yyyy")}
          </p>
        </div>
        <Badge variant="secondary" className={`text-sm px-3 py-1 ${statusColors[order.status]}`}>
          {order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-semibold text-lg">{order.customerName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="font-semibold text-lg">${Number(order.totalAmount).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="font-semibold text-lg">{order.items.length} products</p>
          </CardContent>
        </Card>
      </div>

      {order.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">Notes</p>
            <p>{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.product.sku}</TableCell>
                  <TableCell className="text-right">${Number(item.unitPrice).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${Number(item.totalPrice).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Grand Total
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  ${Number(order.totalAmount).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {allowedTransitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {allowedTransitions
                .filter((s) => s !== "CANCELLED")
                .map((status) => (
                  <Button
                    key={status}
                    onClick={() => updateStatus(status)}
                    disabled={updating}
                  >
                    {status === "CONFIRMED" && <CheckCircle className="h-4 w-4 mr-2" />}
                    {status === "SHIPPED" && <Truck className="h-4 w-4 mr-2" />}
                    {status === "DELIVERED" && <Package className="h-4 w-4 mr-2" />}
                    Mark as {status}
                  </Button>
                ))}
              {allowedTransitions.includes("CANCELLED") && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({ title: "Cancel Order", description: "Cancel this order? Stock will be restored to inventory.", confirmText: "Cancel Order", variant: "danger" });
                    if (ok) updateStatus("CANCELLED");
                  }}
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
