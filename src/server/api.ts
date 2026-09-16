import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { readDb, writeDb, logAudit, getInitialData, getMongoDb } from './db.js';
import {
  authenticateToken,
  requireAdmin,
  generateToken,
  AuthenticatedRequest,
} from './auth.js';
import {
  Product,
  Customer,
  Supplier,
  Invoice,
  InvoiceItem,
  StockTransaction,
  Payment,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  ReturnRecord,
} from '../types/index.js';

export const apiRouter = express.Router();

// -------------------------------------------------------------
// 1. AUTHENTICATION
// -------------------------------------------------------------

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const db = readDb();
  const user = db.users.find(
    (u) =>
      u.username.toLowerCase() === username.trim().toLowerCase() ||
      u.email.toLowerCase() === username.trim().toLowerCase()
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = generateToken(user);
  logAudit(user.id, user.name, 'USER_LOGIN', 'Auth', `User logged in: ${user.username}`);

  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

apiRouter.put('/auth/me/credentials', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newUsername, newPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.' });
  }

  const db = readDb();
  const userIndex = db.users.findIndex((u) => u.id === req.user?.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }
  
  const user = db.users[userIndex];
  
  // Verify current password
  const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  // Update credentials
  if (newUsername && newUsername.trim()) {
    // Check if new username is already taken by another user
    const exists = db.users.find(u => u.id !== user.id && u.username.toLowerCase() === newUsername.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    db.users[userIndex].username = newUsername.trim();
  }
  
  if (newPassword && newPassword.trim()) {
    const salt = bcrypt.genSaltSync(10);
    db.users[userIndex].passwordHash = bcrypt.hashSync(newPassword.trim(), salt);
  }

  writeDb(db);
  logAudit(user.id, user.name, 'CREDENTIALS_UPDATE', 'Auth', 'User updated their credentials');

  res.json({ message: 'Credentials updated successfully' });
});

// -------------------------------------------------------------
// 1.5 USERS MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/users', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  const db = readDb();
  // Return users without password hashes
  const safeUsers = db.users.map(({ passwordHash: _, ...u }) => u);
  res.json(safeUsers);
});

apiRouter.post('/users', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { name, username, email, role, status, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Name, username, and password are required.' });
  }

  const existing = db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newUser = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    username: username.trim(),
    email: email?.trim() || '',
    role: role || 'staff',
    status: status || 'active',
    phone: '',
    createdAt: new Date().toISOString(),
    passwordHash: bcrypt.hashSync(password, salt),
  };

  db.users.push(newUser);
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'USER_CREATED', 'Users', `Created user ${newUser.username}`);
  writeDb(db);

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

apiRouter.put('/users/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const index = db.users.findIndex((u) => u.id === req.params.id);
  
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  
  const { name, username, email, role, status, password } = req.body;
  const user = db.users[index];

  if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
    const existing = db.users.find((u) => u.id !== user.id && u.username.toLowerCase() === username.trim().toLowerCase());
    if (existing) return res.status(400).json({ error: 'Username is already taken.' });
    user.username = username.trim();
  }

  if (name) user.name = name.trim();
  if (email !== undefined) user.email = email.trim();
  if (role) user.role = role;
  if (status) user.status = status;
  
  if (password && password.trim()) {
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(password.trim(), salt);
  }

  db.users[index] = user;
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'USER_UPDATED', 'Users', `Updated user ${user.username}`);
  writeDb(db);

  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// -------------------------------------------------------------
// 2. DASHBOARD
// -------------------------------------------------------------

apiRouter.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const todayStr = new Date().toISOString().split('T')[0];

  let products: any = db.products;
  let invoices: any = db.invoices;

  if (mongoDb) {
    products = await mongoDb.collection('products').find().toArray();
    invoices = await mongoDb.collection('invoices').find().sort({ date: -1 }).toArray();
  }

  const todayInvoices = invoices.filter((inv: any) => inv.date.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((acc: number, inv: any) => acc + inv.grandTotal, 0);
  const todayInvoiceCount = todayInvoices.length;

  // Calculate profit: revenue minus product purchase price
  const productCostMap = new Map<string, number>();
  products.forEach((p: any) => productCostMap.set(p.id, p.purchasePrice));

  let todayCost = 0;
  todayInvoices.forEach((inv) => {
    inv.items.forEach((item) => {
      const cost = productCostMap.get(item.productId) || item.rate * 0.75;
      todayCost += cost * item.quantity;
    });
  });
  const todayProfit = Math.max(0, todaySales - todayCost);

  // Purchases today
  const todayPurchases = db.supplierLedgers
    .filter((entry) => entry.type === 'purchase' && entry.date.startsWith(todayStr))
    .reduce((acc, entry) => acc + entry.credit, 0);

  // Total Outstanding Receivables from customers
  const totalReceivables = db.customers.reduce((acc, c) => acc + (c.currentOutstanding || 0), 0);
  // Total Payables to suppliers
  const totalPayables = db.suppliers.reduce((acc, s) => acc + (s.currentPayable || 0), 0);

  const totalProducts = products.length;
  const lowStockProducts = products.filter(
    (p: any) => p.currentStock > 0 && p.currentStock <= p.minStockLevel
  ).length;
  const outOfStockProducts = products.filter((p: any) => p.currentStock <= 0).length;

  // Daily sales for last 7 days
  const dailySales: { date: string; sales: number; profit: number; invoices: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayInvoices = invoices.filter((inv: any) => inv.date.startsWith(dateStr));
    const daySales = dayInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

    let dayCost = 0;
    dayInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        const cost = productCostMap.get(item.productId) || item.rate * 0.75;
        dayCost += cost * item.quantity;
      });
    });

    dailySales.push({
      date: dateStr,
      sales: daySales,
      profit: Math.max(0, daySales - dayCost),
      invoices: dayInvoices.length,
    });
  }

  // Monthly sales (last 6 months)
  const monthlySales: { month: string; sales: number; purchases: number }[] = [
    { month: 'Apr 2026', sales: 185000, purchases: 142000 },
    { month: 'May 2026', sales: 215000, purchases: 168000 },
    { month: 'Jun 2026', sales: 240000, purchases: 180000 },
    { month: 'Jul 2026', sales: 198000, purchases: 155000 },
    { month: 'Aug 2026', sales: 285000, purchases: 210000 },
    { month: 'Sep 2026', sales: Math.max(75000, invoices.reduce((a: any, b: any) => a + b.grandTotal, 0)), purchases: 65000 },
  ];

  // Top selling products
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  invoices.forEach((inv: any) => {
    inv.items.forEach((item) => {
      const existing = productSalesMap.get(item.productName) || {
        name: item.productName,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.totalAmount;
      productSalesMap.set(item.productName, existing);
    });
  });
  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Payment Breakdown
  const paymentMap = new Map<string, { amount: number; count: number }>();
  invoices.forEach((inv: any) => {
    const existing = paymentMap.get(inv.paymentMode) || { amount: 0, count: 0 };
    existing.amount += inv.paidAmount;
    existing.count += 1;
    paymentMap.set(inv.paymentMode, existing);
  });
  const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));

  res.json({
    todaySales,
    todayPurchases,
    todayProfit,
    totalOutstanding: totalReceivables,
    totalReceivables,
    totalPayables,
    totalProducts,
    lowStockProducts,
    outOfStockProducts,
    todayInvoiceCount,
    dailySales,
    monthlySales,
    topProducts,
    paymentBreakdown,
    recentInvoices: invoices.slice(0, 5).map((i: any) => { const { _id, ...rest } = i; return rest; }),
    recentStockUpdates: db.stockTransactions.slice(0, 5),
    recentPayments: db.payments.slice(0, 5),
  });
});

