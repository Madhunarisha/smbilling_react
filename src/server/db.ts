import { Database } from '@sqlitecloud/drivers';
import bcrypt from 'bcryptjs';

let currentDbInstance: Database | null = null;

const DEFAULT_SQLITE_URL = 'sqlitecloud://clhixlrlvk.g2.sqlite.cloud:8860/SMDB?apikey=m7SpwhsWexbaCs7Z69puOeKQgDY7a3CPbPHN5l8vCOo';

function getDbUrl(): string {
  const envUrl = process.env.SQLITECLOUD_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('sqlitecloud://')) {
    return envUrl.trim();
  }
  return DEFAULT_SQLITE_URL;
}

function getDbInstance(): Database {
  const url = getDbUrl();

  const conn = (currentDbInstance as any)?.connection;
  if (!currentDbInstance || (conn && conn.connected === false)) {
    if (currentDbInstance) {
      try {
        currentDbInstance.close();
      } catch (e) {
        // ignore close error on dead connection
      }
    }
    console.log('[SQLiteCloud] Creating new database connection instance...');
    currentDbInstance = new Database(url);
  }
  return currentDbInstance;
}

export function resetDbConnection(): Database {
  const url = getDbUrl();
  if (currentDbInstance) {
    try {
      currentDbInstance.close();
    } catch (e) {
      // ignore error
    }
  }
  console.log('[SQLiteCloud] Reconnecting database instance...');
  currentDbInstance = new Database(url);
  return currentDbInstance;
}

// Proxy 'db' object to handle auto-reconnection and query auto-retry on disconnection/waking up
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    if (prop === 'sql') {
      return async function (sql: any, ...values: any[]) {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          attempts++;
          let instance = getDbInstance();
          try {
            return await instance.sql(sql, ...values);
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            const isConnError =
              errMsg.includes('Connection unavailable') ||
              errMsg.includes('disconnected') ||
              errMsg.includes('ERR_CONNECTION_NOT_ESTABLISHED') ||
              errMsg.includes('Waking Up') ||
              errMsg.includes('timeout') ||
              errMsg.includes('ECONNREFUSED') ||
              errMsg.includes('socket hang up') ||
              err?.errorCode === 'ERR_CONNECTION_NOT_ESTABLISHED' ||
              err?.code === 'ERR_CONNECTION_NOT_ESTABLISHED';

            if (isConnError && attempts < maxAttempts) {
              console.warn(`[SQLiteCloud] Database waking up or connection unavailable (attempt ${attempts}/${maxAttempts}). Retrying in 1.5s...`);
              resetDbConnection();
              await new Promise((resolve) => setTimeout(resolve, 1500));
              continue;
            }
            throw err;
          }
        }
      };
    }

    const instance = getDbInstance();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});


