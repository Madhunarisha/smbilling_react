import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { ReturnRecord, Product, Customer } from '../types/index.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

export function ReturnsPage() {
  const { showToast } = useToast();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for new return
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<'sales_return' | 'purchase_return'>('sales_return');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [refundAmount, setRefundAmount] = useState(0);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [reason, setReason] = useState('Dead on arrival / Cell weak');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rets, prods, custs] = await Promise.all([
        api.getReturns(),
        api.getProducts(),
        api.getCustomers(),
      ]);
      setReturns(rets);
      setProducts(prods);
      setCustomers(custs);

      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
        setRefundAmount(prods[0].sellingPrice);
      }
      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load returns data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setRefundAmount(prod.sellingPrice * quantity);
    }
  };

  const handleQuantityChange = (qty: number) => {
    const validQty = Math.max(1, qty);
    setQuantity(validQty);
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod) {
      setRefundAmount(prod.sellingPrice * validQty);
    }
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProductId);
    const cust = customers.find((c) => c.id === selectedCustomerId);

    if (!prod) {
      showToast('Please select a product', 'warning');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        type: returnType,
        originalInvoiceNumber: originalInvoiceNo || 'DIRECT-RET',
        customerId: cust?.id,
        customerName: cust?.name || 'Customer Return',
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity,
            rate: prod.sellingPrice,
            taxableAmount: refundAmount,
            gstAmount: 0,
            totalAmount: refundAmount,
          },
        ],
        refundAmount,
        reason,
        status: 'Approved',
      };

      const created = await api.createSalesReturn(payload);
      setReturns((prev) => [created, ...prev]);
      showToast(`Return processed! Stock quantity of ${prod.name} has been updated.`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to process return', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Returns &amp; Warranty Claims Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Process customer sales returns, warranty battery replacements and supplier claims
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Returns"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Process Return / Claim</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Return Records
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">{returns.length}</div>
          <span className="text-[11px] text-slate-500">Processed across inventory</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Refunds / Credits
          </span>
          <div className="text-xl font-black font-mono text-rose-600 mt-1">
            {formatINR(returns.reduce((acc, r) => acc + r.refundAmount, 0))}
          </div>
          <span className="text-[11px] text-rose-600 font-semibold">Credited to customers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Warranty Claim Rate
          </span>
          <div className="text-xl font-black font-mono text-emerald-700 mt-1">&lt; 0.8%</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Excellence quality index</span>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Return ID / Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Original Invoice</th>
                <th className="p-3">Customer / Party</th>
                <th className="p-3">Returned Items</th>
                <th className="p-3 text-right">Refund / Credit (₹)</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading returns records...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No returns logged. Click "Process Return / Claim" to record one.
                  </td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold font-mono text-slate-900">{ret.returnNumber}</div>
                      <div className="text-[11px] text-slate-500">{formatDate(ret.date)}</div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          ret.type === 'sales_return'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ret.type.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-3 font-mono font-medium text-slate-800">
                      {ret.originalInvoiceNumber}
                    </td>

                    <td className="p-3 font-semibold text-slate-800">
                      {ret.customerName || 'Walk-in'}
                    </td>

                    <td className="p-3">
                      {ret.items.map((item, idx) => (
                        <div key={idx} className="font-medium text-slate-800">
                          {item.productName} ({item.quantity} qty)
                        </div>
                      ))}
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(ret.refundAmount)}
                    </td>

                    <td className="p-3 text-slate-600 max-w-xs truncate">{ret.reason}</td>

                    <td className="p-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {ret.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for processing return */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Process Return / Credit Note</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReturn} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return Type</label>
                <select
                  value={returnType}
                  onChange={(e) => setReturnType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="sales_return">Customer Sales Return (Restores stock, issues refund)</option>
                  <option value="purchase_return">Supplier Return / Defect Dispatch (Removes stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Selling: {formatINR(p.sellingPrice)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Original Invoice No.</label>
                  <input
                    type="text"
                    value={originalInvoiceNo}
                    onChange={(e) => setOriginalInvoiceNo(e.target.value)}
                    placeholder="SMA-2026-1001"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Inspection Notes</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