// -------------------------------------------------------------
// 3. PRODUCTS
// -------------------------------------------------------------

apiRouter.get('/products', authenticateToken, async (req: Request, res: Response) => {
  const { q, category, brand, stockStatus, sort } = req.query;
  const mongoDb = getMongoDb();

  if (mongoDb) {
    const col = mongoDb.collection('products');
    const query: any = {};

    if (q && typeof q === 'string') {
      const qLower = q.toLowerCase();
      query.$or = [
        { name: { $regex: qLower, $options: 'i' } },
        { sku: { $regex: qLower, $options: 'i' } },
        { barcode: { $regex: qLower, $options: 'i' } },
        { brand: { $regex: qLower, $options: 'i' } },
        { modelNumber: { $regex: qLower, $options: 'i' } }
      ];
    }

    if (category && typeof category === 'string' && category !== 'All') {
      query.category = category;
    }

    if (brand && typeof brand === 'string' && brand !== 'All') {
      query.brand = brand;
    }

    if (stockStatus && typeof stockStatus === 'string') {
      if (stockStatus === 'low') {
        query.$expr = { $and: [ { $gt: ["$currentStock", 0] }, { $lte: ["$currentStock", "$minStockLevel"] } ] };
      } else if (stockStatus === 'out') {
        query.currentStock = { $lte: 0 };
      } else if (stockStatus === 'in_stock') {
        query.$expr = { $gt: ["$currentStock", "$minStockLevel"] };
      }
    }

    let sortOpt: any = { createdAt: -1 };
    if (sort && typeof sort === 'string') {
      if (sort === 'name_asc') sortOpt = { name: 1 };
      if (sort === 'name_desc') sortOpt = { name: -1 };
      if (sort === 'price_asc') sortOpt = { sellingPrice: 1 };
      if (sort === 'price_desc') sortOpt = { sellingPrice: -1 };
      if (sort === 'stock_asc') sortOpt = { currentStock: 1 };
      if (sort === 'stock_desc') sortOpt = { currentStock: -1 };
    }

    const products = await col.find(query).sort(sortOpt).toArray();
    // Strip MongoDB _id to match types
    const cleanProducts = products.map((p: any) => {
      const { _id, ...rest } = p;
      return rest;
    });
    return res.json(cleanProducts);
  }

  // Fallback to in-memory JSON cache
  const db = readDb();
  let filtered = [...db.products];

  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.barcode.includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.modelNumber.toLowerCase().includes(query)
    );
  }

  if (category && typeof category === 'string' && category !== 'All') {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (brand && typeof brand === 'string' && brand !== 'All') {
    filtered = filtered.filter((p) => p.brand === brand);
  }

  if (stockStatus && typeof stockStatus === 'string') {
    if (stockStatus === 'low') {
      filtered = filtered.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel);
    } else if (stockStatus === 'out') {
      filtered = filtered.filter((p) => p.currentStock <= 0);
    } else if (stockStatus === 'in_stock') {
      filtered = filtered.filter((p) => p.currentStock > p.minStockLevel);
    }
  }

  if (sort && typeof sort === 'string') {
    if (sort === 'name_asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'name_desc') filtered.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === 'price_asc') filtered.sort((a, b) => a.sellingPrice - b.sellingPrice);
    if (sort === 'price_desc') filtered.sort((a, b) => b.sellingPrice - a.sellingPrice);
    if (sort === 'stock_asc') filtered.sort((a, b) => a.currentStock - b.currentStock);
    if (sort === 'stock_desc') filtered.sort((a, b) => b.currentStock - a.currentStock);
  } else {
    // Default newest first
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  res.json(filtered);
});

apiRouter.get('/products/:id', authenticateToken, async (req: Request, res: Response) => {
  const mongoDb = getMongoDb();
  if (mongoDb) {
    const product = await mongoDb.collection('products').findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { _id, ...rest } = product as any;
    return res.json(rest);
  }

  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

apiRouter.post('/products', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const {
    sku,
    name,
    category,
    brand,
    modelNumber,
    barcode,
    description,
    purchasePrice,
    sellingPrice,
    mrp,
    gstRate,
    discountPercent,
    openingStock,
    minStockLevel,
    unit,
    supplierId,
    supplierName,
    warrantyPeriod,
  } = req.body;

  if (!sku || !name || !category || !brand) {
    return res.status(400).json({ error: 'SKU, Product Name, Category and Brand are required.' });
  }

  if (mongoDb) {
    const existingSku = await mongoDb.collection('products').findOne({ sku: new RegExp(`^${sku.trim()}$`, 'i') });
    if (existingSku) {
      return res.status(400).json({ error: `A product with SKU "${sku}" already exists.` });
    }
  } else {
    const existingSku = db.products.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase());
    if (existingSku) {
      return res.status(400).json({ error: `A product with SKU "${sku}" already exists.` });
    }
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    sku: sku.trim().toUpperCase(),
    name: name.trim(),
    category: category.trim(),
    brand: brand.trim(),
    modelNumber: modelNumber?.trim() || '',
    barcode: barcode?.trim() || `890${Math.floor(100000000 + Math.random() * 900000000)}`,
    description: description?.trim() || '',
    purchasePrice: Number(purchasePrice) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    mrp: Number(mrp) || Number(sellingPrice) || 0,
    gstRate: Number(gstRate) || 18,
    discountPercent: Number(discountPercent) || 0,
    openingStock: Number(openingStock) || 0,
    currentStock: Number(openingStock) || 0,
    minStockLevel: Number(minStockLevel) || 5,
    unit: unit || 'Nos',
    supplierId: supplierId || undefined,
    supplierName: supplierName || undefined,
    warrantyPeriod: warrantyPeriod || 'N/A',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (mongoDb) {
    await mongoDb.collection('products').insertOne({ ...newProduct });
  }
  db.products.unshift(newProduct);

  // Update category product count
  const cat = db.categories.find((c) => c.name === newProduct.category);
  if (cat) cat.productCount = (cat.productCount || 0) + 1;

  // Log opening stock transaction
  const stockTx: StockTransaction = {
    id: `stk-${Date.now()}`,
    productId: newProduct.id,
    productName: newProduct.name,
    type: 'opening',
    quantity: newProduct.currentStock,
    previousStock: 0,
    updatedStock: newProduct.currentStock,
    userId: req.user?.id || 'usr-admin',
    userName: req.user?.name || 'Admin',
    remarks: 'Initial opening stock upon product creation',
    date: new Date().toISOString(),
  };
  db.stockTransactions.unshift(stockTx);

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'PRODUCT_CREATED',
    'Inventory',
    `Created product ${newProduct.name} (${newProduct.sku})`,
    newProduct.id
  );

  writeDb(db);
  res.status(201).json(newProduct);
});

