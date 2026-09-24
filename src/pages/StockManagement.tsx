import React, { useState, useEffect } from 'react';
import {
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, StockTransaction, Supplier } from '../types/index.js';
import { formatDate, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal.js';
import { AddPurchaseModal } from '../components/AddPurchaseModal.js';

export function StockManagement() {
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, sups, txs] = await Promise.all([
        api.getProducts(),
        api.getSuppliers().catch(() => []),
        api.getStockHistory({
          productId: selectedProductId || undefined,
          type: selectedType === 'all' ? undefined : selectedType,
        }),
      ]);
      setProducts(prods);
      setSuppliers(sups);
      setTransactions(txs);
    } catch (err: any) {
      showToast(err.message || 'Failed to load stock movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType, selectedProductId]);

  const handleRecordStock = async (data: {
    productId: string;
    type: string;
    quantity: number;
    remarks?: string;
    referenceNo?: string;
  }) => {
    const result = await api.adjustStock(data);
    showToast(`Stock updated for ${result.product.name}`, 'success');
    loadData();
  };

  const handleSavePurchase = async (purchaseData: any) => {
    await api.createPurchase(purchaseData);
    showToast(`Purchase bill ${purchaseData.billNumber} recorded & stock inwarded!`, 'success');
    loadData();
  };

  const lowStockProducts = products.filter((p) => p.currentStock <= (p.minStockLevel || 5));

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Stock Management &amp; Movements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit movements, track battery inflow/outflow, and manage inward purchased stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Stock Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Purchased Stock</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetProduct(null);
              setIsStockModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Audit / Adjust</span>
          </button>
        </div>
      </div>

      {/* Low Stock Warning Section */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Critical Replenishment Alert ({lowStockProducts.length} Items)</span>
            </h3>
            <span className="text-xs text-red-600 font-semibold">Immediate action recommended</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-red-50/50 border border-red-200 rounded-xl flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{p.name}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {p.sku} • Min Level: {p.minStockLevel} {p.unit}
                  </p>
                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded mt-1 inline-block">
                    Only {p.currentStock} {p.unit} remaining
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetProduct(p);
                    setIsStockModalOpen(true);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs shrink-0 cursor-pointer"
                >
                  Refill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">-- All Products &amp; Batteries --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        {/* Movement Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'purchase', label: 'Inward Purchases' },
            { id: 'sale', label: 'Outward Sales' },
            { id: 'adjustment', label: 'Physical Audits' },
            { id: 'damaged', label: 'Damaged Scrap' },
            { id: 'customer_return', label: 'Customer Returns' },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                selectedType === type.id
                  ? 'bg-slate-900 text-amber-400 font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Date &amp; Time</th>
                <th className="p-3">Product Name &amp; SKU</th>
                <th className="p-3">Movement Type</th>
                <th className="p-3 text-center">Qty Change</th>
                <th className="p-3 text-center">Prev Stock</th>
                <th className="p-3 text-center">New Stock</th>
                <th className="p-3">Ref No. / Invoice</th>
                <th className="p-3">Remarks / Reason</th>
                <th className="p-3 text-right">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading stock movements ledger...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No stock movements recorded for selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.quantity > 0;

                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (tx.type === 'purchase') badgeColor = 'bg-blue-100 text-blue-800';
                  else if (tx.type === 'sale') badgeColor = 'bg-purple-100 text-purple-800';
                  else if (tx.type === 'damaged') badgeColor = 'bg-rose-100 text-rose-800';
                  else if (tx.type === 'customer_return') badgeColor = 'bg-emerald-100 text-emerald-800';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(tx.date)}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{tx.productName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {tx.sku}</div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded capitalize ${badgeColor}`}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded ${
                            isPositive
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-rose-700 bg-rose-50'
                          }`}
                        >
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isPositive ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </td>

                      <td className="p-3 text-center font-mono text-slate-600">{tx.previousStock}</td>

                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {tx.newStock}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {tx.referenceNo || '—'}
                      </td>

                      <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate">
                        {tx.remarks || '—'}
                      </td>

                      <td className="p-3 text-right font-medium text-slate-700 text-[11px]">
                        {tx.createdBy || 'Staff'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          setTargetProduct(null);
        }}
        products={products}
        selectedProduct={targetProduct}
        onSave={handleRecordStock}
      />

      {/* Inward Purchased Stock Modal */}
      <AddPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSave={handleSavePurchase}
        suppliers={suppliers}
        products={products}
      />
    </div>
  );
}
