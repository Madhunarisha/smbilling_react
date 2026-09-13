import React, { useState, useEffect } from 'react';
import { X, Boxes, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Product } from '../types/index.js';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProduct?: Product | null;
  onSave: (data: {
    productId: string;
    type: string;
    quantity: number;
    remarks?: string;
    referenceNo?: string;
  }) => Promise<void>;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  products,
  selectedProduct,
  onSave,
}: StockAdjustmentModalProps) {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('adjustment');
  const [quantity, setQuantity] = useState(1);
  const [isAddition, setIsAddition] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProduct) {
      setProductId(selectedProduct.id);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [selectedProduct, products]);

  if (!isOpen) return null;

  const currentProd = products.find((p) => p.id === productId);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === 'purchase' || newType === 'customer_return') {
      setIsAddition(true);
    } else if (newType === 'damaged' || newType === 'supplier_return') {
      setIsAddition(false);
    }
  };

  const finalQty = isAddition ? Math.abs(quantity) : -Math.abs(quantity);
  const projectedStock = currentProd ? currentProd.currentStock + finalQty : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a product.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (projectedStock < 0) {
      setError(`Adjustment cannot reduce stock below zero. Current stock is ${currentProd?.currentStock}.`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        productId,
        type,
        quantity: finalQty,
        remarks,
        referenceNo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Record Stock Movement / Adjustment</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Current Stock: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Movement Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
            >
              <option value="adjustment">Physical Stock Adjustment / Audit (+ / -)</option>
              <option value="purchase">Stock Purchase / Consignment Inflow (+)</option>
              <option value="damaged">Damaged / Expired Battery Scrap (-)</option>
              <option value="customer_return">Customer Return (+)</option>
              <option value="supplier_return">Supplier Return / Defect Dispatch (-)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
                <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddition(true)}
                    className={`px-2.5 py-1.5 text-xs font-bold ${
                      isAddition ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddition(false)}
                    className={`px-2.5 py-1.5 text-xs font-bold ${
                      !isAddition ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    -
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ref No. / Bill / Challan</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. BILL-4412"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Reason</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Monthly godown physical audit count"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Projection badge */}
          {currentProd && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500">Current Stock:</span>{' '}
                <strong className="text-slate-800">{currentProd.currentStock} {currentProd.unit}</strong>
              </div>
              <div className="flex items-center gap-1 font-semibold">
                <span>Updated Stock:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                    projectedStock <= currentProd.minStockLevel
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {projectedStock} {currentProd.unit}
                </span>
              </div>
            </div>
          )}

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
              {saving ? 'Recording...' : 'Record Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