apiRouter.put('/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const index = db.products.findIndex((p) => p.id === req.params.id);
  if (index === -1 && !mongoDb) return res.status(404).json({ error: 'Product not found' });

  let existing: any = db.products[index];
  if (mongoDb) {
    existing = await mongoDb.collection('products').findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Product not found' });
  }

  const { sku, name, category, brand } = req.body;

  if (sku && sku.toLowerCase() !== existing.sku.toLowerCase()) {
    if (mongoDb) {
      const skuDuplicate = await mongoDb.collection('products').findOne({ 
        id: { $ne: existing.id }, 
        sku: new RegExp(`^${sku.trim()}$`, 'i') 
      });
      if (skuDuplicate) {
        return res.status(400).json({ error: `SKU "${sku}" is already assigned to another product.` });
      }
    } else {
      const skuDuplicate = db.products.find(
        (p) => p.id !== existing.id && p.sku.toLowerCase() === sku.trim().toLowerCase()
      );
      if (skuDuplicate) {
        return res.status(400).json({ error: `SKU "${sku}" is already assigned to another product.` });
      }
    }
  }

  const updated: Product = {
    ...existing,
    ...req.body,
    sku: req.body.sku ? req.body.sku.trim().toUpperCase() : existing.sku,
    name: name ? name.trim() : existing.name,
    category: category ? category.trim() : existing.category,
    brand: brand ? brand.trim() : existing.brand,
    purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : existing.purchasePrice,
    sellingPrice: req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : existing.sellingPrice,
    mrp: req.body.mrp !== undefined ? Number(req.body.mrp) : existing.mrp,
    gstRate: req.body.gstRate !== undefined ? Number(req.body.gstRate) : existing.gstRate,
    minStockLevel: req.body.minStockLevel !== undefined ? Number(req.body.minStockLevel) : existing.minStockLevel,
    updatedAt: new Date().toISOString(),
  };
  
  if (mongoDb) {
    const { _id, ...rest } = updated as any;
    await mongoDb.collection('products').updateOne({ id: req.params.id }, { $set: rest });
  }
  
  if (index !== -1) {
    db.products[index] = updated;
  }

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'PRODUCT_UPDATED',
    'Inventory',
    `Updated product ${updated.name} (${updated.sku})`,
    updated.id
  );

  writeDb(db);
  res.json(updated);
});

apiRouter.delete('/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  let product: any = db.products.find((p) => p.id === req.params.id);

  if (mongoDb) {
    product = await mongoDb.collection('products').findOne({ id: req.params.id });
  }
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (mongoDb) {
    await mongoDb.collection('products').deleteOne({ id: req.params.id });
  }
  db.products = db.products.filter((p) => p.id !== req.params.id);

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'PRODUCT_DELETED',
    'Inventory',
    `Deleted product ${product.name} (${product.sku})`,
    product.id
  );

  writeDb(db);
  res.json({ message: 'Product deleted successfully', id: req.params.id });
});

// -------------------------------------------------------------
// 4. CATEGORIES
// -------------------------------------------------------------

apiRouter.get('/categories', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.categories);
});

apiRouter.post('/categories', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const exists = db.categories.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) return res.status(400).json({ error: 'Category already exists' });

  const newCat = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    description: description?.trim() || '',
    productCount: 0,
    createdAt: new Date().toISOString(),
  };
  db.categories.push(newCat);
  writeDb(db);
  res.status(201).json(newCat);
});

apiRouter.delete('/categories/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  db.categories = db.categories.filter((c) => c.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Category deleted' });
});

// -------------------------------------------------------------
// 5. CUSTOMERS
// -------------------------------------------------------------

apiRouter.get('/customers', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const { q } = req.query;
  let list = [...db.customers];
  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.gstin && c.gstin.toLowerCase().includes(query))
    );
  }
  res.json(list);
});

apiRouter.get('/customers/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const customer = db.customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

apiRouter.post('/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { name, phone, alternatePhone, address, gstin, email, customerType, openingBalance, creditLimit, notes } =
    req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer Name and Phone number are required.' });
  }

  const existingPhone = db.customers.find((c) => c.phone.trim() === phone.trim());
  if (existingPhone) {
    return res.status(400).json({ error: `A customer with phone number "${phone}" already exists (${existingPhone.name}).` });
  }

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name: name.trim(),
    phone: phone.trim(),
    alternatePhone: alternatePhone?.trim() || '',
    address: address?.trim() || '',
    gstin: gstin?.trim().toUpperCase() || '',
    email: email?.trim().toLowerCase() || '',
    customerType: customerType || 'Retail',
    openingBalance: Number(openingBalance) || 0,
    creditLimit: Number(creditLimit) || 0,
    currentOutstanding: Number(openingBalance) || 0,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  db.customers.unshift(newCustomer);

  if (newCustomer.openingBalance > 0) {
    db.customerLedgers.push({
      id: `cld-${Date.now()}`,
      customerId: newCustomer.id,
      customerName: newCustomer.name,
      date: new Date().toISOString(),
      description: 'Opening Balance',
      type: 'adjustment',
      referenceNo: 'OPENING',
      debit: newCustomer.openingBalance,
      credit: 0,
      balance: newCustomer.openingBalance,
      notes: 'Initial account opening balance',
    });
  }

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'CUSTOMER_CREATED',
    'Customers',
    `Created customer ${newCustomer.name} (${newCustomer.phone})`,
    newCustomer.id
  );

  writeDb(db);
  res.status(201).json(newCustomer);
});

