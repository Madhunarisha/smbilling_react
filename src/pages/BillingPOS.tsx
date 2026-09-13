import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Share2,
  UserPlus,
  RefreshCw,
  Percent,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, Customer, InvoiceItem, Invoice, PaymentMode } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { CustomerModal } from '../components/CustomerModal.js';

interface BillingPOSProps {
  onInvoiceCreated: (invoice: Invoice, action: 'print' | 'whatsapp' | 'none') => void;
}

export function BillingPOS({ onInvoiceCreated }: BillingPOSProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // State: products and customers catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  // Selected Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkinName, setWalkinName] = useState('Cash Walk-in');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);

  // Billing items
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);

  // Invoice-level details
  const [isInterState, setIsInterState] = useState(false);
  const [overallDiscountType, setOverallDiscountType] = useState<'percent' | 'flat'>('flat');
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Focus ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, custs, cats] = await Promise.all([
        api.getProducts(),
        api.getCustomers(),
        api.getCategories(),
      ]);
      setProducts(prods);
      setCustomers(custs);
      setCategories(['All', ...cats.map((c) => c.name)]);

      // Default to walk-in customer if exists
      const walkin = custs.find((c) => c.name.toLowerCase().includes('walk-in'));
      if (walkin) {
        setSelectedCustomer(walkin);
        setWalkinName(walkin.name);
        setWalkinPhone(walkin.phone);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load POS catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered product items for quick picker
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Add Product to Cart
  const handleAddToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      showToast(`Warning: ${product.name} is currently out of stock.`, 'warning');
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => {
          if (item.productId === product.id) {
            const newQty = item.quantity + 1;
            const taxable = (newQty * item.rate) - item.discountAmount;
            const gstAmount = taxable * (item.gstRate / 100);
            return {
              ...item,
              quantity: newQty,
              taxableAmount: taxable,
              cgstAmount: isInterState ? 0 : gstAmount / 2,
              sgstAmount: isInterState ? 0 : gstAmount / 2,
              igstAmount: isInterState ? gstAmount : 0,
              totalAmount: taxable + gstAmount,
            };
          }
          return item;
        });
      }

      // Fresh item
      const qty = 1;
      const rate = product.sellingPrice;
      const gstRate = product.gstRate;
      const discount = 0;
      const taxable = (qty * rate) - discount;
      const gstAmount = taxable * (gstRate / 100);

      const newItem: InvoiceItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        brand: product.brand,
        unit: product.unit,
        quantity: qty,
        rate,
        purchaseRate: product.purchasePrice,
        gstRate,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: taxable,
        cgstAmount: isInterState ? 0 : gstAmount / 2,
        sgstAmount: isInterState ? 0 : gstAmount / 2,
        igstAmount: isInterState ? gstAmount : 0,
        totalAmount: taxable + gstAmount,
        barcode: product.barcode,
      };

      return [...prev, newItem];
    });

    showToast(`Added ${product.name}`, 'info');
  };

  // Update Cart Item quantity, rate, or discount
  const handleUpdateItem = (
    itemId: string,
    updates: { quantity?: number; rate?: number; discountPercent?: number }
  ) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newQty = updates.quantity !== undefined ? Math.max(1, updates.quantity) : item.quantity;
          const newRate = updates.rate !== undefined ? Math.max(0, updates.rate) : item.rate;
          const newDiscPct =
            updates.discountPercent !== undefined ? Math.max(0, updates.discountPercent) : item.discountPercent;

          const gross = newQty * newRate;
          const discountAmt = (gross * newDiscPct) / 100;
          const taxable = gross - discountAmt;
          const gstAmount = taxable * (item.gstRate / 100);

          return {
            ...item,
            quantity: newQty,
            rate: newRate,
            discountPercent: newDiscPct,
            discountAmount: discountAmt,
            taxableAmount: taxable,
            cgstAmount: isInterState ? 0 : gstAmount / 2,
            sgstAmount: isInterState ? 0 : gstAmount / 2,
            igstAmount: isInterState ? gstAmount : 0,
            totalAmount: taxable + gstAmount,
          };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Calculate Subtotals & Totals
  const subtotal = cartItems.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const itemsDiscountTotal = cartItems.reduce((acc, item) => acc + item.discountAmount, 0);

  let overallDiscountAmount = 0;
  if (overallDiscountType === 'percent') {
    overallDiscountAmount = (subtotal * overallDiscountValue) / 100;
  } else {
    overallDiscountAmount = overallDiscountValue;
  }

  const taxableAmount = Math.max(0, subtotal - itemsDiscountTotal - overallDiscountAmount);

  // Recalculate tax breakdown
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  cartItems.forEach((item) => {
    const itemTax = item.taxableAmount * (item.gstRate / 100);
    if (isInterState) {
      igstTotal += itemTax;
    } else {
      cgstTotal += itemTax / 2;
      sgstTotal += itemTax / 2;
    }
  });

  const rawGrandTotal = taxableAmount + (isInterState ? igstTotal : cgstTotal + sgstTotal);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

  // Sync paidAmount default whenever grandTotal changes and paidAmount equals old total or is 0
  useEffect(() => {
    if (paymentMode !== 'Credit') {
      setPaidAmount(roundedGrandTotal);
    }
  }, [roundedGrandTotal, paymentMode]);

  const balanceDue = Math.max(0, roundedGrandTotal - paidAmount);

  // Reset Cart
  const handleClearCart = () => {
    setCartItems([]);
    setOverallDiscountValue(0);
    setNotes('');
    showToast('Billing counter cleared', 'info');
  };

  // Customer Selection
  const handleSelectCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setSelectedCustomer(cust);
      setWalkinName(cust.name);
      setWalkinPhone(cust.phone);
    } else {
      setSelectedCustomer(null);
      setWalkinName('Cash Walk-in');
      setWalkinPhone('');
    }
  };

  // Save Invoice handler
  const handleProcessInvoice = async (action: 'print' | 'whatsapp' | 'none') => {
    if (cartItems.length === 0) {
      showToast('Please add at least one item to generate invoice.', 'warning');
      return;
    }
    if (!walkinName.trim()) {
      showToast('Please enter customer name.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const invoicePayload = {
        customerId: selectedCustomer?.id,
        customerName: walkinName,
        customerPhone: walkinPhone,
        customerGstin: selectedCustomer?.gstin,
        billingAddress: selectedCustomer?.address,
        isInterState,
        items: cartItems,
        subtotal,
        overallDiscountPercent: overallDiscountType === 'percent' ? overallDiscountValue : 0,
        overallDiscountAmount,
        taxableAmount,
        cgstTotal: isInterState ? 0 : cgstTotal,
        sgstTotal: isInterState ? 0 : sgstTotal,
        igstTotal: isInterState ? igstTotal : 0,
        roundOff,
        grandTotal: roundedGrandTotal,
        paymentMode,
        paidAmount,
        notes,
        createdBy: user?.name || 'Billing Staff',
      };

      const created = await api.createInvoice(invoicePayload);
      showToast(`Invoice ${created.invoiceNumber} generated successfully!`, 'success');

      // Update local product inventory count
      setProducts((prev) =>
        prev.map((p) => {
          const itemInCart = cartItems.find((ci) => ci.productId === p.id);
          if (itemInCart) {
            return {
              ...p,
              currentStock: p.currentStock - itemInCart.quantity,
            };
          }
          return p;
        })
      );

      // Trigger Print or WhatsApp modal if selected
      onInvoiceCreated(created, action);

      // Clear bill for next customer
      handleClearCart();
    } catch (err: any) {
      showToast(err.message || 'Failed to generate invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Fast Billing Counter (POS)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                GST Ready
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tax Invoice Generation • Instant Barcode &amp; Spare Part Search
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Inter-State Tax Toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-200 hover:bg-slate-200/70 transition-colors">
            <input
              type="checkbox"
              checked={isInterState}
              onChange={(e) => setIsInterState(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Inter-State (IGST)</span>
          </label>

          <button
            type="button"
            onClick={handleClearCart}
            disabled={cartItems.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear Bill</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Catalog Picker / Right Live Invoice Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Product Catalog Search & Quick Selector (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by part name, SKU, brand or barcode..."
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-800"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Items List */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No matching spare parts or batteries found.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isLow = p.currentStock <= p.minStockLevel;
                const isOut = p.currentStock <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate group-hover:text-blue-700">
                          {p.name}
                        </span>
                        {p.warrantyPeriod && (
                          <span className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                            {p.warrantyPeriod}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{p.sku}</span>
                        <span>•</span>
                        <span>{p.brand}</span>
                        <span>•</span>
                        <span>GST {p.gstRate}%</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-sm text-slate-900">
                        {formatINR(p.sellingPrice)}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                          isOut
                            ? 'bg-red-100 text-red-700'
                            : isLow
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.currentStock} {p.unit}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-600 group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Invoice Details & Cart (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          {/* Customer Selection Row */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Customer Information
              </span>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Add New Customer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-slate-800"
                >
                  <option value="">-- Cash Walk-in Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {c.customerType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="tel"
                  value={walkinPhone}
                  onChange={(e) => setWalkinPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Mobile No."
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 w-24 text-center">Qty</th>
                    <th className="p-2.5 w-20 text-right">Rate (₹)</th>
                    <th className="p-2.5 w-16 text-right">Disc %</th>
                    <th className="p-2.5 w-14 text-center">GST</th>
                    <th className="p-2.5 w-24 text-right">Total (₹)</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No items added yet. Click on spare parts on the left to add to bill.
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900 line-clamp-1">{item.productName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.sku}</div>
                        </td>

                        {/* Quantity with +/- */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { quantity: item.quantity - 1 })}
                              className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  quantity: parseInt(e.target.value, 10) || 1,
                                })
                              }
                              className="w-10 text-center font-bold font-mono py-0.5 border border-slate-300 rounded text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { quantity: item.quantity + 1 })}
                              className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Rate */}
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                rate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-16 text-right font-mono py-0.5 px-1 border border-slate-300 rounded text-xs"
                          />
                        </td>

                        {/* Discount % */}
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                discountPercent: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-12 text-right font-mono py-0.5 px-1 border border-slate-300 rounded text-xs"
                          />
                        </td>

                        {/* GST % */}
                        <td className="p-2.5 text-center font-mono font-medium text-slate-600">
                          {item.gstRate}%
                        </td>

                        {/* Line Total */}
                        <td className="p-2.5 text-right font-bold font-mono text-slate-900">
                          {item.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </td>

                        {/* Remove */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discount & Invoice Calculation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            {/* Left Controls: Overall Discount & Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Overall Special Discount
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={overallDiscountType}
                    onChange={(e) => setOverallDiscountType(e.target.value as 'percent' | 'flat')}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                  >
                    <option value="flat">Flat (₹)</option>
                    <option value="percent">Percent (%)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={overallDiscountValue}
                    onChange={(e) => setOverallDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  {overallDiscountAmount > 0 && (
                    <span className="text-emerald-700 font-semibold font-mono">
                      -₹{overallDiscountAmount.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Invoice Remarks / Battery Serial No
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Battery Sl: 890124801; Fitment free of charge"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                />
              </div>
            </div>

            {/* Right Totals Breakdown */}
            <div className="space-y-1.5 divide-y divide-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Taxable Amount:</span>
                <span className="font-mono">{formatINR(taxableAmount)}</span>
              </div>

              {isInterState ? (
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>IGST Total:</span>
                  <span className="font-mono">{formatINR(igstTotal)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-600 pt-1">
                  <span>GST Total (CGST + SGST):</span>
                  <span className="font-mono">{formatINR(cgstTotal + sgstTotal)}</span>
                </div>
              )}

              {roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 pt-1">
                  <span>Round Off:</span>
                  <span className="font-mono">
                    {roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-2 border-t-2 border-slate-800">
                <span>GRAND TOTAL:</span>
                <span className="font-mono text-blue-900">{formatINR(roundedGrandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/90 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="Cash">Cash (Counter)</option>
                  <option value="UPI">UPI (QR / PhonePe / GPay)</option>
                  <option value="Card">Card (Debit / Credit)</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT)</option>
                  <option value="Credit">Credit (Khata / Udhar)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Received Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Balance Due</label>
                <div
                  className={`px-3 py-2 text-sm font-black font-mono rounded-lg border ${
                    balanceDue > 0
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {formatINR(balanceDue)}
                </div>
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-slate-600 text-[11px] font-bold">Quick Cash:</span>
              <button
                type="button"
                onClick={() => setPaidAmount(roundedGrandTotal)}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 rounded-md font-mono font-semibold text-slate-700 transition-colors"
              >
                Exact ({formatINR(roundedGrandTotal)})
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(Math.ceil(roundedGrandTotal / 100) * 100)}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 rounded-md font-mono font-semibold text-slate-700 transition-colors"
              >
                Next 100 ({formatINR(Math.ceil(roundedGrandTotal / 100) * 100)})
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(Math.ceil(roundedGrandTotal / 500) * 500)}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 rounded-md font-mono font-semibold text-slate-700 transition-colors"
              >
                Next 500 ({formatINR(Math.ceil(roundedGrandTotal / 500) * 500)})
              </button>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={submitting || cartItems.length === 0}
              onClick={() => handleProcessInvoice('print')}
              className="py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm shadow-md shadow-blue-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Save &amp; Print GST Invoice</span>
            </button>

            <button
              type="button"
              disabled={submitting || cartItems.length === 0}
              onClick={() => handleProcessInvoice('whatsapp')}
              className="py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black text-sm shadow-md shadow-red-950/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Save &amp; Share via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Add Customer Modal */}
      <CustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSave={async (newCustData) => {
          const createdCust = await api.createCustomer(newCustData);
          setCustomers((prev) => [createdCust, ...prev]);
          setSelectedCustomer(createdCust);
          setWalkinName(createdCust.name);
          setWalkinPhone(createdCust.phone);
          showToast(`Customer ${createdCust.name} added!`, 'success');
        }}
      />
    </div>
  );
}
