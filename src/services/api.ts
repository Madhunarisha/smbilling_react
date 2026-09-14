import {
  Product,
  Category,
  Customer,
  Supplier,
  Invoice,
  DashboardStats,
  StockTransaction,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  ReturnRecord,
  BusinessSettings,
  AuditLog,
  User,
} from '../types/index.js';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('smautos_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'An error occurred while processing request.');
  }
  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ user: User }>('/auth/me'),

  // Dashboard
  getDashboard: () => request<DashboardStats>('/dashboard'),

  // Products
  getProducts: (params?: { q?: string; category?: string; brand?: string; stockStatus?: string; sort?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.brand) searchParams.set('brand', params.brand);
    if (params?.stockStatus) searchParams.set('stockStatus', params.stockStatus);
    if (params?.sort) searchParams.set('sort', params.sort);
    const qs = searchParams.toString();
    return request<Product[]>(`/products${qs ? `?${qs}` : ''}`);
  },
  getProductById: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (data: Partial<Product>) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<{ message: string; id: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),

  // Categories
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (data: { name: string; description?: string }) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Customers
  getCustomers: (q?: string) => request<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getCustomerById: (id: string) => request<Customer>(`/customers/${id}`),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) =>
    request<{ message: string }>(`/customers/${id}`, {
      method: 'DELETE',
    }),

  // Suppliers
  getSuppliers: () => request<Supplier[]>('/suppliers'),
  createSupplier: (data: Partial<Supplier>) =>
    request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSupplier: (id: string, data: Partial<Supplier>) =>
    request<Supplier>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSupplier: (id: string) =>
    request<{ message: string }>(`/suppliers/${id}`, {
      method: 'DELETE',
    }),

  // Invoices
  getInvoices: (params?: { q?: string; status?: string; fromDate?: string; toDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
    if (params?.toDate) searchParams.set('toDate', params.toDate);
    const qs = searchParams.toString();
    return request<Invoice[]>(`/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoiceById: (id: string) => request<Invoice>(`/invoices/${id}`),
  createInvoice: (data: any) =>
    request<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordPayment: (invoiceId: string, data: { amount: number; paymentMode: string; transactionRef?: string; notes?: string }) =>
    request<{ invoice: Invoice; payment: any }>(`/invoices/${invoiceId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteInvoice: (id: string) =>
    request<{ message: string }>(`/invoices/${id}`, {
      method: 'DELETE',
    }),

  // Stock
  getStockHistory: (params?: { productId?: string; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.productId) searchParams.set('productId', params.productId);
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString();
    return request<StockTransaction[]>(`/stock/history${qs ? `?${qs}` : ''}`);
  },
  adjustStock: (data: { productId: string; quantity: number; type: string; remarks?: string; referenceNo?: string }) =>
    request<{ product: Product; transaction: StockTransaction }>('/stock/adjustment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Ledger Management
  getCustomerLedger: (customerId: string) =>
    request<CustomerLedgerEntry[]>(`/ledger/customer/${customerId}`),
  getSupplierLedger: (supplierId: string) =>
    request<SupplierLedgerEntry[]>(`/ledger/supplier/${supplierId}`),
  addCustomerLedgerEntry: (data: {
    customerId: string;
    description?: string;
    type?: string;
    referenceNo?: string;
    debit?: number;
    credit?: number;
    notes?: string;
    date?: string;
  }) =>
    request<{ entry: CustomerLedgerEntry; customer: Customer }>('/ledger/customer/entry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addSupplierLedgerEntry: (data: {
    supplierId: string;
    description?: string;
    type?: string;
    referenceNo?: string;
    debit?: number;
    credit?: number;
    notes?: string;
    date?: string;
  }) =>
    request<{ entry: SupplierLedgerEntry; supplier: Supplier }>('/ledger/supplier/entry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBusinessLedger: (params?: { fromDate?: string; toDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
    if (params?.toDate) searchParams.set('toDate', params.toDate);
    const qs = searchParams.toString();
    return request<any>(`/ledger/business${qs ? `?${qs}` : ''}`);
  },

  // Returns
  getReturns: () => request<ReturnRecord[]>('/returns'),
  createSalesReturn: (data: any) =>
    request<ReturnRecord>('/returns/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings
  getSettings: () => request<BusinessSettings>('/settings'),
  getBusinessProfile: () => request<BusinessSettings>('/settings'),
  updateSettings: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateBusinessProfile: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetDatabase: () =>
    request<{ message: string }>('/settings/reset', {
      method: 'POST',
    }),

  // Audit Logs
  getAuditLogs: (params?: { module?: string; action?: string; userId?: string; search?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.module) searchParams.set('module', params.module);
    if (params?.action) searchParams.set('action', params.action);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return request<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
  clearAuditLogs: () =>
    request<{ message: string }>('/audit-logs/clear', {
      method: 'POST',
    }),
};