apiRouter.put('/customers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const index = db.customers.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const updated: Customer = {
    ...db.customers[index],
    ...req.body,
    gstin: req.body.gstin ? req.body.gstin.trim().toUpperCase() : db.customers[index].gstin,
  };
  db.customers[index] = updated;

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'CUSTOMER_UPDATED',
    'Customers',
    `Updated customer ${updated.name}`,
    updated.id
  );

  writeDb(db);
  res.json(updated);
});

apiRouter.delete('/customers/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const customer = db.customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  db.customers = db.customers.filter((c) => c.id !== req.params.id);
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'CUSTOMER_DELETED', 'Customers', `Deleted customer ${customer.name}`);
  writeDb(db);
  res.json({ message: 'Customer deleted' });
});

// -------------------------------------------------------------
// 6. SUPPLIERS
// -------------------------------------------------------------

apiRouter.get('/suppliers', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.suppliers);
});

apiRouter.post('/suppliers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { name, contactPerson, phone, email, address, gstin, openingBalance, paymentTerms, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Supplier name and phone are required.' });
  }

  const newSupplier: Supplier = {
    id: `sup-${Date.now()}`,
    name: name.trim(),
    contactPerson: contactPerson?.trim() || '',
    phone: phone.trim(),
    email: email?.trim() || '',
    address: address?.trim() || '',
    gstin: gstin?.trim().toUpperCase() || '',
    openingBalance: Number(openingBalance) || 0,
    paymentTerms: paymentTerms?.trim() || '30 Days Net',
    currentPayable: Number(openingBalance) || 0,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  db.suppliers.push(newSupplier);
  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'SUPPLIER_CREATED',
    'Suppliers',
    `Created supplier ${newSupplier.name}`,
    newSupplier.id
  );
  writeDb(db);
  res.status(201).json(newSupplier);
});

apiRouter.put('/suppliers/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const index = db.suppliers.findIndex((s) => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  const updated: Supplier = {
    ...db.suppliers[index],
    ...req.body,
    gstin: req.body.gstin ? req.body.gstin.trim().toUpperCase() : db.suppliers[index].gstin,
  };
  db.suppliers[index] = updated;
  writeDb(db);
  res.json(updated);
});

apiRouter.delete('/suppliers/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  db.suppliers = db.suppliers.filter((s) => s.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Supplier deleted' });
});

// -------------------------------------------------------------
// 7. INVOICE MANAGEMENT & FAST BILLING COUNTER
// -------------------------------------------------------------

apiRouter.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
  const { q, status, fromDate, toDate } = req.query;
  const mongoDb = getMongoDb();

  if (mongoDb) {
    const col = mongoDb.collection('invoices');
    const query: any = {};

    if (q && typeof q === 'string') {
      const qLower = q.toLowerCase();
      query.$or = [
        { invoiceNumber: { $regex: qLower, $options: 'i' } },
        { customerName: { $regex: qLower, $options: 'i' } },
        { customerPhone: { $regex: qLower, $options: 'i' } }
      ];
    }

    if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
      query.paymentStatus = status;
    }

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate && typeof fromDate === 'string') query.date.$gte = fromDate;
      if (toDate && typeof toDate === 'string') query.date.$lte = toDate + 'T23:59:59.999Z';
    }

    const invoices = await col.find(query).sort({ date: -1 }).toArray();
    const cleanInvoices = invoices.map((i: any) => {
      const { _id, ...rest } = i;
      return rest;
    });
    return res.json(cleanInvoices);
  }

  const db = readDb();
  let list = [...db.invoices];

  if (q && typeof q === 'string') {
    const query = q.toLowerCase();
    list = list.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.customerName.toLowerCase().includes(query) ||
        inv.customerPhone.includes(query)
    );
  }

  if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
    list = list.filter((inv) => inv.paymentStatus === status);
  }

  if (fromDate && typeof fromDate === 'string') {
    list = list.filter((inv) => inv.date >= fromDate);
  }

  if (toDate && typeof toDate === 'string') {
    list = list.filter((inv) => inv.date <= toDate + 'T23:59:59.999Z');
  }

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  res.json(list);
});

apiRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response) => {
  const mongoDb = getMongoDb();
  if (mongoDb) {
    const inv = await mongoDb.collection('invoices').findOne({ 
      $or: [ { id: req.params.id }, { invoiceNumber: req.params.id } ] 
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const { _id, ...rest } = inv as any;
    return res.json(rest);
  }

  const db = readDb();
  const inv = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json(inv);
});

// Create Invoice Transactionally
apiRouter.post('/invoices', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const {
    customerName,
    customerPhone,
    customerId,
    customerGstin,
    billingAddress,
    shippingAddress,
    isInterState,
    items,
    overallDiscountType,
    overallDiscountValue,
    overallDiscountAmount,
    paidAmount,
    paymentMode,
    notes,
  } = req.body;

  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and at least one invoice item are required.' });
  }

  // 1. Check stock availability for each item
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) {
      return res.status(400).json({ error: `Invalid product or quantity for item "${item.productName}".` });
    }
    let product: any = db.products.find((p) => p.id === item.productId);
    if (mongoDb) {
      product = await mongoDb.collection('products').findOne({ id: item.productId });
    }
    if (!product) {
      return res.status(400).json({ error: `Product "${item.productName}" not found in inventory.` });
    }
    if (product.currentStock < item.quantity) {
      return res.status(400).json({
        error: `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}.`,
      });
    }
  }

  // 2. Compute dynamic financial values rigorously
  let calculatedSubtotal = 0;
  let calculatedTaxable = 0;
  let calculatedCgst = 0;
  let calculatedSgst = 0;
  let calculatedIgst = 0;
  
  const gstType = req.body.gstType || 'exclusive';

  const processedItems: InvoiceItem[] = items.map((rawItem, idx) => {
    const qty = Number(rawItem.quantity);
    const rate = Number(rawItem.rate);
    const gross = qty * rate;
    const itemDiscPct = Number(rawItem.discountPercent) || 0;
    const itemDiscAmount = (gross * itemDiscPct) / 100;
    const gstRate = Number(rawItem.gstRate) || 0;
    
    let taxable = 0;
    if (gstType === 'inclusive') {
      const finalInclusive = gross - itemDiscAmount;
      taxable = finalInclusive / (1 + (gstRate / 100));
    } else {
      taxable = gross - itemDiscAmount;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = (taxable * gstRate) / 100;
    } else {
      cgst = (taxable * (gstRate / 2)) / 100;
      sgst = (taxable * (gstRate / 2)) / 100;
    }

    const rowTotal = taxable + cgst + sgst + igst;

    calculatedSubtotal += gross;
    calculatedTaxable += taxable;
    calculatedCgst += cgst;
    calculatedSgst += sgst;
    calculatedIgst += igst;

    return {
      id: `item-${Date.now()}-${idx}`,
      productId: rawItem.productId,
      productName: rawItem.productName,
      sku: rawItem.sku,
      barcode: rawItem.barcode,
      quantity: qty,
      unit: rawItem.unit || 'Nos',
      rate: rate,
      mrp: Number(rawItem.mrp) || rate,
      discountPercent: itemDiscPct,
      discountAmount: Math.round(itemDiscAmount * 100) / 100,
      taxableAmount: Math.round(taxable * 100) / 100,
      gstRate: gstRate,
      cgstAmount: Math.round(cgst * 100) / 100,
      sgstAmount: Math.round(sgst * 100) / 100,
      igstAmount: Math.round(igst * 100) / 100,
      totalAmount: Math.round(rowTotal * 100) / 100,
    };
  });

  const finalOverallDiscount = Number(overallDiscountAmount) || 0;
  const rawGrandTotal = calculatedTaxable - finalOverallDiscount + calculatedCgst + calculatedSgst + calculatedIgst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  const finalPaid = Math.min(Number(paidAmount) || 0, roundedGrandTotal);
  const balance = Math.max(0, roundedGrandTotal - finalPaid);

  let paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
  if (balance === 0 && roundedGrandTotal > 0) {
    paymentStatus = 'Paid';
  } else if (finalPaid > 0) {
    paymentStatus = 'Partially Paid';
  }

  // 3. Invoice number handling: Use dynamic / custom if provided, otherwise auto-generate sequentially
  let invoiceNumber = req.body.invoiceNumber ? String(req.body.invoiceNumber).trim() : '';
  const nextNum = db.settings.nextInvoiceNumber || 1;

  if (!invoiceNumber) {
    invoiceNumber = String(nextNum);
    db.settings.nextInvoiceNumber = nextNum + 1;
  } else {
    // If user used the exact current sequential auto number, advance the counter
    const currentSeq = String(nextNum);
    if (invoiceNumber === currentSeq) {
      db.settings.nextInvoiceNumber = nextNum + 1;
    }
  }
  // --- CUSTOMER AUTO-SAVE LOGIC ---
  let finalCustomerId = customerId;
  const phoneToMatch = customerPhone ? customerPhone.trim() : '';

  if (phoneToMatch) {
    const existingCustomer = db.customers.find((c) => c.phone === phoneToMatch);
    if (existingCustomer) {
      existingCustomer.name = customerName.trim();
      if (billingAddress) existingCustomer.address = billingAddress.trim();
      if (customerGstin) existingCustomer.gstin = customerGstin.trim().toUpperCase();
      existingCustomer.updatedAt = new Date().toISOString();
      finalCustomerId = existingCustomer.id;
    } else {
      const newCustomer: any = {
        id: `cust-${Date.now()}`,
        name: customerName.trim(),
        phone: phoneToMatch,
        email: '',
        address: billingAddress ? billingAddress.trim() : '',
        gstin: customerGstin ? customerGstin.trim().toUpperCase() : '',
        type: 'retail',
        totalSales: 0,
        currentOutstanding: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.customers.unshift(newCustomer);
      finalCustomerId = newCustomer.id;
    }
  }
  // --- END CUSTOMER AUTO-SAVE LOGIC ---

  const newInvoice: Invoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    date: new Date().toISOString(),
    customerId: finalCustomerId || undefined,
    customerName: customerName.trim(),
    customerPhone: customerPhone ? customerPhone.trim() : '',
    customerGstin: customerGstin ? customerGstin.trim().toUpperCase() : undefined,
    billingAddress: billingAddress ? billingAddress.trim() : undefined,
    shippingAddress: shippingAddress ? shippingAddress.trim() : undefined,
    isInterState: Boolean(isInterState),
    gstType,
    items: processedItems,
    subtotal: Math.round(calculatedSubtotal * 100) / 100,
    overallDiscountType: overallDiscountType || 'fixed',
    overallDiscountValue: Number(overallDiscountValue) || 0,
    overallDiscountAmount: finalOverallDiscount,
    taxableAmount: Math.round((calculatedTaxable - finalOverallDiscount) * 100) / 100,
    cgstTotal: Math.round(calculatedCgst * 100) / 100,
    sgstTotal: Math.round(calculatedSgst * 100) / 100,
    igstTotal: Math.round(calculatedIgst * 100) / 100,
    roundOff,
    grandTotal: roundedGrandTotal,
    paidAmount: finalPaid,
    balanceAmount: balance,
    paymentMode: paymentMode || 'Cash',
    paymentStatus,
    notes: notes?.trim() || '',
    createdBy: req.user?.name || 'Staff',
    createdAt: new Date().toISOString(),
  };

  // 4. Update inventory stock & record stock transactions
  for (const item of processedItems) {
    let product: any = db.products.find((p) => p.id === item.productId);
    if (mongoDb) {
      product = await mongoDb.collection('products').findOne({ id: item.productId });
    }
    if (product) {
      const prevStock = product.currentStock;
      
      if (mongoDb) {
        await mongoDb.collection('products').updateOne(
          { id: product.id },
          { $inc: { currentStock: -item.quantity }, $set: { updatedAt: new Date().toISOString() } }
        );
      }
      
      // Update cache
      const cacheProduct = db.products.find((p) => p.id === item.productId);
      if (cacheProduct) {
        cacheProduct.currentStock -= item.quantity;
        cacheProduct.updatedAt = new Date().toISOString();
      }

      const stockTx: StockTransaction = {
        id: `stk-${Date.now()}-${item.productId}`,
        productId: product.id,
        productName: product.name,
        type: 'sale',
        quantity: -item.quantity,
        previousStock: prevStock,
        updatedStock: prevStock - item.quantity,
        referenceNo: invoiceNumber,
        userId: req.user?.id || 'usr-staff',
        userName: req.user?.name || 'Staff',
        remarks: `Sold in Invoice ${invoiceNumber}`,
        date: new Date().toISOString(),
      };
      db.stockTransactions.unshift(stockTx);
    }
  }

  // 5. Update customer ledger & outstanding balance
  if (finalCustomerId) {
    const customer = db.customers.find((c) => c.id === finalCustomerId);
    if (customer) {
      // Debit: Invoice generated
      customer.currentOutstanding = (customer.currentOutstanding || 0) + roundedGrandTotal;
      const ledgerEntry1: CustomerLedgerEntry = {
        id: `cld-${Date.now()}-inv`,
        customerId: customer.id,
        customerName: customer.name,
        date: new Date().toISOString(),
        description: `Invoice ${invoiceNumber} Generated`,
        type: 'invoice',
        referenceNo: invoiceNumber,
        debit: roundedGrandTotal,
        credit: 0,
        balance: customer.currentOutstanding,
        notes: `Total items: ${processedItems.length}`,
      };
      db.customerLedgers.push(ledgerEntry1);

      // Credit: Immediate payment received
      if (finalPaid > 0) {
        customer.currentOutstanding -= finalPaid;
        const ledgerEntry2: CustomerLedgerEntry = {
          id: `cld-${Date.now()}-pay`,
          customerId: customer.id,
          customerName: customer.name,
          date: new Date().toISOString(),
          description: `${paymentMode} Payment Received against ${invoiceNumber}`,
          type: 'payment',
          referenceNo: invoiceNumber,
          debit: 0,
          credit: finalPaid,
          balance: customer.currentOutstanding,
          notes: `Mode: ${paymentMode}`,
        };
        db.customerLedgers.push(ledgerEntry2);
      }
    }
  }

  // 6. Record payment entry
  if (finalPaid > 0) {
    const paymentRecord: Payment = {
      id: `pay-${Date.now()}`,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      customerId: customerId || undefined,
      customerName: customerName.trim(),
      amount: finalPaid,
      paymentMode: paymentMode || 'Cash',
      date: new Date().toISOString(),
      notes: `Payment for invoice ${invoiceNumber}`,
      createdBy: req.user?.name || 'Staff',
    };
    db.payments.unshift(paymentRecord);
  }

  if (mongoDb) {
    await mongoDb.collection('invoices').insertOne({ ...newInvoice });
  }
  db.invoices.unshift(newInvoice);

  logAudit(
    req.user?.id || 'staff',
    req.user?.name || 'Staff',
    'INVOICE_CREATED',
    'Billing',
    `Created invoice ${invoiceNumber} for ${customerName} (₹${roundedGrandTotal})`,
    newInvoice.id
  );

  writeDb(db);
  res.status(201).json(newInvoice);
});

