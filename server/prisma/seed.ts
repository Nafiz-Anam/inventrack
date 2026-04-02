import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60));
  return d;
}

async function main() {
  console.log('Clearing existing data...');
  await prisma.inventoryActivity.deleteMany();
  await prisma.restockQueue.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.device.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.token.deleteMany();

  console.log('Seeding users...');
  const hashedDemo = await bcrypt.hash('Demo@1234', 10);
  const hashedAdmin = await bcrypt.hash('Admin@1234', 10);

  // Keep existing users or create new
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: { password: hashedDemo },
    create: { email: 'demo@example.com', name: 'Demo User', password: hashedDemo, role: 'USER', isEmailVerified: true },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { password: hashedAdmin },
    create: { email: 'admin@example.com', name: 'Admin User', password: hashedAdmin, role: 'ADMIN', isEmailVerified: true },
  });

  console.log('Seeding categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Electronics', description: 'Electronic devices, gadgets, and accessories', createdBy: adminUser.id } }),
    prisma.category.create({ data: { name: 'Clothing & Fashion', description: 'Apparel, shoes, and fashion accessories', createdBy: adminUser.id } }),
    prisma.category.create({ data: { name: 'Grocery', description: 'Food, beverages, and household essentials', createdBy: adminUser.id } }),
    prisma.category.create({ data: { name: 'Books & Stationery', description: 'Books, notebooks, and office supplies', createdBy: adminUser.id } }),
    prisma.category.create({ data: { name: 'Home & Kitchen', description: 'Appliances, cookware, and home decor', createdBy: adminUser.id } }),
    prisma.category.create({ data: { name: 'Sports & Fitness', description: 'Sports gear, gym equipment, and outdoor items', createdBy: adminUser.id } }),
  ]);
  const [electronics, clothing, grocery, books, homeKitchen, sports] = categories;

  console.log('Seeding products...');
  const productsData = [
    // Electronics
    { name: 'iPhone 15 Pro', sku: 'ELEC-001', categoryId: electronics.id, price: 999.99, stock: 8, minStockThreshold: 10, description: 'Apple iPhone 15 Pro 256GB Titanium' },
    { name: 'Samsung Galaxy S24', sku: 'ELEC-002', categoryId: electronics.id, price: 849.99, stock: 15, minStockThreshold: 10, description: 'Samsung Galaxy S24 Ultra 256GB' },
    { name: 'MacBook Air M3', sku: 'ELEC-003', categoryId: electronics.id, price: 1299.99, stock: 0, minStockThreshold: 5, description: 'Apple MacBook Air 15" M3 chip' },
    { name: 'Sony WH-1000XM5', sku: 'ELEC-004', categoryId: electronics.id, price: 349.99, stock: 22, minStockThreshold: 10, description: 'Wireless noise-cancelling headphones' },
    { name: 'iPad Pro 12.9"', sku: 'ELEC-005', categoryId: electronics.id, price: 1099.99, stock: 4, minStockThreshold: 8, description: 'Apple iPad Pro M4 chip 256GB' },
    // Clothing
    { name: 'Classic Cotton T-Shirt', sku: 'CLTH-001', categoryId: clothing.id, price: 24.99, stock: 120, minStockThreshold: 30, description: 'Premium 100% cotton crew neck tee' },
    { name: 'Slim Fit Denim Jeans', sku: 'CLTH-002', categoryId: clothing.id, price: 59.99, stock: 45, minStockThreshold: 15, description: 'Stretch denim slim fit jeans' },
    { name: 'Running Shoes Pro', sku: 'CLTH-003', categoryId: clothing.id, price: 129.99, stock: 3, minStockThreshold: 10, description: 'Lightweight performance running shoes' },
    { name: 'Winter Jacket', sku: 'CLTH-004', categoryId: clothing.id, price: 189.99, stock: 0, minStockThreshold: 8, description: 'Waterproof insulated winter parka' },
    // Grocery
    { name: 'Organic Basmati Rice 5kg', sku: 'GROC-001', categoryId: grocery.id, price: 14.99, stock: 80, minStockThreshold: 25, description: 'Premium aged organic basmati rice' },
    { name: 'Extra Virgin Olive Oil 1L', sku: 'GROC-002', categoryId: grocery.id, price: 12.99, stock: 6, minStockThreshold: 15, description: 'Cold-pressed Italian olive oil' },
    { name: 'Japanese Green Tea 100pk', sku: 'GROC-003', categoryId: grocery.id, price: 8.99, stock: 0, minStockThreshold: 20, description: 'Authentic Japanese sencha tea bags' },
    // Books
    { name: 'Clean Code', sku: 'BOOK-001', categoryId: books.id, price: 39.99, stock: 18, minStockThreshold: 5, description: 'Robert C. Martin — A Handbook of Agile Software Craftsmanship' },
    { name: 'System Design Interview', sku: 'BOOK-002', categoryId: books.id, price: 34.99, stock: 25, minStockThreshold: 8, description: 'Alex Xu — An Insider\'s Guide' },
    { name: 'The Pragmatic Programmer', sku: 'BOOK-003', categoryId: books.id, price: 44.99, stock: 7, minStockThreshold: 5, description: 'David Thomas & Andrew Hunt — 20th Anniversary Edition' },
    // Home & Kitchen
    { name: 'Instant Pot Duo 6Qt', sku: 'HOME-001', categoryId: homeKitchen.id, price: 89.99, stock: 12, minStockThreshold: 5, description: '7-in-1 electric pressure cooker' },
    { name: 'Vitamix Blender', sku: 'HOME-002', categoryId: homeKitchen.id, price: 449.99, stock: 2, minStockThreshold: 4, description: 'Professional-grade blending system' },
    { name: 'HEPA Air Purifier', sku: 'HOME-003', categoryId: homeKitchen.id, price: 199.99, stock: 9, minStockThreshold: 5, description: 'Large room air purifier with HEPA filter' },
    // Sports
    { name: 'Yoga Mat Premium', sku: 'SPRT-001', categoryId: sports.id, price: 49.99, stock: 30, minStockThreshold: 10, description: 'Non-slip 6mm thick exercise mat' },
    { name: 'Adjustable Dumbbells', sku: 'SPRT-002', categoryId: sports.id, price: 299.99, stock: 5, minStockThreshold: 8, description: '5-52.5 lbs adjustable dumbbell set' },
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const status = p.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
    const product = await prisma.product.create({ data: { ...p, status: status as any, createdBy: adminUser.id } });
    products.push(product);
  }

  console.log('Seeding restock queue...');
  for (const product of products) {
    if (product.stock <= product.minStockThreshold) {
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (product.stock === 0 || product.stock <= Math.floor(product.minStockThreshold * 0.3)) priority = 'HIGH';
      else if (product.stock <= Math.floor(product.minStockThreshold * 0.6)) priority = 'MEDIUM';

      await prisma.restockQueue.create({
        data: { productId: product.id, currentStock: product.stock, threshold: product.minStockThreshold, priority },
      });
    }
  }

  console.log('Seeding orders (last 10 days)...');
  const customers = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Ross', 'Edward Kim', 'Fiona Chen', 'George Park', 'Hannah Lee', 'Ivan Rodriguez', 'Julia White'];
  const statuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
  const activeProducts = products.filter((p: any) => p.stock > 0);

  for (let day = 9; day >= 0; day--) {
    const ordersPerDay = day === 0 ? 3 : Math.floor(Math.random() * 3) + 1; // 1-3 orders per day, 3 today
    for (let o = 0; o < ordersPerDay; o++) {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - day);
      orderDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ORD-${dateStr}-${String(o + 1).padStart(4, '0')}`;

      // Pick 1-3 random products
      const itemCount = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...activeProducts].sort(() => Math.random() - 0.5);
      const selectedProducts = shuffled.slice(0, Math.min(itemCount, shuffled.length));

      let totalAmount = 0;
      const itemsData = selectedProducts.map((p: any) => {
        const qty = Math.floor(Math.random() * 3) + 1;
        const price = Number(p.price);
        const itemTotal = price * qty;
        totalAmount += itemTotal;
        return { productId: p.id, quantity: qty, unitPrice: price, totalPrice: itemTotal };
      });

      // Assign status based on age
      let status: typeof statuses[number];
      if (day === 0) status = 'PENDING';
      else if (day <= 2) status = Math.random() > 0.3 ? 'CONFIRMED' : 'PENDING';
      else if (day <= 5) status = Math.random() > 0.3 ? 'SHIPPED' : 'CONFIRMED';
      else if (day <= 8) status = Math.random() > 0.2 ? 'DELIVERED' : 'SHIPPED';
      else status = 'DELIVERED';
      // Some cancelled
      if (Math.random() < 0.1) status = 'CANCELLED';

      const creator = Math.random() > 0.5 ? demoUser.id : adminUser.id;

      await prisma.order.create({
        data: {
          orderNumber,
          customerName: customers[Math.floor(Math.random() * customers.length)],
          totalAmount,
          status,
          createdBy: creator,
          createdAt: orderDate,
          items: { create: itemsData },
        },
      });
    }
  }

  console.log('Seeding activity log (last 10 days)...');
  const activityData = [
    { action: 'CREATE', entityType: 'Product', description: 'Product "iPhone 15 Pro" added with 8 units', userId: adminUser.id, createdAt: daysAgo(9) },
    { action: 'CREATE', entityType: 'Product', description: 'Product "Samsung Galaxy S24" added with 15 units', userId: adminUser.id, createdAt: daysAgo(9) },
    { action: 'CREATE', entityType: 'Category', description: 'Category "Sports & Fitness" created', userId: adminUser.id, createdAt: daysAgo(8) },
    { action: 'CREATE', entityType: 'Order', description: 'Order ORD-20260323-0001 created by user', userId: demoUser.id, createdAt: daysAgo(8) },
    { action: 'UPDATE', entityType: 'Order', description: 'Order ORD-20260323-0001 marked as CONFIRMED', userId: adminUser.id, createdAt: daysAgo(7) },
    { action: 'UPDATE', entityType: 'Product', description: 'Stock updated for "Sony WH-1000XM5"', userId: adminUser.id, createdAt: daysAgo(7) },
    { action: 'RESTOCK', entityType: 'Product', description: 'Stock updated for "Running Shoes Pro" (+20 units)', userId: adminUser.id, createdAt: daysAgo(6) },
    { action: 'CREATE', entityType: 'RestockQueue', description: 'Product "MacBook Air M3" added to Restock Queue', userId: adminUser.id, createdAt: daysAgo(6) },
    { action: 'UPDATE', entityType: 'Order', description: 'Order ORD-20260324-0001 marked as SHIPPED', userId: demoUser.id, createdAt: daysAgo(5) },
    { action: 'CREATE', entityType: 'Order', description: 'Order ORD-20260325-0001 created by user', userId: demoUser.id, createdAt: daysAgo(5) },
    { action: 'UPDATE', entityType: 'Order', description: 'Order ORD-20260323-0001 marked as DELIVERED', userId: adminUser.id, createdAt: daysAgo(4) },
    { action: 'CANCEL', entityType: 'Order', description: 'Order ORD-20260325-0002 cancelled', userId: demoUser.id, createdAt: daysAgo(4) },
    { action: 'CREATE', entityType: 'Product', description: 'Product "Adjustable Dumbbells" added with 5 units', userId: adminUser.id, createdAt: daysAgo(3) },
    { action: 'UPDATE', entityType: 'Product', description: 'Stock updated for "iPad Pro 12.9"', userId: adminUser.id, createdAt: daysAgo(2) },
    { action: 'CREATE', entityType: 'Order', description: 'Order ORD-20260330-0001 created by user', userId: adminUser.id, createdAt: daysAgo(1) },
    { action: 'UPDATE', entityType: 'Order', description: 'Order ORD-20260330-0001 marked as CONFIRMED', userId: adminUser.id, createdAt: daysAgo(1) },
    { action: 'CREATE', entityType: 'Order', description: 'New order created today', userId: demoUser.id, createdAt: new Date() },
    { action: 'UPDATE', entityType: 'Product', description: 'Stock updated for "Extra Virgin Olive Oil 1L"', userId: adminUser.id, createdAt: new Date() },
  ];

  for (const a of activityData) {
    await prisma.inventoryActivity.create({ data: a });
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => { console.error('Seeding failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