// ---------------------------------------------------------------
// Schema Initialization
// ---------------------------------------------------------------
export async function initDb(): Promise<void> {
  console.log('Initializing SQLite Cloud schema...');

  await db.sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      passwordHash TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      alternatePhone TEXT,
      address TEXT NOT NULL,
      gstin TEXT,
      email TEXT,
      customerType TEXT NOT NULL,
      openingBalance REAL NOT NULL,
      creditLimit REAL NOT NULL,
      currentOutstanding REAL NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      modelNumber TEXT,
      barcode TEXT,
      description TEXT,
      purchasePrice REAL NOT NULL,
      sellingPrice REAL NOT NULL,
      mrp REAL,
      gstRate REAL NOT NULL,
      discountPercent REAL NOT NULL,
      openingStock REAL NOT NULL,
      currentStock REAL NOT NULL,
      minStockLevel REAL NOT NULL,
      unit TEXT NOT NULL,
      supplierId TEXT,
      supplierName TEXT,
      warrantyPeriod TEXT,
      wholesalePrice REAL,
      retailPrice REAL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `;

  try {
    await db.sql`ALTER TABLE products ADD COLUMN wholesalePrice REAL`;
  } catch (_) {}
  try {
    await db.sql`ALTER TABLE products ADD COLUMN retailPrice REAL`;
  } catch (_) {}

  // Populate missing wholesalePrice / retailPrice from sellingPrice / mrp
  try {
    await db.sql`UPDATE products SET wholesalePrice = sellingPrice WHERE wholesalePrice IS NULL OR wholesalePrice = 0`;
    await db.sql`UPDATE products SET retailPrice = CASE WHEN mrp IS NOT NULL AND mrp > 0 THEN mrp ELSE sellingPrice END WHERE retailPrice IS NULL OR retailPrice = 0`;
  } catch (_) {}

  await db.sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      customerGstin TEXT,
      billingAddress TEXT,
      shippingAddress TEXT,
      isInterState INTEGER NOT NULL,
      gstType TEXT,
      subtotal REAL NOT NULL,
      overallDiscountType TEXT,
      overallDiscountValue REAL,
      overallDiscountAmount REAL NOT NULL,
      taxableAmount REAL NOT NULL,
      cgstTotal REAL NOT NULL,
      sgstTotal REAL NOT NULL,
      igstTotal REAL NOT NULL,
      roundOff REAL NOT NULL,
      grandTotal REAL NOT NULL,
      paidAmount REAL NOT NULL,
      balanceAmount REAL NOT NULL,
      paymentMode TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `;

  try {
    await db.sql`ALTER TABLE invoices ADD COLUMN modeOfPayment TEXT`;
  } catch (_) {}
  try {
    await db.sql`ALTER TABLE invoices ADD COLUMN dispatchedThrough TEXT`;
  } catch (_) {}

  await db.sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      sku TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      rate REAL NOT NULL,
      purchaseRate REAL,
      mrp REAL,
      discountPercent REAL NOT NULL,
      discountAmount REAL NOT NULL,
      taxableAmount REAL NOT NULL,
      gstRate REAL NOT NULL,
      cgstAmount REAL NOT NULL,
      sgstAmount REAL NOT NULL,
      igstAmount REAL NOT NULL,
      totalAmount REAL NOT NULL,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      recordId TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS banks (
      id TEXT PRIMARY KEY,
      bankName TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      ifsc TEXT NOT NULL,
      branch TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      productCount INTEGER,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contactPerson TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      gstin TEXT,
      openingBalance REAL NOT NULL,
      paymentTerms TEXT,
      currentPayable REAL NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoiceId TEXT,
      invoiceNumber TEXT,
      customerId TEXT,
      customerName TEXT NOT NULL,
      amount REAL NOT NULL,
      paymentMode TEXT NOT NULL,
      transactionRef TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT NOT NULL
    )
  `;

  try {
    await db.sql`ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'Inward (Customer Receipt)'`;
  } catch (_) {}
  try {
    await db.sql`ALTER TABLE payments ADD COLUMN status TEXT DEFAULT 'Completed'`;
  } catch (_) {}
  try {
    await db.sql`ALTER TABLE payments ADD COLUMN partyName TEXT`;
  } catch (_) {}

  await db.sql`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      previousStock REAL NOT NULL,
      updatedStock REAL NOT NULL,
      referenceNo TEXT,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      remarks TEXT,
      date TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS customer_ledgers (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      referenceNo TEXT NOT NULL,
      debit REAL NOT NULL,
      credit REAL NOT NULL,
      balance REAL NOT NULL,
      notes TEXT
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS supplier_ledgers (
      id TEXT PRIMARY KEY,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      referenceNo TEXT NOT NULL,
      debit REAL NOT NULL,
      credit REAL NOT NULL,
      balance REAL NOT NULL,
      notes TEXT
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      billNumber TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      billDate TEXT NOT NULL,
      subtotal REAL NOT NULL,
      taxAmount REAL NOT NULL,
      grandTotal REAL NOT NULL,
      paidAmount REAL NOT NULL,
      balanceAmount REAL NOT NULL,
      paymentMode TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchaseId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      purchaseRate REAL NOT NULL,
      taxableAmount REAL NOT NULL,
      gstRate REAL NOT NULL,
      gstAmount REAL NOT NULL,
      totalAmount REAL NOT NULL,
      FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      returnNumber TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      originalReferenceNo TEXT NOT NULL,
      partyId TEXT NOT NULL,
      partyName TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      reason TEXT NOT NULL,
      restockInventory INTEGER NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      returnId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      gstRate REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (returnId) REFERENCES returns(id) ON DELETE CASCADE
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  console.log('Schema ready.');

  // ---------------------------------------------------------------
  // Seed Admin User
  // ---------------------------------------------------------------
  const adminRows = await db.sql`SELECT id FROM users WHERE username = 'admin'`;
  if (!adminRows || adminRows.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const id = 'usr-admin';
    const createdAt = new Date().toISOString();
    await db.sql`
      INSERT INTO users (id, username, email, role, name, phone, passwordHash, status, createdAt)
      VALUES (${id}, 'admin', 'admin@smautos.com', 'admin', 'Hariharan S', '+91 9578851650', ${adminHash}, 'active', ${createdAt})
    `;
    console.log('Admin user seeded.');
  }

  // ---------------------------------------------------------------
  // Seed Business Settings
  // ---------------------------------------------------------------
  const settingsRows = await db.sql`SELECT key FROM settings WHERE key = 'businessName'`;
  if (!settingsRows || settingsRows.length === 0) {
    const defaultSettings: Record<string, string> = {
      businessName: 'SM AUTOS & BATTERY',
      legalName: 'SM AUTOS & BATTERY',
      tradeName: 'SM AUTOS & BATTERY',
      tagline: 'Automotive Batteries & Spares',
      address: 'NO : 5/1, ST-3, MELAPUDU THERU, TIMMARASANAYAKKANUR, AUNDIPATTI',
      city: 'THENI',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '625536',
      phone: '+91 9578851650',
      email: '',
      gstin: '33ARQPH700P1ZE',
      invoicePrefix: 'SMA',
      nextInvoiceNumber: '1001',
      termsAndConditions: 'Goods once sold will not be taken back.',
      bankName: 'HDFC Bank',
      bankAccount: '12345678901234',
      ifscCode: 'HDFC0001234',
      bankBranch: 'Main Branch',
      upiId: 'smautos@hdfcbank',
      defaultGstRate: '18',
      maxDiscountPercent: '20',
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await db.sql`INSERT OR IGNORE INTO settings (key, value) VALUES (${key}, ${value})`;
    }
    console.log('Default settings seeded.');
  }
}

// ---------------------------------------------------------------
// Audit logging (async)
// ---------------------------------------------------------------
export async function logAudit(
  userId: string,
  userName: string,
  action: string,
  module: string,
  details: string,
  recordId?: string
): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();
  const rId = recordId ?? null;
  try {
    await db.sql`
      INSERT INTO audit_logs (id, userId, userName, action, module, recordId, details, timestamp)
      VALUES (${id}, ${userId || 'system'}, ${userName || 'System'}, ${action}, ${module}, ${rId}, ${details}, ${timestamp})
    `;
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

// ---------------------------------------------------------------
// Shims for backward compatibility (now async-aware)
// ---------------------------------------------------------------
export async function readDb(): Promise<any> {
  const [
    users,
    customers,
    products,
    rawInvoices,
    rawItems,
    categories,
    suppliers,
    stockTransactions,
    customerLedgers,
    supplierLedgers,
    returns,
    payments,
    settingsRows,
    auditLogs,
  ] = await Promise.all([
    db.sql`SELECT * FROM users`,
    db.sql`SELECT * FROM customers`,
    db.sql`SELECT * FROM products`,
    db.sql`SELECT * FROM invoices ORDER BY date DESC`,
    db.sql`SELECT * FROM invoice_items`,
    db.sql`SELECT * FROM categories`,
    db.sql`SELECT * FROM suppliers`,
    db.sql`SELECT * FROM stock_transactions ORDER BY date DESC`,
    db.sql`SELECT * FROM customer_ledgers`,
    db.sql`SELECT * FROM supplier_ledgers`,
    db.sql`SELECT * FROM returns ORDER BY date DESC`,
    db.sql`SELECT * FROM payments ORDER BY date DESC`,
    db.sql`SELECT key, value FROM settings`,
    db.sql`SELECT * FROM audit_logs ORDER BY timestamp DESC`,
  ]);

  const itemsByInvoice = new Map<string, any[]>();
  for (const item of (rawItems as any[])) {
    if (!itemsByInvoice.has(item.invoiceId)) itemsByInvoice.set(item.invoiceId, []);
    itemsByInvoice.get(item.invoiceId)!.push(item);
  }

  const invoices = (rawInvoices as any[]).map((inv) => ({
    ...inv,
    items: itemsByInvoice.get(inv.id) || [],
  }));

  const settingsObj: Record<string, any> = {};
  for (const row of (settingsRows as any[])) {
    settingsObj[row.key] = row.key === 'nextInvoiceNumber' ? Number(row.value) : row.value;
  }

  return {
    users,
    customers,
    products,
    invoices,
    categories,
    suppliers,
    stockTransactions,
    customerLedgers,
    supplierLedgers,
    returns,
    payments,
    settings: settingsObj,
    auditLogs,
  };
}

export function writeDb(_data: any): void {
  // no-op — all writes go directly to SQLite Cloud via db.sql
}

export function getMongoDb() {
  return null;
}