// Record additional payment on an existing invoice
apiRouter.post('/invoices/:id/payment', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const { amount, paymentMode, transactionRef, notes } = req.body;
  const payAmt = Number(amount);

  if (!payAmt || payAmt <= 0) {
    return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
  }

  let invoice: any = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (mongoDb) {
    invoice = await mongoDb.collection('invoices').findOne({ 
      $or: [ { id: req.params.id }, { invoiceNumber: req.params.id } ] 
    });
  }
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  if (invoice.balanceAmount <= 0) {
    return res.status(400).json({ error: 'This invoice is already fully paid.' });
  }

  const actualPayment = Math.min(payAmt, invoice.balanceAmount);
  invoice.paidAmount += actualPayment;
  invoice.balanceAmount -= actualPayment;
  invoice.paymentStatus = invoice.balanceAmount === 0 ? 'Paid' : 'Partially Paid';

  if (mongoDb) {
    await mongoDb.collection('invoices').updateOne(
      { id: invoice.id },
      { $set: { 
        paidAmount: invoice.paidAmount, 
        balanceAmount: invoice.balanceAmount, 
        paymentStatus: invoice.paymentStatus 
      }}
    );
  }

  // update local cache
  const cacheInvoice = db.invoices.find((i) => i.id === invoice.id);
  if (cacheInvoice) {
    cacheInvoice.paidAmount = invoice.paidAmount;
    cacheInvoice.balanceAmount = invoice.balanceAmount;
    cacheInvoice.paymentStatus = invoice.paymentStatus;
  }

  const paymentRecord: Payment = {
    id: `pay-${Date.now()}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    amount: actualPayment,
    paymentMode: paymentMode || 'Cash',
    transactionRef: transactionRef?.trim() || undefined,
    date: new Date().toISOString(),
    notes: notes?.trim() || `Additional payment for ${invoice.invoiceNumber}`,
    createdBy: req.user?.name || 'Staff',
  };
  db.payments.unshift(paymentRecord);

  // Update customer ledger
  if (invoice.customerId) {
    const customer = db.customers.find((c) => c.id === invoice.customerId);
    if (customer) {
      customer.currentOutstanding = Math.max(0, (customer.currentOutstanding || 0) - actualPayment);
      db.customerLedgers.push({
        id: `cld-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        date: new Date().toISOString(),
        description: `Payment Received for ${invoice.invoiceNumber}`,
        type: 'payment',
        referenceNo: paymentRecord.id,
        debit: 0,
        credit: actualPayment,
        balance: customer.currentOutstanding,
        notes: `Mode: ${paymentMode || 'Cash'}`,
      });
    }
  }

  logAudit(
    req.user?.id || 'staff',
    req.user?.name || 'Staff',
    'PAYMENT_RECORDED',
    'Billing',
    `Recorded payment of ₹${actualPayment} on ${invoice.invoiceNumber}`,
    invoice.id
  );

  writeDb(db);
  res.json({ invoice, payment: paymentRecord });
});

apiRouter.delete('/invoices/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  let invoice: any = db.invoices.find((i) => i.id === req.params.id);
  if (mongoDb) {
    invoice = await mongoDb.collection('invoices').findOne({ id: req.params.id });
  }
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  // Revert stock
  for (const item of invoice.items) {
    let product: any = db.products.find((p) => p.id === item.productId);
    if (mongoDb) {
      product = await mongoDb.collection('products').findOne({ id: item.productId });
    }
    if (product) {
      if (mongoDb) {
        await mongoDb.collection('products').updateOne(
          { id: product.id },
          { $inc: { currentStock: item.quantity }, $set: { updatedAt: new Date().toISOString() } }
        );
      }
      
      const cacheProduct = db.products.find((p) => p.id === item.productId);
      if (cacheProduct) {
        cacheProduct.currentStock += item.quantity;
      }
      db.stockTransactions.unshift({
        id: `stk-${Date.now()}-${item.productId}`,
        productId: product.id,
        productName: product.name,
        type: 'adjustment',
        quantity: item.quantity,
        previousStock: product.currentStock, // approximate due to async, could be improved
        updatedStock: product.currentStock + item.quantity,
        referenceNo: `VOID-${invoice.invoiceNumber}`,
        userId: req.user?.id || 'usr-admin',
        userName: req.user?.name || 'Admin',
        remarks: `Reversal due to cancelled/deleted Invoice ${invoice.invoiceNumber}`,
        date: new Date().toISOString(),
      });
    }
  }

  // Revert customer outstanding
  if (invoice.customerId && invoice.balanceAmount > 0) {
    const customer = db.customers.find((c) => c.id === invoice.customerId);
    if (customer) {
      customer.currentOutstanding = Math.max(0, (customer.currentOutstanding || 0) - invoice.balanceAmount);
      
      // Add reversal ledger entry
      db.customerLedgers.push({
        id: `cld-${Date.now()}-rev`,
        customerId: customer.id,
        customerName: customer.name,
        date: new Date().toISOString(),
        description: `Reversal: Invoice ${invoice.invoiceNumber} Deleted`,
        type: 'invoice',
        referenceNo: `VOID-${invoice.invoiceNumber}`,
        debit: 0,
        credit: invoice.balanceAmount,
        balance: customer.currentOutstanding,
        notes: 'Invoice cancelled/deleted by admin',
      });
    }
  }

  if (mongoDb) {
    await mongoDb.collection('invoices').deleteOne({ id: req.params.id });
  }
  db.invoices = db.invoices.filter((i) => i.id !== req.params.id);

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'INVOICE_DELETED',
    'Billing',
    `Deleted invoice ${invoice.invoiceNumber}`,
    invoice.id
  );

  writeDb(db);
  res.json({ message: 'Invoice deleted and stock restored.' });
});

