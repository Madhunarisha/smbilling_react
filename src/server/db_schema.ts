import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

const localDataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(localDataDir)) {
  fs.mkdirSync(localDataDir, { recursive: true });
}

export const db = new Database(path.join(localDataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

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
  );

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
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

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
  );

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
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    recordId TEXT,
    details TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    productCount INTEGER,
    createdAt TEXT NOT NULL
  );
  
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
  );
  
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
  );
  
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
  );
  
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
  );
  
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
  );
  
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
  );
  
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
  );
  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function logAudit(userId: string, userName: string, action: string, module: string, details: string, recordId?: string) {
  const log = {
    id: `log-\${Date.now()}-\${Math.random().toString(36).substring(2, 6)}`,
    userId,
    userName,
    action,
    module,
    recordId,
    details,
    timestamp: new Date().toISOString(),
  };
  
  db.prepare(`
    INSERT INTO audit_logs (id, userId, userName, action, module, recordId, details, timestamp)
    VALUES (@id, @userId, @userName, @action, @module, @recordId, @details, @timestamp)
  `).run(log);
}
