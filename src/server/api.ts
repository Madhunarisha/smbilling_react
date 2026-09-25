import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, readDb, writeDb, logAudit, getMongoDb } from './db.js';
import { runProductSeeder } from './seed_products.js';

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

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const usernameLower = username.trim().toLowerCase();
    const rows = await db.sql`SELECT * FROM users WHERE LOWER(username) = ${usernameLower} OR LOWER(email) = ${usernameLower}`;
    const user = rows && rows.length > 0 ? (rows as any[])[0] : null;

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);
    await logAudit(user.id, user.name, 'USER_LOGIN', 'Auth', `User logged in: ${user.username}`);

    const { passwordHash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

apiRouter.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rows = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = rows && rows.length > 0 ? (rows as any[])[0] : null;
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/auth/me/credentials', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }

    const userId = req.user?.id;
    const rows = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = rows && rows.length > 0 ? (rows as any[])[0] : null;
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isValid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    let usernameToUpdate = user.username;
    let passwordHashToUpdate = user.passwordHash;

    if (newUsername && newUsername.trim()) {
      const newUsernameLower = newUsername.trim().toLowerCase();
      const exists = await db.sql`SELECT id FROM users WHERE id != ${user.id} AND LOWER(username) = ${newUsernameLower}`;
      if (exists && (exists as any[]).length > 0) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
      usernameToUpdate = newUsername.trim();
    }

    if (newPassword && newPassword.trim()) {
      const salt = bcrypt.genSaltSync(10);
      passwordHashToUpdate = bcrypt.hashSync(newPassword.trim(), salt);
    }

    await db.sql`UPDATE users SET username = ${usernameToUpdate}, passwordHash = ${passwordHashToUpdate} WHERE id = ${user.id}`;
    await logAudit(user.id, user.name, 'CREDENTIALS_UPDATE', 'Auth', 'User updated their credentials');
    res.json({ message: 'Credentials updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 1.5 USERS MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await db.sql`SELECT * FROM users`;
    const safeUsers = (users as any[]).map(({ passwordHash: _, ...u }) => u);
    res.json(safeUsers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, username, email, role, status, password } = req.body;
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required.' });
    }

    const usernameLower = username.trim().toLowerCase();
    const existing = await db.sql`SELECT id FROM users WHERE LOWER(username) = ${usernameLower}`;
    if (existing && (existing as any[]).length > 0) {
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

    await db.sql`
      INSERT INTO users (id, name, username, email, role, status, phone, createdAt, passwordHash)
      VALUES (${newUser.id}, ${newUser.name}, ${newUser.username}, ${newUser.email}, ${newUser.role}, ${newUser.status}, ${newUser.phone}, ${newUser.createdAt}, ${newUser.passwordHash})
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'USER_CREATED', 'Users', `Created user ${newUser.username}`);

    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM users WHERE id = ${req.params.id}`;
    const user = rows && rows.length > 0 ? (rows as any[])[0] : null;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, username, email, role, status, password } = req.body;

    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const newUsernameLower = username.trim().toLowerCase();
      const existing = await db.sql`SELECT id FROM users WHERE id != ${user.id} AND LOWER(username) = ${newUsernameLower}`;
      if (existing && (existing as any[]).length > 0) return res.status(400).json({ error: 'Username is already taken.' });
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

    await db.sql`
      UPDATE users SET name = ${user.name}, username = ${user.username}, email = ${user.email}, role = ${user.role}, status = ${user.status}, passwordHash = ${user.passwordHash}
      WHERE id = ${user.id}
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'USER_UPDATED', 'Users', `Updated user ${user.username}`);

    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. DASHBOARD
// -------------------------------------------------------------

apiRouter.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dbData = await readDb();
    const todayStr = new Date().toISOString().split('T')[0];

    const products: any[] = dbData.products;
    const invoices: any[] = dbData.invoices;

    const todayInvoices = invoices.filter((inv: any) => inv.date.startsWith(todayStr));
    const todaySales = todayInvoices.reduce((acc: number, inv: any) => acc + inv.grandTotal, 0);
    const todayInvoiceCount = todayInvoices.length;

    const productCostMap = new Map<string, number>();
    products.forEach((p: any) => productCostMap.set(p.id, p.purchasePrice));

    let todayCost = 0;
    todayInvoices.forEach((inv: any) => {
      (inv.items || []).forEach((item: any) => {
        const cost = productCostMap.get(item.productId) || item.rate * 0.75;
        todayCost += cost * item.quantity;
      });
    });
    const todayProfit = Math.max(0, todaySales - todayCost);

    const todayPurchases = dbData.supplierLedgers
      .filter((entry: any) => entry.type === 'purchase' && entry.date.startsWith(todayStr))
      .reduce((acc: number, entry: any) => acc + entry.credit, 0);

    const totalReceivables = dbData.customers.reduce((acc: number, c: any) => acc + (c.currentOutstanding || 0), 0);
    const totalPayables = dbData.suppliers.reduce((acc: number, s: any) => acc + (s.currentPayable || 0), 0);

    const totalProducts = products.length;
    const lowStockProducts = products.filter((p: any) => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length;
    const outOfStockProducts = products.filter((p: any) => p.currentStock <= 0).length;

    const dailySales: { date: string; sales: number; profit: number; invoices: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayInvoices = invoices.filter((inv: any) => inv.date.startsWith(dateStr));
      const daySales = dayInvoices.reduce((acc: number, inv: any) => acc + inv.grandTotal, 0);

      let dayCost = 0;
      dayInvoices.forEach((inv: any) => {
        (inv.items || []).forEach((item: any) => {
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

    const monthlySales = [
      { month: 'Apr 2026', sales: 185000, purchases: 142000 },
      { month: 'May 2026', sales: 215000, purchases: 168000 },
      { month: 'Jun 2026', sales: 240000, purchases: 180000 },
      { month: 'Jul 2026', sales: 198000, purchases: 155000 },
      { month: 'Aug 2026', sales: 285000, purchases: 210000 },
      { month: 'Sep 2026', sales: Math.max(75000, invoices.reduce((a: number, b: any) => a + b.grandTotal, 0)), purchases: 65000 },
    ];

    const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    invoices.forEach((inv: any) => {
      (inv.items || []).forEach((item: any) => {
        const existing = productSalesMap.get(item.productName) || { name: item.productName, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.totalAmount;
        productSalesMap.set(item.productName, existing);
      });
    });
    const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const paymentMap = new Map<string, { amount: number; count: number }>();
    invoices.forEach((inv: any) => {
      const existing = paymentMap.get(inv.paymentMode) || { amount: 0, count: 0 };
      existing.amount += inv.paidAmount;
      existing.count += 1;
      paymentMap.set(inv.paymentMode, existing);
    });
    const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({ method, amount: data.amount, count: data.count }));

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
      recentInvoices: invoices.slice(0, 5),
      recentStockUpdates: dbData.stockTransactions.slice(0, 5),
      recentPayments: dbData.payments.slice(0, 5),
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dashboard' });
  }
});

// -------------------------------------------------------------
// 3. PRODUCTS
// -------------------------------------------------------------

apiRouter.get('/products', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { q, category, brand, stockStatus, sort } = req.query;
    let products = (await db.sql`SELECT * FROM products`) as any[];

    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.includes(query)) ||
          p.brand.toLowerCase().includes(query) ||
          (p.modelNumber && p.modelNumber.toLowerCase().includes(query))
      );
    }

    if (category && typeof category === 'string' && category !== 'All') {
      products = products.filter((p) => p.category === category);
    }

    if (brand && typeof brand === 'string' && brand !== 'All') {
      products = products.filter((p) => p.brand === brand);
    }

    if (stockStatus && typeof stockStatus === 'string') {
      if (stockStatus === 'low') products = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStockLevel);
      else if (stockStatus === 'out') products = products.filter((p) => p.currentStock <= 0);
      else if (stockStatus === 'in_stock') products = products.filter((p) => p.currentStock > p.minStockLevel);
    }

    if (sort && typeof sort === 'string') {
      if (sort === 'name_asc') products.sort((a, b) => a.name.localeCompare(b.name));
      if (sort === 'name_desc') products.sort((a, b) => b.name.localeCompare(a.name));
      if (sort === 'price_asc') products.sort((a, b) => a.sellingPrice - b.sellingPrice);
      if (sort === 'price_desc') products.sort((a, b) => b.sellingPrice - a.sellingPrice);
      if (sort === 'stock_asc') products.sort((a, b) => a.currentStock - b.currentStock);
      if (sort === 'stock_desc') products.sort((a, b) => b.currentStock - a.currentStock);
    } else {
      products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/products/seed', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await runProductSeeder();
    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'SEED_PRODUCTS', 'Products', `Seeded ${result.addedCount} new SF Battery products, updated ${result.updatedCount}`);
    res.json({ message: 'Products seeded successfully', ...result });
  } catch (err: any) {
    console.error('Failed to seed products:', err);
    res.status(500).json({ error: err.message || 'Failed to seed products' });
  }
});

apiRouter.get('/products/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    const product = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/products', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sku, name, category, brand, modelNumber, barcode, description, purchasePrice, sellingPrice, wholesalePrice, retailPrice, mrp, gstRate, discountPercent, openingStock, minStockLevel, unit, supplierId, supplierName, warrantyPeriod } = req.body;

    if (!sku || !name || !category || !brand) {
      return res.status(400).json({ error: 'SKU, Product Name, Category and Brand are required.' });
    }

    const skuUpper = sku.trim().toUpperCase();
    const existingSku = await db.sql`SELECT id FROM products WHERE LOWER(sku) = ${skuUpper.toLowerCase()}`;
    if (existingSku && (existingSku as any[]).length > 0) {
      return res.status(400).json({ error: `A product with SKU "${sku}" already exists.` });
    }

    const baseSellingPrice = Number(sellingPrice) || Number(wholesalePrice) || 0;
    const baseWholesalePrice = wholesalePrice !== undefined ? Number(wholesalePrice) : baseSellingPrice;
    const baseRetailPrice = retailPrice !== undefined ? Number(retailPrice) : (Number(mrp) || baseSellingPrice);

    const newProduct = {
      id: `prod-${Date.now()}`,
      sku: skuUpper,
      name: name.trim(),
      category: category.trim(),
      brand: brand.trim(),
      modelNumber: modelNumber?.trim() || '',
      barcode: barcode?.trim() || `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      description: description?.trim() || '',
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: baseWholesalePrice,
      wholesalePrice: baseWholesalePrice,
      retailPrice: baseRetailPrice,
      mrp: Number(mrp) || baseRetailPrice,
      gstRate: Number(gstRate) || 18,
      discountPercent: Number(discountPercent) || 0,
      openingStock: Number(openingStock) || 0,
      currentStock: Number(openingStock) || 0,
      minStockLevel: Number(minStockLevel) || 5,
      unit: unit || 'Nos',
      supplierId: supplierId || null,
      supplierName: supplierName || null,
      warrantyPeriod: warrantyPeriod || 'N/A',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.sql`
      INSERT INTO products (id, sku, name, category, brand, modelNumber, barcode, description, purchasePrice, sellingPrice, wholesalePrice, retailPrice, mrp, gstRate, discountPercent, openingStock, currentStock, minStockLevel, unit, supplierId, supplierName, warrantyPeriod, status, createdAt, updatedAt)
      VALUES (${newProduct.id}, ${newProduct.sku}, ${newProduct.name}, ${newProduct.category}, ${newProduct.brand}, ${newProduct.modelNumber}, ${newProduct.barcode}, ${newProduct.description}, ${newProduct.purchasePrice}, ${newProduct.sellingPrice}, ${newProduct.wholesalePrice}, ${newProduct.retailPrice}, ${newProduct.mrp}, ${newProduct.gstRate}, ${newProduct.discountPercent}, ${newProduct.openingStock}, ${newProduct.currentStock}, ${newProduct.minStockLevel}, ${newProduct.unit}, ${newProduct.supplierId}, ${newProduct.supplierName}, ${newProduct.warrantyPeriod}, ${newProduct.status}, ${newProduct.createdAt}, ${newProduct.updatedAt})
    `;

    // Log opening stock transaction
    const stkId = `stk-${Date.now()}`;
    const stkDate = new Date().toISOString();
    await db.sql`
      INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
      VALUES (${stkId}, ${newProduct.id}, ${newProduct.name}, 'opening', ${newProduct.currentStock}, 0, ${newProduct.currentStock}, null, ${req.user?.id || 'usr-admin'}, ${req.user?.name || 'Admin'}, 'Initial opening stock upon product creation', ${stkDate})
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'PRODUCT_CREATED', 'Inventory', `Created product ${newProduct.name} (${newProduct.sku})`, newProduct.id);
    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    const existing = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { sku } = req.body;
    if (sku && sku.toLowerCase() !== existing.sku.toLowerCase()) {
      const skuDuplicate = await db.sql`SELECT id FROM products WHERE id != ${existing.id} AND LOWER(sku) = ${sku.trim().toLowerCase()}`;
      if (skuDuplicate && (skuDuplicate as any[]).length > 0) {
        return res.status(400).json({ error: `SKU "${sku}" is already assigned to another product.` });
      }
    }

    const wholesalePrice = req.body.wholesalePrice !== undefined
      ? Number(req.body.wholesalePrice)
      : (req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : (existing.wholesalePrice ?? existing.sellingPrice));

    const retailPrice = req.body.retailPrice !== undefined
      ? Number(req.body.retailPrice)
      : (req.body.mrp !== undefined ? Number(req.body.mrp) : (existing.retailPrice ?? existing.mrp ?? existing.sellingPrice));

    const updated = {
      ...existing,
      ...req.body,
      sku: req.body.sku ? req.body.sku.trim().toUpperCase() : existing.sku,
      name: req.body.name ? req.body.name.trim() : existing.name,
      category: req.body.category ? req.body.category.trim() : existing.category,
      brand: req.body.brand ? req.body.brand.trim() : existing.brand,
      purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : existing.purchasePrice,
      sellingPrice: wholesalePrice,
      wholesalePrice,
      retailPrice,
      mrp: req.body.mrp !== undefined ? Number(req.body.mrp) : (existing.mrp ?? retailPrice),
      gstRate: req.body.gstRate !== undefined ? Number(req.body.gstRate) : existing.gstRate,
      minStockLevel: req.body.minStockLevel !== undefined ? Number(req.body.minStockLevel) : existing.minStockLevel,
      updatedAt: new Date().toISOString(),
    };

    await db.sql`
      UPDATE products SET
        sku = ${updated.sku},
        name = ${updated.name},
        category = ${updated.category},
        brand = ${updated.brand},
        modelNumber = ${updated.modelNumber},
        barcode = ${updated.barcode},
        description = ${updated.description},
        purchasePrice = ${updated.purchasePrice},
        sellingPrice = ${updated.sellingPrice},
        wholesalePrice = ${updated.wholesalePrice},
        retailPrice = ${updated.retailPrice},
        mrp = ${updated.mrp},
        gstRate = ${updated.gstRate},
        discountPercent = ${updated.discountPercent},
        minStockLevel = ${updated.minStockLevel},
        unit = ${updated.unit},
        supplierId = ${updated.supplierId},
        supplierName = ${updated.supplierName},
        warrantyPeriod = ${updated.warrantyPeriod},
        status = ${updated.status},
        updatedAt = ${updated.updatedAt}
      WHERE id = ${req.params.id}
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'PRODUCT_UPDATED', 'Inventory', `Updated product ${updated.name} (${updated.sku})`, updated.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/products/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    const product = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await db.sql`DELETE FROM products WHERE id = ${req.params.id}`;
    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'PRODUCT_DELETED', 'Inventory', `Deleted product ${product.name} (${product.sku})`, product.id);
    res.json({ message: 'Product deleted successfully', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3.5 BANKS
// -------------------------------------------------------------

apiRouter.get('/banks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const banks = await db.sql`SELECT * FROM banks`;
    res.json(banks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/banks', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankName, accountNumber, ifsc, branch } = req.body;
    if (!bankName || !accountNumber) return res.status(400).json({ error: 'Bank Name and Account Number are required' });

    const id = `bank-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const ifscVal = ifsc ? ifsc.trim().toUpperCase() : '';
    const branchVal = branch ? branch.trim() : '';

    await db.sql`INSERT INTO banks (id, bankName, accountNumber, ifsc, branch, createdAt) VALUES (${id}, ${bankName.trim()}, ${accountNumber.trim()}, ${ifscVal}, ${branchVal}, ${createdAt})`;

    const rows = await db.sql`SELECT * FROM banks WHERE id = ${id}`;
    res.status(201).json(rows && (rows as any[]).length > 0 ? (rows as any[])[0] : { id, bankName, accountNumber, ifsc: ifscVal, branch: branchVal, createdAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. CATEGORIES
// -------------------------------------------------------------

apiRouter.get('/categories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const categories = await db.sql`SELECT * FROM categories`;
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/categories', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const nameLower = name.trim().toLowerCase();
    const exists = await db.sql`SELECT id FROM categories WHERE LOWER(name) = ${nameLower}`;
    if (exists && (exists as any[]).length > 0) return res.status(400).json({ error: 'Category already exists' });

    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      productCount: 0,
      createdAt: new Date().toISOString(),
    };

    await db.sql`INSERT INTO categories (id, name, description, productCount, createdAt) VALUES (${newCat.id}, ${newCat.name}, ${newCat.description}, ${newCat.productCount}, ${newCat.createdAt})`;
    res.status(201).json(newCat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/categories/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.sql`DELETE FROM categories WHERE id = ${req.params.id}`;
    res.json({ message: 'Category deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. CUSTOMERS
// -------------------------------------------------------------

apiRouter.get('/customers', authenticateToken, async (req: Request, res: Response) => {
  try {
    let customers = (await db.sql`SELECT * FROM customers`) as any[];
    const { q } = req.query;
    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.gstin && c.gstin.toLowerCase().includes(query))
      );
    }
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM customers WHERE id = ${req.params.id}`;
    const customer = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, alternatePhone, address, gstin, email, customerType, openingBalance, creditLimit, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer Name and Phone number are required.' });
    }

    const existingPhone = await db.sql`SELECT id, name FROM customers WHERE phone = ${phone.trim()}`;
    if (existingPhone && (existingPhone as any[]).length > 0) {
      const ep = (existingPhone as any[])[0];
      return res.status(400).json({ error: `A customer with phone number "${phone}" already exists (${ep.name}).` });
    }

    const newCustomer = {
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

    await db.sql`
      INSERT INTO customers (id, name, phone, alternatePhone, address, gstin, email, customerType, openingBalance, creditLimit, currentOutstanding, notes, createdAt)
      VALUES (${newCustomer.id}, ${newCustomer.name}, ${newCustomer.phone}, ${newCustomer.alternatePhone}, ${newCustomer.address}, ${newCustomer.gstin}, ${newCustomer.email}, ${newCustomer.customerType}, ${newCustomer.openingBalance}, ${newCustomer.creditLimit}, ${newCustomer.currentOutstanding}, ${newCustomer.notes}, ${newCustomer.createdAt})
    `;

    if (newCustomer.openingBalance > 0) {
      const cldId = `cld-${Date.now()}`;
      const cldDate = new Date().toISOString();
      await db.sql`
        INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
        VALUES (${cldId}, ${newCustomer.id}, ${newCustomer.name}, ${cldDate}, 'Opening Balance', 'adjustment', 'OPENING', ${newCustomer.openingBalance}, 0, ${newCustomer.openingBalance}, 'Initial account opening balance')
      `;
    }

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'CUSTOMER_CREATED', 'Customers', `Created customer ${newCustomer.name} (${newCustomer.phone})`, newCustomer.id);
    res.status(201).json(newCustomer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/customers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM customers WHERE id = ${req.params.id}`;
    const customer = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const updated = {
      ...customer,
      ...req.body,
      gstin: req.body.gstin ? req.body.gstin.trim().toUpperCase() : customer.gstin,
    };

    await db.sql`
      UPDATE customers SET name = ${updated.name}, phone = ${updated.phone}, alternatePhone = ${updated.alternatePhone}, address = ${updated.address}, gstin = ${updated.gstin}, email = ${updated.email}, customerType = ${updated.customerType}, openingBalance = ${updated.openingBalance}, creditLimit = ${updated.creditLimit}, currentOutstanding = ${updated.currentOutstanding}, notes = ${updated.notes}
      WHERE id = ${req.params.id}
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'CUSTOMER_UPDATED', 'Customers', `Updated customer ${updated.name}`, updated.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/customers/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM customers WHERE id = ${req.params.id}`;
    const customer = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    await db.sql`DELETE FROM customers WHERE id = ${req.params.id}`;
    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'CUSTOMER_DELETED', 'Customers', `Deleted customer ${customer.name}`);
    res.json({ message: 'Customer deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. SUPPLIERS
// -------------------------------------------------------------

apiRouter.get('/suppliers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const suppliers = await db.sql`SELECT * FROM suppliers`;
    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/suppliers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, contactPerson, phone, email, address, gstin, openingBalance, paymentTerms, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Supplier name and phone are required.' });
    }

    const newSupplier = {
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

    await db.sql`
      INSERT INTO suppliers (id, name, contactPerson, phone, email, address, gstin, openingBalance, paymentTerms, currentPayable, notes, createdAt)
      VALUES (${newSupplier.id}, ${newSupplier.name}, ${newSupplier.contactPerson}, ${newSupplier.phone}, ${newSupplier.email}, ${newSupplier.address}, ${newSupplier.gstin}, ${newSupplier.openingBalance}, ${newSupplier.paymentTerms}, ${newSupplier.currentPayable}, ${newSupplier.notes}, ${newSupplier.createdAt})
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'SUPPLIER_CREATED', 'Suppliers', `Created supplier ${newSupplier.name}`, newSupplier.id);
    res.status(201).json(newSupplier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/suppliers/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await db.sql`SELECT * FROM suppliers WHERE id = ${req.params.id}`;
    const supplier = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const updated = {
      ...supplier,
      ...req.body,
      gstin: req.body.gstin ? req.body.gstin.trim().toUpperCase() : supplier.gstin,
    };

    await db.sql`
      UPDATE suppliers SET name = ${updated.name}, contactPerson = ${updated.contactPerson}, phone = ${updated.phone}, email = ${updated.email}, address = ${updated.address}, gstin = ${updated.gstin}, openingBalance = ${updated.openingBalance}, paymentTerms = ${updated.paymentTerms}, currentPayable = ${updated.currentPayable}, notes = ${updated.notes}
      WHERE id = ${req.params.id}
    `;

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/suppliers/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.sql`DELETE FROM suppliers WHERE id = ${req.params.id}`;
    res.json({ message: 'Supplier deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. INVOICE MANAGEMENT & FAST BILLING COUNTER
// -------------------------------------------------------------

apiRouter.get('/invoices', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { q, status, fromDate, toDate } = req.query;
    let invoices = (await db.sql`SELECT * FROM invoices ORDER BY date DESC`) as any[];

    if (q && typeof q === 'string') {
      const query = q.toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(query) ||
          i.customerName.toLowerCase().includes(query) ||
          i.customerPhone.includes(query)
      );
    }

    if (status && typeof status === 'string' && status.toLowerCase() !== 'all') {
      invoices = invoices.filter((i) => i.paymentStatus === status);
    }

    if (fromDate && typeof fromDate === 'string') {
      invoices = invoices.filter((i) => i.date >= fromDate);
    }

    if (toDate && typeof toDate === 'string') {
      invoices = invoices.filter((i) => i.date <= toDate + 'T23:59:59.999Z');
    }

    // Attach item counts
    const result = await Promise.all(
      invoices.map(async (inv) => {
        const countRows = await db.sql`SELECT COUNT(*) as cnt FROM invoice_items WHERE invoiceId = ${inv.id}`;
        const cnt = countRows && (countRows as any[]).length > 0 ? (countRows as any[])[0].cnt : 0;
        return { ...inv, items: Array(cnt).fill(null) };
      })
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const rows = await db.sql`SELECT * FROM invoices WHERE id = ${id} OR invoiceNumber = ${id}`;
    const inv = rows && (rows as any[]).length > 0 ? (rows as any[])[0] : null;
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const items = await db.sql`SELECT * FROM invoice_items WHERE invoiceId = ${inv.id}`;
    inv.items = items;
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Invoice Transactionally
apiRouter.post('/invoices', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customerName, customerPhone, customerId, customerGstin,
      billingAddress, shippingAddress, isInterState, items,
      overallDiscountType, overallDiscountValue, overallDiscountAmount,
      paidAmount, paymentMode, modeOfPayment, notes, dispatchedThrough,
    } = req.body;

    const resolvedMode = modeOfPayment || paymentMode || 'Cash';

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and at least one invoice item are required.' });
    }

    // 1. Check stock availability
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) {
        return res.status(400).json({ error: `Invalid product or quantity for item "${item.productName}".` });
      }
      const prodRows = await db.sql`SELECT currentStock, name FROM products WHERE id = ${item.productId}`;
      const product = prodRows && (prodRows as any[]).length > 0 ? (prodRows as any[])[0] : null;
      if (!product) return res.status(400).json({ error: `Product "${item.productName}" not found in inventory.` });
      if (product.currentStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}.` });
      }
    }

    // 2. Compute financial values
    let calculatedSubtotal = 0, calculatedTaxable = 0, calculatedCgst = 0, calculatedSgst = 0, calculatedIgst = 0;
    const gstType = req.body.gstType || 'exclusive';

    const processedItems = items.map((rawItem: any, idx: number) => {
      const qty = Number(rawItem.quantity);
      const rate = Number(rawItem.rate);
      const gross = qty * rate;
      const itemDiscPct = Number(rawItem.discountPercent) || 0;
      const itemDiscAmount = (gross * itemDiscPct) / 100;
      const gstRate = Number(rawItem.gstRate) || 0;

      let taxable = 0;
      if (gstType === 'inclusive') {
        taxable = (gross - itemDiscAmount) / (1 + gstRate / 100);
      } else {
        taxable = gross - itemDiscAmount;
      }

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = (taxable * gstRate) / 100;
      else { cgst = (taxable * (gstRate / 2)) / 100; sgst = cgst; }

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
        sku: rawItem.sku || '',
        barcode: rawItem.barcode || null,
        quantity: qty,
        unit: rawItem.unit || 'Nos',
        rate,
        mrp: Number(rawItem.mrp) || rate,
        discountPercent: itemDiscPct,
        discountAmount: Math.round(itemDiscAmount * 100) / 100,
        taxableAmount: Math.round(taxable * 100) / 100,
        gstRate,
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
    if (balance === 0 && roundedGrandTotal > 0) paymentStatus = 'Paid';
    else if (finalPaid > 0) paymentStatus = 'Partially Paid';

    // 3. Invoice number — resolve with duplicate protection
    const nextNumRows = await db.sql`SELECT value FROM settings WHERE key = 'nextInvoiceNumber'`;
    let nextNum = nextNumRows && (nextNumRows as any[]).length > 0 ? Number((nextNumRows as any[])[0].value) : 1;

    // Also check actual max in DB so nextNum is never behind
    const maxNumRows = await db.sql`SELECT MAX(CAST(invoiceNumber AS INTEGER)) as maxNum FROM invoices`;
    const maxInDb = maxNumRows && (maxNumRows as any[]).length > 0 ? Number((maxNumRows as any[])[0].maxNum) || 0 : 0;
    if (maxInDb >= nextNum) {
      nextNum = maxInDb + 1;
    }

    let invoiceNumber = req.body.invoiceNumber ? String(req.body.invoiceNumber).trim() : '';

    // Check if the requested invoice number already exists
    if (invoiceNumber) {
      const dupCheck = await db.sql`SELECT id FROM invoices WHERE invoiceNumber = ${invoiceNumber}`;
      if (dupCheck && (dupCheck as any[]).length > 0) {
        // Number already taken — assign next available instead
        invoiceNumber = String(nextNum);
      }
    } else {
      invoiceNumber = String(nextNum);
    }

    // Always sync settings to nextNum + 1 beyond whatever we're using
    const usedNum = Number(invoiceNumber);
    const newNext = Math.max(nextNum, usedNum) + 1;
    await db.sql`UPDATE settings SET value = ${String(newNext)} WHERE key = 'nextInvoiceNumber'`;

    // 4. Customer auto-save
    let finalCustomerId = customerId || null;
    const phoneToMatch = customerPhone ? customerPhone.trim() : '';
    if (phoneToMatch) {
      const existingCust = await db.sql`SELECT id FROM customers WHERE phone = ${phoneToMatch}`;
      if (existingCust && (existingCust as any[]).length > 0) {
        finalCustomerId = (existingCust as any[])[0].id;
        await db.sql`UPDATE customers SET name = ${customerName.trim()}, address = ${billingAddress ? billingAddress.trim() : ''}, gstin = ${customerGstin ? customerGstin.trim().toUpperCase() : ''} WHERE id = ${finalCustomerId}`;
      } else if (!finalCustomerId) {
        finalCustomerId = `cust-${Date.now()}`;
        await db.sql`
          INSERT INTO customers (id, name, phone, alternatePhone, address, gstin, email, customerType, openingBalance, creditLimit, currentOutstanding, notes, createdAt)
          VALUES (${finalCustomerId}, ${customerName.trim()}, ${phoneToMatch}, '', ${billingAddress ? billingAddress.trim() : ''}, ${customerGstin ? customerGstin.trim().toUpperCase() : ''}, '', 'Retail', 0, 0, 0, '', ${new Date().toISOString()})
        `;
      }
    }

    // 5. Insert invoice header
    const newInvoiceId = `inv-${Date.now()}`;
    const invDate = new Date().toISOString();
    await db.sql`
      INSERT INTO invoices (id, invoiceNumber, date, customerId, customerName, customerPhone, customerGstin, billingAddress, shippingAddress, isInterState, gstType, subtotal, overallDiscountType, overallDiscountValue, overallDiscountAmount, taxableAmount, cgstTotal, sgstTotal, igstTotal, roundOff, grandTotal, paidAmount, balanceAmount, paymentMode, modeOfPayment, paymentStatus, notes, dispatchedThrough, createdBy, createdAt)
      VALUES (${newInvoiceId}, ${invoiceNumber}, ${invDate}, ${finalCustomerId}, ${customerName.trim()}, ${phoneToMatch}, ${customerGstin ? customerGstin.trim().toUpperCase() : null}, ${billingAddress ? billingAddress.trim() : null}, ${shippingAddress ? shippingAddress.trim() : null}, ${isInterState ? 1 : 0}, ${gstType}, ${Math.round(calculatedSubtotal * 100) / 100}, ${overallDiscountType || 'fixed'}, ${Number(overallDiscountValue) || 0}, ${finalOverallDiscount}, ${Math.round((calculatedTaxable - finalOverallDiscount) * 100) / 100}, ${Math.round(calculatedCgst * 100) / 100}, ${Math.round(calculatedSgst * 100) / 100}, ${Math.round(calculatedIgst * 100) / 100}, ${roundOff}, ${roundedGrandTotal}, ${finalPaid}, ${balance}, ${resolvedMode}, ${resolvedMode}, ${paymentStatus}, ${notes?.trim() || ''}, ${dispatchedThrough ? dispatchedThrough.trim() : null}, ${req.user?.name || 'Staff'}, ${invDate})
    `;

    // 6. Insert items, update stock, create stock transactions
    for (const item of processedItems) {
      await db.sql`
        INSERT INTO invoice_items (id, invoiceId, productId, productName, sku, brand, barcode, quantity, unit, rate, purchaseRate, mrp, discountPercent, discountAmount, taxableAmount, gstRate, cgstAmount, sgstAmount, igstAmount, totalAmount)
        VALUES (${item.id}, ${newInvoiceId}, ${item.productId}, ${item.productName}, ${item.sku}, null, ${item.barcode}, ${item.quantity}, ${item.unit}, ${item.rate}, null, ${item.mrp}, ${item.discountPercent}, ${item.discountAmount}, ${item.taxableAmount}, ${item.gstRate}, ${item.cgstAmount}, ${item.sgstAmount}, ${item.igstAmount}, ${item.totalAmount})
      `;

      const prodRows = await db.sql`SELECT currentStock FROM products WHERE id = ${item.productId}`;
      if (prodRows && (prodRows as any[]).length > 0) {
        const prevStock = (prodRows as any[])[0].currentStock;
        const newStock = prevStock - item.quantity;
        await db.sql`UPDATE products SET currentStock = ${newStock}, updatedAt = ${new Date().toISOString()} WHERE id = ${item.productId}`;
        const stkId = `stk-${Date.now()}-${item.productId}`;
        await db.sql`
          INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
          VALUES (${stkId}, ${item.productId}, ${item.productName}, 'sale', ${-item.quantity}, ${prevStock}, ${newStock}, ${invoiceNumber}, ${req.user?.id || 'usr-staff'}, ${req.user?.name || 'Staff'}, ${'Sold in Invoice ' + invoiceNumber}, ${new Date().toISOString()})
        `;
      }
    }

    // 7. Customer ledger
    if (finalCustomerId) {
      const custRows = await db.sql`SELECT currentOutstanding FROM customers WHERE id = ${finalCustomerId}`;
      if (custRows && (custRows as any[]).length > 0) {
        let currentOut = (custRows as any[])[0].currentOutstanding + roundedGrandTotal;
        await db.sql`UPDATE customers SET currentOutstanding = ${currentOut} WHERE id = ${finalCustomerId}`;
        await db.sql`
          INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'cld-' + Date.now() + '-inv'}, ${finalCustomerId}, ${customerName.trim()}, ${new Date().toISOString()}, ${'Invoice ' + invoiceNumber + ' Generated'}, 'invoice', ${invoiceNumber}, ${roundedGrandTotal}, 0, ${currentOut}, ${'Total items: ' + processedItems.length})
        `;

        if (finalPaid > 0) {
          currentOut -= finalPaid;
          await db.sql`UPDATE customers SET currentOutstanding = ${currentOut} WHERE id = ${finalCustomerId}`;
          await db.sql`
            INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
            VALUES (${'cld-' + Date.now() + '-pay'}, ${finalCustomerId}, ${customerName.trim()}, ${new Date().toISOString()}, ${(paymentMode || 'Cash') + ' Payment Received against ' + invoiceNumber}, 'payment', ${invoiceNumber}, 0, ${finalPaid}, ${currentOut}, ${'Mode: ' + (paymentMode || 'Cash')})
          `;
        }
      }
    }

    // 8. Payment record
    if (finalPaid > 0) {
      await db.sql`
        INSERT INTO payments (id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMode, date, notes, createdBy)
        VALUES (${'pay-' + Date.now()}, ${newInvoiceId}, ${invoiceNumber}, ${finalCustomerId}, ${customerName.trim()}, ${finalPaid}, ${paymentMode || 'Cash'}, ${new Date().toISOString()}, ${'Payment for invoice ' + invoiceNumber}, ${req.user?.name || 'Staff'})
      `;
    }

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'INVOICE_CREATED', 'Invoices', `Created Invoice ${invoiceNumber} for ${customerName}`);

    const createdInvRows = await db.sql`SELECT * FROM invoices WHERE id = ${newInvoiceId}`;
    const createdInvoice = createdInvRows && (createdInvRows as any[]).length > 0 ? (createdInvRows as any[])[0] : {};
    const createdItems = await db.sql`SELECT * FROM invoice_items WHERE invoiceId = ${newInvoiceId}`;
    createdInvoice.items = createdItems;

    res.status(201).json(createdInvoice);
  } catch (err: any) {
    console.error('Invoice creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create invoice' });
  }
});

// Record additional payment on an existing invoice
apiRouter.post('/invoices/:id/payment', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMode, transactionRef, notes } = req.body;
    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
    }

    const id = req.params.id;
    const invRows = await db.sql`SELECT * FROM invoices WHERE id = ${id} OR invoiceNumber = ${id}`;
    const invoice = invRows && (invRows as any[]).length > 0 ? (invRows as any[])[0] : null;
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    if (invoice.balanceAmount <= 0) return res.status(400).json({ error: 'This invoice is already fully paid.' });

    const actualPayment = Math.min(payAmt, invoice.balanceAmount);
    invoice.paidAmount += actualPayment;
    invoice.balanceAmount -= actualPayment;
    invoice.paymentStatus = invoice.balanceAmount === 0 ? 'Paid' : 'Partially Paid';

    await db.sql`UPDATE invoices SET paidAmount = ${invoice.paidAmount}, balanceAmount = ${invoice.balanceAmount}, paymentStatus = ${invoice.paymentStatus} WHERE id = ${invoice.id}`;

    const payId = `pay-${Date.now()}`;
    const payDate = new Date().toISOString();
    await db.sql`
      INSERT INTO payments (id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMode, transactionRef, date, notes, createdBy)
      VALUES (${payId}, ${invoice.id}, ${invoice.invoiceNumber}, ${invoice.customerId}, ${invoice.customerName}, ${actualPayment}, ${paymentMode || 'Cash'}, ${transactionRef?.trim() || null}, ${payDate}, ${notes?.trim() || 'Additional payment for ' + invoice.invoiceNumber}, ${req.user?.name || 'Staff'})
    `;

    // Update customer ledger
    if (invoice.customerId) {
      const custRows = await db.sql`SELECT currentOutstanding FROM customers WHERE id = ${invoice.customerId}`;
      if (custRows && (custRows as any[]).length > 0) {
        const newOutstanding = Math.max(0, (custRows as any[])[0].currentOutstanding - actualPayment);
        await db.sql`UPDATE customers SET currentOutstanding = ${newOutstanding} WHERE id = ${invoice.customerId}`;
        await db.sql`
          INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'cld-' + Date.now()}, ${invoice.customerId}, ${invoice.customerName}, ${payDate}, ${'Payment Received for ' + invoice.invoiceNumber}, 'payment', ${payId}, 0, ${actualPayment}, ${newOutstanding}, ${'Mode: ' + (paymentMode || 'Cash')})
        `;
      }
    }

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'PAYMENT_RECORDED', 'Billing', `Recorded payment of ₹${actualPayment} on ${invoice.invoiceNumber}`, invoice.id);
    res.json({ invoice, payment: { id: payId, amount: actualPayment, paymentMode } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/payments', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const rows = (await db.sql`SELECT * FROM payments ORDER BY date DESC, id DESC`) as any[];
    const normalized = (rows || []).map((p: any) => ({
      id: p.id,
      type: p.type || (p.customerId ? 'Inward (Customer Receipt)' : 'Outward (Supplier Payment)'),
      partyName: p.partyName || p.customerName || 'Customer / Vendor',
      amount: Number(p.amount) || 0,
      mode: p.paymentMode || 'Cash',
      referenceNo: p.transactionRef || p.invoiceNumber || p.id,
      date: p.date ? p.date.split('T')[0] : new Date().toISOString().split('T')[0],
      status: p.status || 'Completed',
      notes: p.notes || '',
    }));
    res.json(normalized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/payments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, partyName, amount, mode, referenceNo, date, status, notes, partyId } = req.body;
    if (!partyName || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Party name and a valid payment amount are required.' });
    }

    const payId = `pm-${Date.now()}`;
    const payDate = date ? (date.includes('T') ? date : date + 'T12:00:00.000Z') : new Date().toISOString();
    const payMode = mode || 'Cash';
    const payStatus = status || 'Completed';
    const payType = type || 'Inward (Customer Receipt)';
    const numAmount = Number(amount);
    const ref = referenceNo ? String(referenceNo).trim() : `PAY-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.sql`
      INSERT INTO payments (id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMode, transactionRef, date, notes, createdBy, type, status, partyName)
      VALUES (${payId}, null, ${ref}, ${partyId || null}, ${partyName.trim()}, ${numAmount}, ${payMode}, ${ref}, ${payDate}, ${notes || ''}, ${req.user?.name || 'Staff'}, ${payType}, ${payStatus}, ${partyName.trim()})
    `;

    // If customer receipt with partyId, update customer balance and ledger
    if (partyId && payType.startsWith('Inward')) {
      const custRows = await db.sql`SELECT * FROM customers WHERE id = ${partyId}`;
      const customer = custRows && (custRows as any[]).length > 0 ? (custRows as any[])[0] : null;
      if (customer) {
        const newOutstanding = Math.max(0, customer.currentOutstanding - numAmount);
        await db.sql`UPDATE customers SET currentOutstanding = ${newOutstanding} WHERE id = ${partyId}`;
        await db.sql`
          INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'cld-' + Date.now()}, ${partyId}, ${customer.name}, ${payDate}, ${'Direct Payment Receipt: ' + ref}, 'payment', ${payId}, 0, ${numAmount}, ${newOutstanding}, ${'Mode: ' + payMode})
        `;
      }
    }

    // If supplier payment with partyId, update supplier balance and ledger
    if (partyId && payType.startsWith('Outward')) {
      const supRows = await db.sql`SELECT * FROM suppliers WHERE id = ${partyId}`;
      const supplier = supRows && (supRows as any[]).length > 0 ? (supRows as any[])[0] : null;
      if (supplier) {
        const newPayable = Math.max(0, supplier.currentPayable - numAmount);
        await db.sql`UPDATE suppliers SET currentPayable = ${newPayable} WHERE id = ${partyId}`;
        await db.sql`
          INSERT INTO supplier_ledgers (id, supplierId, supplierName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'sld-' + Date.now()}, ${partyId}, ${supplier.name}, ${payDate}, ${'Supplier Payment: ' + ref}, 'payment', ${payId}, ${numAmount}, 0, ${newPayable}, ${'Mode: ' + payMode})
        `;
      }
    }

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'PAYMENT_RECORDED', 'Finance', `Recorded ${payType} of ₹${numAmount} for ${partyName}`, payId);

    res.json({
      id: payId,
      type: payType,
      partyName: partyName.trim(),
      amount: numAmount,
      mode: payMode,
      referenceNo: ref,
      date: payDate.split('T')[0],
      status: payStatus,
      notes: notes || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/payments/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.sql`DELETE FROM payments WHERE id = ${id}`;
    res.json({ message: 'Payment record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/invoices/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invRows = await db.sql`SELECT * FROM invoices WHERE id = ${req.params.id}`;
    const invoice = invRows && (invRows as any[]).length > 0 ? (invRows as any[])[0] : null;
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

    const items = await db.sql`SELECT * FROM invoice_items WHERE invoiceId = ${invoice.id}`;

    // Revert stock
    for (const item of (items as any[])) {
      const prodRows = await db.sql`SELECT currentStock FROM products WHERE id = ${item.productId}`;
      if (prodRows && (prodRows as any[]).length > 0) {
        const prevStock = (prodRows as any[])[0].currentStock;
        const newStock = prevStock + item.quantity;
        await db.sql`UPDATE products SET currentStock = ${newStock}, updatedAt = ${new Date().toISOString()} WHERE id = ${item.productId}`;
        await db.sql`
          INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
          VALUES (${'stk-' + Date.now() + '-' + item.productId}, ${item.productId}, ${item.productName}, 'adjustment', ${item.quantity}, ${prevStock}, ${newStock}, ${'VOID-' + invoice.invoiceNumber}, ${req.user?.id || 'usr-admin'}, ${req.user?.name || 'Admin'}, ${'Reversal due to cancelled/deleted Invoice ' + invoice.invoiceNumber}, ${new Date().toISOString()})
        `;
      }
    }

    // Revert customer outstanding
    if (invoice.customerId && invoice.balanceAmount > 0) {
      const custRows = await db.sql`SELECT currentOutstanding FROM customers WHERE id = ${invoice.customerId}`;
      if (custRows && (custRows as any[]).length > 0) {
        const newOutstanding = Math.max(0, (custRows as any[])[0].currentOutstanding - invoice.balanceAmount);
        await db.sql`UPDATE customers SET currentOutstanding = ${newOutstanding} WHERE id = ${invoice.customerId}`;
        await db.sql`
          INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'cld-' + Date.now() + '-rev'}, ${invoice.customerId}, ${invoice.customerName}, ${new Date().toISOString()}, ${'Reversal: Invoice ' + invoice.invoiceNumber + ' Deleted'}, 'invoice', ${'VOID-' + invoice.invoiceNumber}, 0, ${invoice.balanceAmount}, ${newOutstanding}, 'Invoice cancelled/deleted by admin')
        `;
      }
    }

    await db.sql`DELETE FROM invoices WHERE id = ${req.params.id}`;
    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'INVOICE_DELETED', 'Billing', `Deleted invoice ${invoice.invoiceNumber}`, invoice.id);
    res.json({ message: 'Invoice deleted and stock restored.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. STOCK MANAGEMENT & ADJUSTMENTS
// -------------------------------------------------------------

apiRouter.get('/stock/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    let list = (await db.sql`SELECT * FROM stock_transactions ORDER BY date DESC`) as any[];
    const { productId, type } = req.query;

    if (productId && typeof productId === 'string') {
      list = list.filter((st) => st.productId === productId);
    }
    if (type && typeof type === 'string' && type !== 'All') {
      list = list.filter((st) => st.type === type);
    }

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/stock/adjustment', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, type, quantity, remarks, referenceNo } = req.body;
    const qty = Number(quantity);
    if (!productId || isNaN(qty) || qty === 0) {
      return res.status(400).json({ error: 'Product ID and non-zero quantity are required.' });
    }

    const prodRows = await db.sql`SELECT * FROM products WHERE id = ${productId}`;
    const product = prodRows && (prodRows as any[]).length > 0 ? (prodRows as any[])[0] : null;
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const prevStock = product.currentStock;
    const updatedStock = prevStock + qty;

    if (updatedStock < 0) {
      return res.status(400).json({ error: `Adjustment would result in negative stock (${updatedStock}). Available: ${prevStock}.` });
    }

    const now = new Date().toISOString();
    await db.sql`UPDATE products SET currentStock = ${updatedStock}, updatedAt = ${now} WHERE id = ${productId}`;

    const stkId = `stk-${Date.now()}`;
    const stockTx = {
      id: stkId,
      productId: product.id,
      productName: product.name,
      type: type || 'adjustment',
      quantity: qty,
      previousStock: prevStock,
      updatedStock,
      referenceNo: referenceNo?.trim() || null,
      userId: req.user?.id || 'usr-admin',
      userName: req.user?.name || 'Admin',
      remarks: remarks?.trim() || `Manual stock adjustment (${qty > 0 ? '+' : ''}${qty})`,
      date: now,
    };

    await db.sql`
      INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
      VALUES (${stockTx.id}, ${stockTx.productId}, ${stockTx.productName}, ${stockTx.type}, ${stockTx.quantity}, ${stockTx.previousStock}, ${stockTx.updatedStock}, ${stockTx.referenceNo}, ${stockTx.userId}, ${stockTx.userName}, ${stockTx.remarks}, ${stockTx.date})
    `;

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'STOCK_ADJUSTMENT', 'Stock', `Adjusted stock for ${product.name}: ${prevStock} -> ${updatedStock} (${qty > 0 ? '+' : ''}${qty})`, product.id);
    res.status(201).json({ product: { ...product, currentStock: updatedStock }, transaction: stockTx });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PURCHASES MANAGEMENT (Inward Purchased Stock Entry)
// -------------------------------------------------------------

apiRouter.get('/purchases', authenticateToken, async (req: Request, res: Response) => {
  try {
    const purchases = (await db.sql`SELECT * FROM purchases ORDER BY billDate DESC, createdAt DESC`) as any[];
    for (const p of purchases) {
      const items = (await db.sql`SELECT * FROM purchase_items WHERE purchaseId = ${p.id}`) as any[];
      p.items = items || [];
    }
    res.json(purchases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/purchases', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      billNumber,
      supplierId,
      supplierName,
      billDate,
      items,
      paymentMode,
      paidAmount,
      notes,
    } = req.body;

    if (!supplierId || !supplierName) {
      return res.status(400).json({ error: 'Supplier selection is required.' });
    }
    if (!billNumber || !billNumber.trim()) {
      return res.status(400).json({ error: 'Vendor Bill / Invoice Number is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one purchased item is required.' });
    }

    let subtotal = 0;
    let taxAmount = 0;
    const processedItems: any[] = [];

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.purchaseRate) || 0;
      const gstRate = Number(item.gstRate) || 0;

      if (qty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for item "${item.productName || item.productId}".` });
      }

      const lineTaxable = qty * rate;
      const lineGst = (lineTaxable * gstRate) / 100;
      const lineTotal = lineTaxable + lineGst;

      subtotal += lineTaxable;
      taxAmount += lineGst;

      processedItems.push({
        id: `pitem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: item.productId,
        productName: item.productName || 'Product',
        sku: item.sku || 'SKU',
        quantity: qty,
        unit: item.unit || 'Nos',
        purchaseRate: rate,
        taxableAmount: lineTaxable,
        gstRate: gstRate,
        gstAmount: lineGst,
        totalAmount: lineTotal,
      });
    }

    const grandTotal = Math.round(subtotal + taxAmount);
    const paid = Math.max(0, Number(paidAmount) || 0);
    const balance = Math.max(0, grandTotal - paid);
    let paymentStatus = 'Unpaid';
    if (paid >= grandTotal) {
      paymentStatus = 'Paid';
    } else if (paid > 0) {
      paymentStatus = 'Partial';
    }

    const purchaseId = `pur-${Date.now()}`;
    const now = new Date().toISOString();
    const formattedBillDate = billDate || now.split('T')[0];

    // Insert purchase record
    await db.sql`
      INSERT INTO purchases (id, billNumber, supplierId, supplierName, billDate, subtotal, taxAmount, grandTotal, paidAmount, balanceAmount, paymentMode, paymentStatus, notes, createdBy, createdAt)
      VALUES (${purchaseId}, ${billNumber.trim()}, ${supplierId}, ${supplierName}, ${formattedBillDate}, ${subtotal}, ${taxAmount}, ${grandTotal}, ${paid}, ${balance}, ${paymentMode || 'Cash'}, ${paymentStatus}, ${notes?.trim() || null}, ${req.user?.name || 'Staff'}, ${now})
    `;

    // Process line items & update physical stock + stock transactions
    for (const pItem of processedItems) {
      await db.sql`
        INSERT INTO purchase_items (id, purchaseId, productId, productName, sku, quantity, unit, purchaseRate, taxableAmount, gstRate, gstAmount, totalAmount)
        VALUES (${pItem.id}, ${purchaseId}, ${pItem.productId}, ${pItem.productName}, ${pItem.sku}, ${pItem.quantity}, ${pItem.unit}, ${pItem.purchaseRate}, ${pItem.taxableAmount}, ${pItem.gstRate}, ${pItem.gstAmount}, ${pItem.totalAmount})
      `;

      // Update or create product in catalog
      let prodRows = await db.sql`SELECT * FROM products WHERE id = ${pItem.productId} OR sku = ${pItem.sku}`;
      if (!prodRows || (prodRows as any[]).length === 0) {
        // Auto-create new product in database catalog so it connects to Invoice Select Product field
        const newProdId = pItem.productId || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const sellingPrice = Math.round((pItem.purchaseRate || 0) * 1.25); // Default 25% margin
        await db.sql`
          INSERT INTO products (id, sku, name, category, brand, modelNumber, barcode, description, purchasePrice, sellingPrice, mrp, gstRate, discountPercent, openingStock, currentStock, minStockLevel, unit, supplierId, supplierName, warrantyPeriod, status, createdAt, updatedAt)
          VALUES (${newProdId}, ${pItem.sku || 'SKU-' + Date.now()}, ${pItem.productName}, 'Automotive Parts', 'General', NULL, NULL, 'Purchased Stock Item', ${pItem.purchaseRate}, ${sellingPrice}, ${sellingPrice}, ${pItem.gstRate || 18}, 0, 0, ${pItem.quantity}, 5, ${pItem.unit || 'Nos'}, ${supplierId}, ${supplierName}, '12 Months', 'active', ${now}, ${now})
        `;
        prodRows = await db.sql`SELECT * FROM products WHERE id = ${newProdId}`;
      }

      if (prodRows && (prodRows as any[]).length > 0) {
        const prod = (prodRows as any[])[0];
        const prevStock = prod.currentStock;
        const newStock = prevStock + pItem.quantity;

        await db.sql`UPDATE products SET currentStock = ${newStock}, purchasePrice = ${pItem.purchaseRate}, updatedAt = ${now} WHERE id = ${prod.id}`;

        // Insert stock transaction record
        const stkId = `stk-${Date.now()}-${prod.id}`;
        await db.sql`
          INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
          VALUES (${stkId}, ${prod.id}, ${prod.name}, 'purchase', ${pItem.quantity}, ${prevStock}, ${newStock}, ${billNumber.trim()}, ${req.user?.id || 'staff'}, ${req.user?.name || 'Staff'}, ${'Purchased Inward Stock (Bill: ' + billNumber.trim() + ')'}, ${now})
        `;
      }
    }

    // Update Supplier Ledger and currentPayable
    const supRows = await db.sql`SELECT * FROM suppliers WHERE id = ${supplierId}`;
    if (supRows && (supRows as any[]).length > 0) {
      const supplier = (supRows as any[])[0];
      const newPayable = (supplier.currentPayable || 0) + balance;

      await db.sql`UPDATE suppliers SET currentPayable = ${newPayable} WHERE id = ${supplierId}`;

      // Credit entry for bill
      await db.sql`
        INSERT INTO supplier_ledgers (id, supplierId, supplierName, date, description, type, referenceNo, debit, credit, balance, notes)
        VALUES (${'sld-' + Date.now() + '-pur'}, ${supplierId}, ${supplierName}, ${now}, ${'Purchase Bill ' + billNumber.trim()}, 'purchase', ${billNumber.trim()}, 0, ${grandTotal}, ${newPayable}, ${notes?.trim() || ''})
      `;

      // Debit entry for paid amount if any
      if (paid > 0) {
        await db.sql`
          INSERT INTO supplier_ledgers (id, supplierId, supplierName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'sld-' + Date.now() + '-pay'}, ${supplierId}, ${supplierName}, ${now}, ${'Payment Made for Bill ' + billNumber.trim()}, 'payment', ${billNumber.trim()}, ${paid}, 0, ${newPayable}, ${'Payment Mode: ' + (paymentMode || 'Cash')})
        `;
      }
    }

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'PURCHASE_RECORDED', 'Purchases', `Recorded purchase bill ${billNumber.trim()} from ${supplierName} (Total: ₹${grandTotal})`, purchaseId);

    res.status(201).json({
      id: purchaseId,
      billNumber: billNumber.trim(),
      supplierId,
      supplierName,
      billDate: formattedBillDate,
      grandTotal,
      paidAmount: paid,
      paymentStatus,
      items: processedItems,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to record purchase bill.' });
  }
});

// -------------------------------------------------------------
// 9. LEDGER MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/ledger/customer/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const entries = await db.sql`SELECT * FROM customer_ledgers WHERE customerId = ${req.params.id} ORDER BY date ASC`;
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/ledger/supplier/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const entries = await db.sql`SELECT * FROM supplier_ledgers WHERE supplierId = ${req.params.id} ORDER BY date ASC`;
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/ledger/business', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;
    let payments = (await db.sql`SELECT * FROM payments ORDER BY date DESC`) as any[];
    let invoices = (await db.sql`SELECT * FROM invoices ORDER BY date DESC`) as any[];
    const customers = (await db.sql`SELECT currentOutstanding FROM customers`) as any[];
    const suppliers = (await db.sql`SELECT currentPayable FROM suppliers`) as any[];

    if (fromDate && typeof fromDate === 'string') {
      payments = payments.filter((p) => p.date >= fromDate);
      invoices = invoices.filter((i) => i.date >= fromDate);
    }
    if (toDate && typeof toDate === 'string') {
      payments = payments.filter((p) => p.date <= toDate + 'T23:59:59.999Z');
      invoices = invoices.filter((i) => i.date <= toDate + 'T23:59:59.999Z');
    }

    const totalInvoiced = invoices.reduce((a: number, b: any) => a + b.grandTotal, 0);
    const totalCollections = payments.reduce((a: number, b: any) => a + b.amount, 0);
    const totalReceivables = customers.reduce((a: number, b: any) => a + (b.currentOutstanding || 0), 0);
    const totalPayables = suppliers.reduce((a: number, b: any) => a + (b.currentPayable || 0), 0);

    res.json({ totalInvoiced, totalCollections, totalReceivables, totalPayables, payments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Customer Ledger Entry
apiRouter.post('/ledger/customer/entry', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerId, description, type, referenceNo, debit, credit, notes, date } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required.' });

    const custRows = await db.sql`SELECT * FROM customers WHERE id = ${customerId}`;
    const customer = custRows && (custRows as any[]).length > 0 ? (custRows as any[])[0] : null;
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const debitAmt = Math.max(0, Number(debit) || 0);
    const creditAmt = Math.max(0, Number(credit) || 0);
    if (debitAmt === 0 && creditAmt === 0) return res.status(400).json({ error: 'Either debit or credit amount must be greater than zero.' });

    const prevBalance = customer.currentOutstanding || 0;
    const newBalance = Math.max(0, prevBalance + debitAmt - creditAmt);
    await db.sql`UPDATE customers SET currentOutstanding = ${newBalance} WHERE id = ${customerId}`;

    const newEntry = {
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
      notes: notes?.trim() || null,
    };

    await db.sql`
      INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
      VALUES (${newEntry.id}, ${newEntry.customerId}, ${newEntry.customerName}, ${newEntry.date}, ${newEntry.description}, ${newEntry.type}, ${newEntry.referenceNo}, ${newEntry.debit}, ${newEntry.credit}, ${newEntry.balance}, ${newEntry.notes})
    `;

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'LEDGER_ENTRY_ADDED', 'Ledgers', `Added ${debitAmt > 0 ? 'Debit ₹' + debitAmt : 'Credit ₹' + creditAmt} entry for ${customer.name} (Ref: ${newEntry.referenceNo})`, newEntry.id);
    res.status(201).json({ entry: newEntry, customer: { ...customer, currentOutstanding: newBalance } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Supplier Ledger Entry
apiRouter.post('/ledger/supplier/entry', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplierId, description, type, referenceNo, debit, credit, notes, date } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'Supplier ID is required.' });

    const supRows = await db.sql`SELECT * FROM suppliers WHERE id = ${supplierId}`;
    const supplier = supRows && (supRows as any[]).length > 0 ? (supRows as any[])[0] : null;
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    const debitAmt = Math.max(0, Number(debit) || 0);
    const creditAmt = Math.max(0, Number(credit) || 0);
    if (debitAmt === 0 && creditAmt === 0) return res.status(400).json({ error: 'Either debit or credit amount must be greater than zero.' });

    const prevPayable = supplier.currentPayable || 0;
    const newPayable = Math.max(0, prevPayable + creditAmt - debitAmt);
    await db.sql`UPDATE suppliers SET currentPayable = ${newPayable} WHERE id = ${supplierId}`;

    const newEntry = {
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
      notes: notes?.trim() || null,
    };

    await db.sql`
      INSERT INTO supplier_ledgers (id, supplierId, supplierName, date, description, type, referenceNo, debit, credit, balance, notes)
      VALUES (${newEntry.id}, ${newEntry.supplierId}, ${newEntry.supplierName}, ${newEntry.date}, ${newEntry.description}, ${newEntry.type}, ${newEntry.referenceNo}, ${newEntry.debit}, ${newEntry.credit}, ${newEntry.balance}, ${newEntry.notes})
    `;

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'SUPPLIER_LEDGER_ENTRY_ADDED', 'Ledgers', `Added ${debitAmt > 0 ? 'Payment ₹' + debitAmt : 'Payable ₹' + creditAmt} entry for supplier ${supplier.name} (Ref: ${newEntry.referenceNo})`, newEntry.id);
    res.status(201).json({ entry: newEntry, supplier: { ...supplier, currentPayable: newPayable } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 10. RETURNS MANAGEMENT
// -------------------------------------------------------------

apiRouter.get('/returns', authenticateToken, async (req: Request, res: Response) => {
  try {
    const returns = await db.sql`SELECT * FROM returns ORDER BY date DESC`;
    res.json(returns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/returns/sales', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
        const prodRows = await db.sql`SELECT * FROM products WHERE id = ${it.productId}`;
        const product = prodRows && (prodRows as any[]).length > 0 ? (prodRows as any[])[0] : null;
        if (product) {
          const prev = product.currentStock;
          const newStock = prev + Number(it.quantity);
          await db.sql`UPDATE products SET currentStock = ${newStock}, updatedAt = ${new Date().toISOString()} WHERE id = ${it.productId}`;
          await db.sql`
            INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date)
            VALUES (${'stk-' + Date.now() + '-' + it.productId}, ${product.id}, ${product.name}, 'customer_return', ${Number(it.quantity)}, ${prev}, ${newStock}, ${returnNumber}, ${req.user?.id || 'usr-staff'}, ${req.user?.name || 'Staff'}, ${'Sales return against ' + originalInvoiceNo + ': ' + reason}, ${new Date().toISOString()})
          `;
        }
      }
    }

    // Update customer ledger
    if (customerId) {
      const custRows = await db.sql`SELECT * FROM customers WHERE id = ${customerId}`;
      const customer = custRows && (custRows as any[]).length > 0 ? (custRows as any[])[0] : null;
      if (customer) {
        const newOutstanding = Math.max(0, (customer.currentOutstanding || 0) - totalReturnAmount);
        await db.sql`UPDATE customers SET currentOutstanding = ${newOutstanding} WHERE id = ${customerId}`;
        await db.sql`
          INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes)
          VALUES (${'cld-' + Date.now()}, ${customer.id}, ${customer.name}, ${new Date().toISOString()}, ${'Sales Return ' + returnNumber + ' (Inv ' + originalInvoiceNo + ')'}, 'customer_return', ${returnNumber}, 0, ${totalReturnAmount}, ${newOutstanding}, ${reason || 'Goods returned by customer'})
        `;
      }
    }

    const record = {
      id: `ret-${Date.now()}`,
      returnNumber,
      date: new Date().toISOString(),
      type: 'sales_return',
      originalReferenceNo: originalInvoiceNo || 'N/A',
      partyId: customerId || 'walk-in',
      partyName: customerName || 'Walk-in Customer',
      totalAmount: totalReturnAmount,
      reason: reason || 'Defective / customer exchange',
      restockInventory: Boolean(restockInventory) ? 1 : 0,
      createdBy: req.user?.name || 'Staff',
      createdAt: new Date().toISOString(),
    };

    await db.sql`
      INSERT INTO returns (id, returnNumber, date, type, originalReferenceNo, partyId, partyName, totalAmount, reason, restockInventory, createdBy, createdAt)
      VALUES (${record.id}, ${record.returnNumber}, ${record.date}, ${record.type}, ${record.originalReferenceNo}, ${record.partyId}, ${record.partyName}, ${record.totalAmount}, ${record.reason}, ${record.restockInventory}, ${record.createdBy}, ${record.createdAt})
    `;

    await logAudit(req.user?.id || 'staff', req.user?.name || 'Staff', 'SALES_RETURN', 'Returns', `Processed sales return ${returnNumber} for ₹${totalReturnAmount}`, record.id);
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 11. SETTINGS & AUDIT LOGS
// -------------------------------------------------------------

apiRouter.get('/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const rows = (await db.sql`SELECT key, value FROM settings`) as any[];
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = row.key === 'nextInvoiceNumber' ? Number(row.value) : row.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/settings', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = req.body as Record<string, any>;
    for (const [key, value] of Object.entries(updates)) {
      const val = String(value);
      await db.sql`INSERT OR REPLACE INTO settings (key, value) VALUES (${key}, ${val})`;
    }

    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'SETTINGS_UPDATED', 'Settings', 'Updated company profile & invoice settings');

    const rows = (await db.sql`SELECT key, value FROM settings`) as any[];
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = row.key === 'nextInvoiceNumber' ? Number(row.value) : row.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/audit-logs', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let logs = (await db.sql`SELECT * FROM audit_logs ORDER BY timestamp DESC`) as any[];
    const { module, action, userId, search, limit } = req.query;

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
    if (limit && !isNaN(Number(limit))) {
      logs = logs.slice(0, Number(limit));
    }

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/audit-logs/clear', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const countRows = (await db.sql`SELECT COUNT(*) as cnt FROM audit_logs`) as any[];
    const count = countRows && countRows.length > 0 ? countRows[0].cnt : 0;
    await db.sql`DELETE FROM audit_logs`;
    await logAudit(req.user?.id || 'admin', req.user?.name || 'Admin', 'AUDIT_LOGS_PURGED', 'System', `Cleared ${count} audit log records`);
    res.json({ message: 'Audit logs cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