// -------------------------------------------------------------
// 8. STOCK MANAGEMENT & ADJUSTMENTS
// -------------------------------------------------------------

apiRouter.get('/stock/history', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const { productId, type } = req.query;
  let list = [...db.stockTransactions];

  if (productId && typeof productId === 'string') {
    list = list.filter((st) => st.productId === productId);
  }

  if (type && typeof type === 'string' && type !== 'All') {
    list = list.filter((st) => st.type === type);
  }

  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  res.json(list);
});

apiRouter.post('/stock/adjustment', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const mongoDb = getMongoDb();
  const { productId, type, quantity, remarks, referenceNo } = req.body;
  const qty = Number(quantity);

  if (!productId || isNaN(qty) || qty === 0) {
    return res.status(400).json({ error: 'Product ID and non-zero quantity are required.' });
  }

  let product: any = db.products.find((p) => p.id === productId);
  if (mongoDb) {
    product = await mongoDb.collection('products').findOne({ id: productId });
  }
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const prevStock = product.currentStock;
  const updatedStock = prevStock + qty;

  if (updatedStock < 0) {
    return res.status(400).json({
      error: `Adjustment would result in negative stock (${updatedStock}). Available: ${prevStock}.`,
    });
  }

  if (mongoDb) {
    await mongoDb.collection('products').updateOne(
      { id: productId },
      { $set: { currentStock: updatedStock, updatedAt: new Date().toISOString() } }
    );
  }

  const cacheProduct = db.products.find((p) => p.id === productId);
  if (cacheProduct) {
    cacheProduct.currentStock = updatedStock;
    cacheProduct.updatedAt = new Date().toISOString();
  }
  product.currentStock = updatedStock;
  product.updatedAt = new Date().toISOString();

  const stockTx: StockTransaction = {
    id: `stk-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    type: type || 'adjustment',
    quantity: qty,
    previousStock: prevStock,
    updatedStock,
    referenceNo: referenceNo?.trim() || undefined,
    userId: req.user?.id || 'usr-admin',
    userName: req.user?.name || 'Admin',
    remarks: remarks?.trim() || `Manual stock adjustment (${qty > 0 ? '+' : ''}${qty})`,
    date: new Date().toISOString(),
  };

  db.stockTransactions.unshift(stockTx);

  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'STOCK_ADJUSTMENT',
    'Stock',
    `Adjusted stock for ${product.name}: ${prevStock} -> ${updatedStock} (${qty > 0 ? '+' : ''}${qty})`,
    product.id
  );

  writeDb(db);
  res.status(201).json({ product, transaction: stockTx });
});

// -------------------------------------------------------------
// 9. LEDGER MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/ledger/customer/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const entries = db.customerLedgers
    .filter((e) => e.customerId === req.params.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json(entries);
});

apiRouter.get('/ledger/supplier/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const entries = db.supplierLedgers
    .filter((e) => e.supplierId === req.params.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json(entries);
});

apiRouter.get('/ledger/business', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const { fromDate, toDate } = req.query;

  // Aggregate all cash/bank inflows (payments) and invoices
  let payments = [...db.payments];
  let invoices = [...db.invoices];

  if (fromDate && typeof fromDate === 'string') {
    payments = payments.filter((p) => p.date >= fromDate);
    invoices = invoices.filter((i) => i.date >= fromDate);
  }
  if (toDate && typeof toDate === 'string') {
    payments = payments.filter((p) => p.date <= toDate + 'T23:59:59.999Z');
    invoices = invoices.filter((i) => i.date <= toDate + 'T23:59:59.999Z');
  }

  const totalInvoiced = invoices.reduce((a, b) => a + b.grandTotal, 0);
  const totalCollections = payments.reduce((a, b) => a + b.amount, 0);
  const totalReceivables = db.customers.reduce((a, b) => a + (b.currentOutstanding || 0), 0);
  const totalPayables = db.suppliers.reduce((a, b) => a + (b.currentPayable || 0), 0);

  res.json({
    totalInvoiced,
    totalCollections,
    totalReceivables,
    totalPayables,
    payments,
  });
});

// Manual Customer Ledger Voucher / Entry
apiRouter.post('/ledger/customer/entry', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { customerId, description, type, referenceNo, debit, credit, notes, date } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required.' });
  }

  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  const debitAmt = Math.max(0, Number(debit) || 0);
  const creditAmt = Math.max(0, Number(credit) || 0);

  if (debitAmt === 0 && creditAmt === 0) {
    return res.status(400).json({ error: 'Either debit or credit amount must be greater than zero.' });
  }

  const prevBalance = customer.currentOutstanding || 0;
  const newBalance = Math.max(0, prevBalance + debitAmt - creditAmt);
  customer.currentOutstanding = newBalance;

  const newEntry: CustomerLedgerEntry = {
    id: `cld-${Date.now()}`,
    customerId: customer.id,
    customerName: customer.name,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    description: description?.trim() || (debitAmt > 0 ? 'Debit Adjustment' : 'Credit / Payment Adjustment'),
    type: type || (creditAmt > 0 ? 'payment' : 'adjustment'),
    referenceNo: referenceNo?.trim() || `ADJ-${Date.now().toString().slice(-6)}`,
    debit: debitAmt,
    credit: creditAmt,
    balance: newBalance,
    notes: notes?.trim() || undefined,
  };

  db.customerLedgers.push(newEntry);

  logAudit(
    req.user?.id || 'staff',
    req.user?.name || 'Staff',
    'LEDGER_ENTRY_ADDED',
    'Ledgers',
    `Added ${debitAmt > 0 ? 'Debit ₹' + debitAmt : 'Credit ₹' + creditAmt} entry for ${customer.name} (Ref: ${newEntry.referenceNo})`,
    newEntry.id
  );

  writeDb(db);
  res.status(201).json({ entry: newEntry, customer });
});

// Manual Supplier Ledger Voucher / Entry
apiRouter.post('/ledger/supplier/entry', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { supplierId, description, type, referenceNo, debit, credit, notes, date } = req.body;

  if (!supplierId) {
    return res.status(400).json({ error: 'Supplier ID is required.' });
  }

  const supplier = db.suppliers.find((s) => s.id === supplierId);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const debitAmt = Math.max(0, Number(debit) || 0);
  const creditAmt = Math.max(0, Number(credit) || 0);

  if (debitAmt === 0 && creditAmt === 0) {
    return res.status(400).json({ error: 'Either debit or credit amount must be greater than zero.' });
  }

  const prevPayable = supplier.currentPayable || 0;
  const newPayable = Math.max(0, prevPayable + creditAmt - debitAmt);
  supplier.currentPayable = newPayable;

  const newEntry: SupplierLedgerEntry = {
    id: `sld-${Date.now()}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    description: description?.trim() || (creditAmt > 0 ? 'Purchase / Credit Adjustment' : 'Payment / Debit Note'),
    type: type || (debitAmt > 0 ? 'payment' : 'purchase'),
    referenceNo: referenceNo?.trim() || `VOUCH-${Date.now().toString().slice(-6)}`,
    debit: debitAmt,
    credit: creditAmt,
    balance: newPayable,
    notes: notes?.trim() || undefined,
  };

  db.supplierLedgers.push(newEntry);

  logAudit(
    req.user?.id || 'staff',
    req.user?.name || 'Staff',
    'SUPPLIER_LEDGER_ENTRY_ADDED',
    'Ledgers',
    `Added ${debitAmt > 0 ? 'Payment ₹' + debitAmt : 'Payable ₹' + creditAmt} entry for supplier ${supplier.name} (Ref: ${newEntry.referenceNo})`,
    newEntry.id
  );

  writeDb(db);
  res.status(201).json({ entry: newEntry, supplier });
});

