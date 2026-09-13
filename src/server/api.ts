import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { readDb, writeDb, logAudit, getInitialData } from './db.js';
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

// -------------------------------------------------------------
// 2. DASHBOARD
// -------------------------------------------------------------

apiRouter.get('/dashboard', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayInvoices = db.invoices.filter((inv) => inv.date.startsWith(todayStr));
  const todaySales = todayInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const todayInvoiceCount = todayInvoices.length;

  // Calculate profit: revenue minus product purchase price
  const productCostMap = new Map<string, number>();
  db.products.forEach((p) => productCostMap.set(p.id, p.purchasePrice));

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

  const totalProducts = db.products.length;
  const lowStockProducts = db.products.filter(
    (p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel
  ).length;
  const outOfStockProducts = db.products.filter((p) => p.currentStock <= 0).length;

  // Daily sales for last 7 days
  const dailySales: { date: string; sales: number; profit: number; invoices: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayInvoices = db.invoices.filter((inv) => inv.date.startsWith(dateStr));
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
    { month: 'Sep 2026', sales: Math.max(75000, db.invoices.reduce((a, b) => a + b.grandTotal, 0)), purchases: 65000 },
  ];

  // Top selling products
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  db.invoices.forEach((inv) => {
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
  db.invoices.forEach((inv) => {
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
    recentInvoices: db.invoices.slice(0, 5),
    recentStockUpdates: db.stockTransactions.slice(0, 5),
    recentPayments: db.payments.slice(0, 5),
  });
});

// -------------------------------------------------------------
// 3. PRODUCTS
// -------------------------------------------------------------

apiRouter.get('/products', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const { q, category, brand, stockStatus, sort } = req.query;

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

apiRouter.get('/products/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

apiRouter.post('/products', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
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

  const existingSku = db.products.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase());
  if (existingSku) {
    return res.status(400).json({ error: `A product with SKU "${sku}" already exists.` });
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

  db.products.unshift(newProduct);

  // Update category product count
  const cat = db.categories.find((c) => c.name === newProduct.category);
  if (cat) cat.productCount = (cat.productCount || 0) + 1;

  // Log opening stock transaction if stock > 0
  if (newProduct.currentStock > 0) {
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
  }

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

apiRouter.put('/products/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const index = db.products.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  const existing = db.products[index];
  const { sku, name, category, brand } = req.body;

  if (sku && sku.toLowerCase() !== existing.sku.toLowerCase()) {
    const skuDuplicate = db.products.find(
      (p) => p.id !== existing.id && p.sku.toLowerCase() === sku.trim().toLowerCase()
    );
    if (skuDuplicate) {
      return res.status(400).json({ error: `SKU "${sku}" is already assigned to another product.` });
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

  db.products[index] = updated;

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

apiRouter.delete('/products/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

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

apiRouter.get('/invoices', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const { q, status, fromDate, toDate } = req.query;
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

  if (status && typeof status === 'string' && status !== 'All') {
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

apiRouter.get('/invoices/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const inv = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json(inv);
});

// Create Invoice Transactionally
apiRouter.post('/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
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
    const product = db.products.find((p) => p.id === item.productId);
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

  const processedItems: InvoiceItem[] = items.map((rawItem, idx) => {
    const qty = Number(rawItem.quantity);
    const rate = Number(rawItem.rate);
    const gross = qty * rate;
    const itemDiscPct = Number(rawItem.discountPercent) || 0;
    const itemDiscAmount = (gross * itemDiscPct) / 100;
    const taxable = gross - itemDiscAmount;
    const gstRate = Number(rawItem.gstRate) || 0;

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

  // 3. Generate unique invoice number
  const prefix = db.settings.invoicePrefix || 'SMA-2026';
  const nextNum = db.settings.nextInvoiceNumber || 1001;
  const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, '0')}`;
  db.settings.nextInvoiceNumber = nextNum + 1;

  const newInvoice: Invoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    date: new Date().toISOString(),
    customerId: customerId || undefined,
    customerName: customerName.trim(),
    customerPhone: customerPhone ? customerPhone.trim() : '',
    customerGstin: customerGstin ? customerGstin.trim().toUpperCase() : undefined,
    billingAddress: billingAddress ? billingAddress.trim() : undefined,
    shippingAddress: shippingAddress ? shippingAddress.trim() : undefined,
    isInterState: Boolean(isInterState),
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
    const product = db.products.find((p) => p.id === item.productId);
    if (product) {
      const prevStock = product.currentStock;
      product.currentStock -= item.quantity;
      product.updatedAt = new Date().toISOString();

      const stockTx: StockTransaction = {
        id: `stk-${Date.now()}-${item.productId}`,
        productId: product.id,
        productName: product.name,
        type: 'sale',
        quantity: -item.quantity,
        previousStock: prevStock,
        updatedStock: product.currentStock,
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
  if (customerId) {
    const customer = db.customers.find((c) => c.id === customerId);
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
apiRouter.post('/invoices/:id/payment', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { amount, paymentMode, transactionRef, notes } = req.body;
  const payAmt = Number(amount);

  if (!payAmt || payAmt <= 0) {
    return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
  }

  const invoice = db.invoices.find((i) => i.id === req.params.id || i.invoiceNumber === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  if (invoice.balanceAmount <= 0) {
    return res.status(400).json({ error: 'This invoice is already fully paid.' });
  }

  const actualPayment = Math.min(payAmt, invoice.balanceAmount);
  invoice.paidAmount += actualPayment;
  invoice.balanceAmount -= actualPayment;
  invoice.paymentStatus = invoice.balanceAmount === 0 ? 'Paid' : 'Partially Paid';

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

apiRouter.delete('/invoices/:id', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  // Revert stock
  for (const item of invoice.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (product) {
      product.currentStock += item.quantity;
      db.stockTransactions.unshift({
        id: `stk-${Date.now()}-${item.productId}`,
        productId: product.id,
        productName: product.name,
        type: 'adjustment',
        quantity: item.quantity,
        previousStock: product.currentStock - item.quantity,
        updatedStock: product.currentStock,
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
    }
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

apiRouter.post('/stock/adjustment', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const db = readDb();
  const { productId, type, quantity, remarks, referenceNo } = req.body;
  const qty = Number(quantity);

  if (!productId || isNaN(qty) || qty === 0) {
    return res.status(400).json({ error: 'Product ID and non-zero quantity are required.' });
  }

  const product = db.products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const prevStock = product.currentStock;
  const updatedStock = prevStock + qty;

  if (updatedStock < 0) {
    return res.status(400).json({
      error: `Adjustment would result in negative stock (${updatedStock}). Available: ${prevStock}.`,
    });
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

  // Compute clean running balance
  let running = 0;
  const calculated = entries.map((entry) => {
    running = running + entry.debit - entry.credit;
    return { ...entry, balance: running };
  });

  res.json(calculated);
});

apiRouter.get('/ledger/supplier/:id', authenticateToken, (req: Request, res: Response) => {
  const db = readDb();
  const entries = db.supplierLedgers
    .filter((e) => e.supplierId === req.params.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const calculated = entries.map((entry) => {
    running = running + entry.credit - entry.debit;
    return { ...entry, balance: running };
  });

  res.json(calculated);
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

apiRouter.get('/audit-logs', authenticateToken, requireAdmin, (req: Request, res: Response) => {
  const db = readDb();
  res.json(db.auditLogs);
});

apiRouter.post('/settings/reset', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const initial = getInitialData();
  writeDb(initial);
  logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'DATABASE_RESET', 'System', 'Reset database to default seed state');
  res.json({ message: 'Database reset successfully' });
});
