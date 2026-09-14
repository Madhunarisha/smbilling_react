import React, { useState, useEffect } from 'react';
import { X, PackagePlus, Sparkles, AlertCircle } from 'lucide-react';
import { Product, Category, Supplier } from '../types/index.js';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  product?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
}

export function ProductModal({
  isOpen,
  onClose,
  onSave,
  product,
  categories,
  suppliers,
}: ProductModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Car Batteries',
    brand: '',
    modelNumber: '',
    barcode: '',
    description: '',
    purchasePrice: 0,
    sellingPrice: 0,
    mrp: 0,
    gstRate: 18,
    discountPercent: 0,
    openingStock: 10,
    minStockLevel: 5,
    unit: 'Nos',
    supplierId: '',
    supplierName: '',
    warrantyPeriod: '12 Months',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomGst, setIsCustomGst] = useState(false);

  useEffect(() => {
    if (product) {
      const currentGst = product.gstRate !== undefined ? product.gstRate : 18;
      setIsCustomGst(currentGst !== 18 && currentGst !== 5);
      setFormData({
        sku: product.sku || '',
        name: product.name || '',
        category: product.category || categories[0]?.name || 'Car Batteries',
        brand: product.brand || '',
        modelNumber: product.modelNumber || '',
        barcode: product.barcode || '',
        description: product.description || '',
        purchasePrice: product.purchasePrice || 0,
        sellingPrice: product.sellingPrice || 0,
        mrp: product.mrp || 0,
        gstRate: product.gstRate !== undefined ? product.gstRate : 18,
        discountPercent: product.discountPercent || 0,
        openingStock: product.openingStock || 0,
        minStockLevel: product.minStockLevel || 5,
        unit: product.unit || 'Nos',
        supplierId: product.supplierId || '',
        supplierName: product.supplierName || '',
        warrantyPeriod: product.warrantyPeriod || '12 Months',
      });
    } else {
      setFormData({
        sku: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
        name: '',
        category: categories[0]?.name || 'Car Batteries',
        brand: '',
        modelNumber: '',
        barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        description: '',
        purchasePrice: 0,
        sellingPrice: 0,
        mrp: 0,
        gstRate: 18,
        discountPercent: 0,
        openingStock: 10,
        minStockLevel: 5,
        unit: 'Nos',
        supplierId: suppliers[0]?.id || '',
        supplierName: suppliers[0]?.name || '',
        warrantyPeriod: '12 Months',
      });
      setIsCustomGst(false);
    }
    setError(null);
  }, [product, isOpen, categories, suppliers]);

  if (!isOpen) return null;

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const sup = suppliers.find((s) => s.id === sId);
    setFormData((prev) => ({
      ...prev,
      supplierId: sId,
      supplierName: sup?.name || '',
    }));
  };

  const marginAmount = formData.sellingPrice - formData.purchasePrice;
  const marginPercent =
    formData.purchasePrice > 0 ? ((marginAmount / formData.purchasePrice) * 100).toFixed(1) : '0.0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      setError('Product Name and SKU are required.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-6">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PackagePlus className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">
              {product ? 'Edit Product & Inventory' : 'Add New Automotive Product'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Exide Mileage MLDIN45L Car Battery"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SKU / Part Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. BAT-EX-45L"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
              <input
                type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g. Exide, Amaron, Castrol, Bosch"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Model / Part No.</label>
              <input
                type="text"
                value={formData.modelNumber}
                onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                placeholder="e.g. MLDIN45L"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="8901234..."
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Period</label>
              <input
                type="text"
                value={formData.warrantyPeriod}
                onChange={(e) => setFormData({ ...formData, warrantyPeriod: e.target.value })}
                placeholder="e.g. 55 Months, 24 Months, N/A"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Pricing & GST */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Pricing &amp; GST Rates
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">GST Rate (%)</label>
                {!isCustomGst ? (
                  <select
                    value={formData.gstRate === 18 || formData.gstRate === 5 ? formData.gstRate : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomGst(true);
                      } else {
                        setFormData({ ...formData, gstRate: parseInt(e.target.value, 10) });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white font-semibold"
                  >
                    <option value={18}>18% (Batteries &amp; Spares)</option>
                    <option value={5}>5% (Specialized Parts)</option>
                    <option value="custom">Custom Dynamic Rate...</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.gstRate}
                        onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) || 0 })}
                        placeholder="Dynamic %"
                        className="w-full px-2.5 py-2 text-sm border border-amber-400 bg-amber-50/50 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-900"
                        autoFocus
                      />
                      <span className="absolute right-2.5 top-2 text-xs font-bold text-amber-700">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomGst(false);
                        setFormData({ ...formData, gstRate: 18 });
                      }}
                      title="Back to standard presets"
                      className="px-2 py-2 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
                    >
                      Presets
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Live Profit Margin Bar */}
            <div className="mt-2.5 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between text-slate-700">
              <span>
                Estimated Margin:{' '}
                <strong className={marginAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  ₹{marginAmount} ({marginPercent}%)
                </strong>
              </span>
              <span className="text-slate-500 text-[11px]">
                Intra-State Tax: {formData.gstRate / 2}% CGST + {formData.gstRate / 2}% SGST
              </span>
            </div>
          </div>

          {/* Stock & Supplier */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Stock &amp; Supplier Information
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {!product && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Stock Alert Level</label>
                <input
                  type="number"
                  min="1"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="Nos">Nos</option>
                  <option value="Sets">Sets</option>
                  <option value="Litres">Litres</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Pairs">Pairs</option>
                  <option value="Boxes">Boxes</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Primary Supplier</label>
                <select
                  value={formData.supplierId}
                  onChange={handleSupplierChange}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : product ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