// -------------------------------------------------------------
// 10. RETURNS MANAGEMENT (SALES RETURN & PURCHASE RETURN)
// -------------------------------------------------------------

apiRouter.get('/returns', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.returns);
});

apiRouter.post('/returns/sales', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { originalInvoiceNo, customerId, customerName, items, reason, restockInventory } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Return items are required.' });
  }

  let totalReturnAmount = 0;
  const returnNumber = `RET-SLS-${Date.now()}`;

  for (const it of items) {
    const amt = Number(it.quantity) * Number(it.rate);
    totalReturnAmount += amt;

    if (restockInventory) {
      const product = db.products.find((p) => p.id === it.productId);
      if (product) {
        const prev = product.currentStock;
        product.currentStock += Number(it.quantity);
        db.stockTransactions.unshift({
          id: `stk-${Date.now()}-${it.productId}`,
          productId: product.id,
          productName: product.name,
          type: 'customer_return',
          quantity: Number(it.quantity),
          previousStock: prev,
          updatedStock: product.currentStock,
          referenceNo: returnNumber,
          userId: req.user?.id || 'usr-staff',
          userName: req.user?.name || 'Staff',
          remarks: `Sales return against ${originalInvoiceNo}: ${reason}`,
          date: new Date().toISOString(),
        });
      }
    }
  }

  // Update customer ledger
  if (customerId) {
    const customer = db.customers.find((c) => c.id === customerId);
    if (customer) {
      customer.currentOutstanding = Math.max(0, (customer.currentOutstanding || 0) - totalReturnAmount);
      db.customerLedgers.push({
        id: `cld-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        date: new Date().toISOString(),
        description: `Sales Return ${returnNumber} (Inv ${originalInvoiceNo})`,
        type: 'customer_return',
        referenceNo: returnNumber,
        debit: 0,
        credit: totalReturnAmount,
        balance: customer.currentOutstanding,
        notes: reason || 'Goods returned by customer',
      });
    }
  }

  const record: ReturnRecord = {
    id: `ret-${Date.now()}`,
    returnNumber,
    date: new Date().toISOString(),
    type: 'sales_return',
    originalReferenceNo: originalInvoiceNo || 'N/A',
    partyId: customerId || 'walk-in',
    partyName: customerName || 'Walk-in Customer',
    items,
    totalAmount: totalReturnAmount,
    reason: reason || 'Defective / customer exchange',
    restockInventory: Boolean(restockInventory),
    createdBy: req.user?.name || 'Staff',
    createdAt: new Date().toISOString(),
  };

  db.returns.unshift(record);

  logAudit(
    req.user?.id || 'staff',
    req.user?.name || 'Staff',
    'SALES_RETURN',
    'Returns',
    `Processed sales return ${returnNumber} for ₹${totalReturnAmount}`,
    record.id
  );

  writeDb(db);
  res.status(201).json(record);
});

// -------------------------------------------------------------
// 11. SETTINGS & AUDIT LOGS
// -------------------------------------------------------------

apiRouter.get('/settings', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.settings);
});

apiRouter.put('/settings', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'SETTINGS_UPDATED', 'Settings', 'Updated company profile & invoice settings');
  writeDb(db);
  res.json(db.settings);
});

apiRouter.get('/audit-logs', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { module, action, userId, search, limit } = req.query;
  let logs = [...db.auditLogs];

  if (module && typeof module === 'string' && module !== 'All') {
    logs = logs.filter((l) => l.module.toLowerCase() === module.toLowerCase());
  }

  if (action && typeof action === 'string' && action !== 'All') {
    logs = logs.filter((l) => l.action.toLowerCase() === action.toLowerCase());
  }

  if (userId && typeof userId === 'string' && userId !== 'All') {
    logs = logs.filter((l) => l.userId === userId || l.userName.toLowerCase() === userId.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.details.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q) ||
        (l.recordId && l.recordId.toLowerCase().includes(q))
    );
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limit && !isNaN(Number(limit))) {
    logs = logs.slice(0, Number(limit));
  }

  res.json(logs);
});

apiRouter.post('/audit-logs/clear', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const count = db.auditLogs.length;
  db.auditLogs = [];
  logAudit(
    req.user?.id || 'admin',
    req.user?.name || 'Admin',
    'AUDIT_LOGS_PURGED',
    'System',
    `Cleared ${count} audit log records`
  );
  writeDb(db);
  res.json({ message: 'Audit logs cleared successfully.' });
});

apiRouter.post('/settings/reset', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const initial = getInitialData();
  writeDb(initial);
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'DATABASE_RESET', 'System', 'Reset database to default seed state');
  res.json({ message: 'Database reset successfully' });
});
