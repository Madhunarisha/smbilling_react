export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  status?: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon?: string;
  productCount?: number;
  createdAt: string;
}

export type UnitType = 'Nos' | 'Sets' | 'Litres' | 'Pcs' | 'Pairs' | 'Boxes';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  modelNumber: string;
  barcode: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  discountPercent: number;
  openingStock: number;
  currentStock: number;
  minStockLevel: number;
  unit: UnitType;
  supplierId?: string;
  supplierName?: string;
  warrantyPeriod: string; // e.g. "12 Months", "24 Months", "36 Months"
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type StockTransactionType =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'damaged'
  | 'customer_return'
  | 'supplier_return';

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  type: StockTransactionType;
  quantity: number; // positive or negative
  previousStock: number;
  updatedStock: number;
  referenceNo?: string;
  userId: string;
  userName: string;
  remarks: string;
  date: string;
}

export type CustomerType = 'Retail' | 'Wholesale' | 'Garage/Mechanic';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  gstin?: string;
  email?: string;
  customerType: CustomerType;
  openingBalance: number;
  creditLimit: number;
  currentOutstanding: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  gstin?: string;
  openingBalance: number;
  paymentTerms?: string;
  currentPayable: number;
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  purchaseRate: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface Purchase {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  billDate: string;
  items: PurchaseItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: PaymentMode;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  brand?: string;
  barcode?: string;
  batterySerial?: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  purchaseRate?: number;
  mrp?: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit' | 'Multiple';
export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerGstin?: string;
  billingAddress?: string;
  shippingAddress?: string;
  isInterState: boolean; // false = CGST + SGST, true = IGST
  gstType?: 'inclusive' | 'exclusive';
  items: InvoiceItem[];
  subtotal: number;
  overallDiscountType?: 'percent' | 'fixed';
  overallDiscountValue?: number;
  overallDiscountAmount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  notes?: string;
  deliveryNote?: string;
  modeOfPayment?: string;
  referenceNo?: string;
  otherReferences?: string;
  buyersOrderNo?: string;
  orderDate?: string;
  dispatchDocNo?: string;
  deliveryDate?: string;
  dispatchedThrough?: string;
  destination?: string;
  termsOfDelivery?: string;
  createdBy: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  date: string;
  notes?: string;
  createdBy: string;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  description: string;
  type: 'invoice' | 'payment' | 'credit_sale' | 'customer_return' | 'adjustment';
  referenceNo: string;
  debit: number; // increases receivables
  credit: number; // decreases receivables
  balance: number; // running balance
  notes?: string;
}

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  description: string;
  type: 'purchase' | 'payment' | 'supplier_return' | 'adjustment';
  referenceNo: string;
  debit: number; // decreases payables
  credit: number; // increases payables
  balance: number;
  notes?: string;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  date: string;
  type: 'sales_return' | 'purchase_return';
  originalReferenceNo: string;
  partyId: string;
  partyName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    rate: number;
    gstRate: number;
    total: number;
  }[];
  totalAmount: number;
  reason: string;
  restockInventory: boolean;
  createdBy: string;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  legalName?: string;
  tradeName?: string;
  constitution?: string;
  tagline: string;
  address: string;
  buildingNo?: string;
  roadStreet?: string;
  locality?: string;
  city: string;
  district?: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  alternatePhone?: string;
  email: string;
  gstin: string;
  pan?: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  termsAndConditions: string;
  bankName: string;
  bankAccount: string;
  ifscCode: string;
  bankBranch: string;
  upiId: string;
  defaultGstRate: number;
  maxDiscountPercent: number;
}

export type BusinessProfile = BusinessSettings;

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  recordId?: string;
  details: string;
  timestamp: string;
}

export interface DashboardStats {
  todaySales: number;
  todayPurchases: number;
  todayProfit: number;
  totalOutstanding: number;
  totalReceivables: number;
  totalPayables: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  todayInvoiceCount: number;
  dailySales: { date: string; sales: number; profit: number; invoices: number }[];
  monthlySales: { month: string; sales: number; purchases: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  paymentBreakdown: { method: string; amount: number; count: number }[];
  recentInvoices: Invoice[];
  recentStockUpdates: StockTransaction[];
  recentPayments: Payment[];
}
