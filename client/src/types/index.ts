export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  stock: number;
  minStockThreshold: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK';
  description: string | null;
  createdAt: string;
  category: { id: string; name: string };
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    id: string;
    name: string;
    sku: string;
    category?: { name: string };
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
  creator?: { id: string; name: string; email: string };
}

export interface RestockEntry {
  id: string;
  productId: string;
  currentStock: number;
  threshold: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'COMPLETED';
  restockQuantity: number | null;
  createdAt: string;
  product: Product;
}

export interface Activity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: any;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface DashboardStats {
  totalOrdersToday: number;
  pendingOrders: number;
  completedOrders: number;
  lowStockItems: number;
  revenueToday: number;
  productSummary: {
    id: string;
    name: string;
    stock: number;
    minStockThreshold: number;
    status: string;
    category: { name: string };
  }[];
  recentActivities: Activity[];
  totalProducts: number;
  totalCategories: number;
  ordersByStatus: { status: string; count: number }[];
  revenueChart: { date: string; revenue: number; pending: number; completed: number; total: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    _count: { items: number };
  }[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface AuthTokens {
  access: { token: string; expires: string };
  refresh: { token: string; expires: string };
}
