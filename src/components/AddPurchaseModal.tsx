import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Truck,
  Plus,
  Trash2,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Search,
  PackagePlus,
  Sparkles,
} from 'lucide-react';
import { Product, Supplier } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';
import { api } from '../services/api.js';

interface PurchaseItemInput {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  purchaseRate: number;
  gstRate: number;
}

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchaseData: any) => Promise<void>;
  suppliers: Supplier[];
  products: Product[];
}

export function AddPurchaseModal({
  isOpen,
  onClose,
  onSave,
  suppliers,
  products: initialProducts,
}: AddPurchaseModalProps) {
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts);
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<PurchaseItemInput[]>([]);

  // Search & Textbox State for Product Field
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Quick Add New Product Sub-Modal State
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    sku: '',
    category: 'Car Batteries',
    brand: 'Exide',
    purchasePrice: 0,
    sellingPrice: 0,
    gstRate: 18,
    unit: 'Nos',
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (isOpen) {
      setSupplierId(suppliers[0]?.id || '');
      setBillNumber(`PUR-${Math.floor(10000 + Math.random() * 90000)}`);
      setBillDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Bank Transfer');
      setPaidAmount(0);
      setNotes('');
      setError(null);
      setProductSearchQuery('');

      if (initialProducts.length > 0) {
        const firstProd = initialProducts[0];
        setItems([
          {
            productId: firstProd.id,
            productName: firstProd.name,
            sku: firstProd.sku,
            unit: firstProd.unit || 'Nos',
            quantity: 10,
            purchaseRate: firstProd.purchasePrice || 0,
            gstRate: firstProd.gstRate || 18,
          },
        ]);
      } else {
        setItems([]);
      }
    }
  }, [isOpen, suppliers, initialProducts]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Filter products by search text
  const filteredProducts = localProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(productSearchQuery.toLowerCase()))
  );

  const handleSelectProduct = (prod: Product) => {
    setProductSearchQuery('');
    setIsDropdownOpen(false);

    // Check if already in items list
    const existingIndex = items.findIndex((i) => i.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit || 'Nos',
          quantity: 5,
          purchaseRate: prod.purchasePrice || 0,
          gstRate: prod.gstRate || 18,
        },
      ]);
    }
  };

  const handleOpenQuickAdd = () => {
    const suggestedSku = `BAT-${Math.floor(1000 + Math.random() * 9000)}`;
    setNewProductForm({
      name: productSearchQuery.trim() || '',
      sku: suggestedSku,
      category: 'Car Batteries',
      brand: 'Exide',
      purchasePrice: 0,
      sellingPrice: 0,
      gstRate: 18,
      unit: 'Nos',
    });
    setShowQuickAddProduct(true);
    setIsDropdownOpen(false);
  };

  const handleSaveNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name.trim() || !newProductForm.sku.trim()) {
      alert('Product Name and SKU are required.');
      return;
    }

    try {
      setCreatingProduct(true);
      const created = await api.createProduct({
        name: newProductForm.name.trim(),
        sku: newProductForm.sku.trim().toUpperCase(),
        category: newProductForm.category,
        brand: newProductForm.brand,
        purchasePrice: Number(newProductForm.purchasePrice) || 0,
        sellingPrice: Number(newProductForm.sellingPrice) || Math.round((newProductForm.purchasePrice || 0) * 1.2),
        mrp: Number(newProductForm.sellingPrice) || Math.round((newProductForm.purchasePrice || 0) * 1.2),
        gstRate: Number(newProductForm.gstRate) || 18,
        unit: newProductForm.unit || 'Nos',
        openingStock: 0,
        currentStock: 0,
        minStockLevel: 5,
        status: 'active',
      });

      // Update local catalog state
      setLocalProducts((prev) => [created, ...prev]);

      // Automatically add newly created product to purchase bill!
      handleSelectProduct(created);

      setShowQuickAddProduct(false);
      setProductSearchQuery('');
    } catch (err: any) {
      alert(err.message || 'Failed to create product.');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof PurchaseItemInput, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedItems = items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.purchaseRate) || 0;
    const gstRate = Number(item.gstRate) || 0;
    const taxable = qty * rate;
    const tax = (taxable * gstRate) / 100;
    const total = taxable + tax;
    return { ...item, taxable, tax, total };
  });

  const subtotal = calculatedItems.reduce((acc, i) => acc + i.taxable, 0);
  const taxTotal = calculatedItems.reduce((acc, i) => acc + i.tax, 0);
  const grandTotal = Math.round(subtotal + taxTotal);
  const balanceAmount = Math.max(0, grandTotal - paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a Supplier/Vendor.');
      return;
    }
    if (!billNumber.trim()) {
      setError('Vendor Bill / Invoice Number is required.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one purchased product item.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        supplierId,
        supplierName: selectedSupplier?.name || 'Vendor',
        billNumber: billNumber.trim(),
        billDate,
        items,
        subtotal,
        taxAmount: taxTotal,
        grandTotal,
        paidAmount,
        paymentMode,
        notes,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record purchase bill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">Add Purchased Stock &amp; Vendor Invoice</h3>
              <p className="text-[11px] text-slate-400">
                Record inward stock from supplier &amp; auto-connect products to sales invoice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier & Bill Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier / Vendor <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option value="">-- Select Vendor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.gstin ? `(${s.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor Bill / Invoice # <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value.toUpperCase())}
                placeholder="e.g. EXD-INV-9982"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bill Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Product Selection Text Box & Search / Quick Add Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <span>Search Product or Create New Product</span>
              </label>
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ✓ Products added here will connect to Sales Invoice dropdown
              </span>
            </div>

            <div className="relative flex items-center gap-2" ref={searchBoxRef}>
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  placeholder="Type product name, SKU or brand to search & add..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                />

                {/* Search Autocomplete & Quick Add Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    <button
                      type="button"
                      onClick={handleOpenQuickAdd}
                      className="w-full px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <PackagePlus className="w-4 h-4 text-amber-600" />
                        <span>
                          + Add New Product "{productSearchQuery || 'Form'}" to Catalog
                        </span>
                      </span>
                      <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full uppercase font-mono">
                        Quick Add Form
                      </span>
                    </button>

                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        No product matches "{productSearchQuery}". Click above to add it!
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              SKU: {p.sku} | Brand: {p.brand || 'General'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold text-slate-800">
                              Cost: {formatINR(p.purchasePrice)}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Stock: {p.currentStock} {p.unit}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenQuickAdd}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product Form</span>
              </button>
            </div>
          </div>

          {/* Quick Add Product Form Modal / Card */}
          {showQuickAddProduct && (
            <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-700 space-y-3 animate-in fade-in duration-200 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                    Quick Product Form (Will connect to Invoice Select Product)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAddProduct(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-300 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    placeholder="e.g. Exide Gold 12V 65Ah Battery"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value.toUpperCase() })}
                    placeholder="e.g. BAT-65A"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Unit</label>
                  <select
                    value={newProductForm.unit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Sets">Sets</option>
                    <option value="Litres">Litres</option>
                    <option value="Pcs">Pcs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.purchasePrice}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.sellingPrice}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, sellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">GST %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProductForm.gstRate}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, gstRate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Brand</label>
                  <input
                    type="text"
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    placeholder="e.g. Exide, Amaron"
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickAddProduct(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewProduct}
                  disabled={creatingProduct}
                  className="px-4 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow-xs"
                >
                  {creatingProduct ? 'Saving...' : 'Save Product & Add to Purchase'}
                </button>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-2.5">Product Name &amp; SKU</th>
                  <th className="p-2.5 text-center w-24">Qty Inward</th>
                  <th className="p-2.5 text-right w-28">Purchase Rate (₹)</th>
                  <th className="p-2.5 text-center w-20">GST %</th>
                  <th className="p-2.5 text-right w-28">Taxable Amt</th>
                  <th className="p-2.5 text-right w-28">Total (Inc. GST)</th>
                  <th className="p-2.5 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No items added to this purchase bill yet. Use the product text box above.
                    </td>
                  </tr>
                ) : (
                  calculatedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 font-medium text-slate-900">
                        <div className="font-bold text-xs">{item.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {item.sku}</div>
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-300 rounded font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-500">{item.unit}</span>
                        </div>
                      </td>

                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.purchaseRate}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'purchaseRate', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-xs text-right border border-slate-300 rounded font-mono"
                        />
                      </td>

                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.gstRate}
                          onChange={(e) =>
                            handleUpdateItem(idx, 'gstRate', parseFloat(e.target.value) || 0)
                          }
                          className="w-14 px-1.5 py-1 text-xs text-center border border-slate-300 rounded font-mono"
                        />
                      </td>

                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {formatINR(item.taxable)}
                      </td>

                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatINR(item.total)}
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Remove line item"
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

          {/* Bottom Summary & Payment Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Purchase Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Batch stock delivery, freight charges included..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="Credit">Vendor Credit Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount Paid Now (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Totals Card */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs shadow-md">
              <div className="flex justify-between text-slate-300">
                <span>Taxable Subtotal:</span>
                <span className="font-mono">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>GST Tax Total:</span>
                <span className="font-mono">{formatINR(taxTotal)}</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-sm text-amber-400">
                <span>Grand Total:</span>
                <span className="font-mono text-base">{formatINR(grandTotal)}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 block">Paid Amount:</span>
                  <span className="font-bold text-emerald-400 font-mono text-xs">{formatINR(paidAmount)}</span>
                </div>
                <div className="bg-slate-800 p-2 rounded-lg">
                  <span className="text-slate-400 block">Balance Payable:</span>
                  <span className="font-bold text-rose-400 font-mono text-xs">{formatINR(balanceAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Processing Purchase...' : 'Save Purchase & Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
