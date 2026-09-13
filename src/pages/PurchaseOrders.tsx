import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Truck,
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
  Calendar,
  Eye,
  Trash2,
} from 'lucide-react';
import { Supplier, Product } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { formatINR } from '../utils/formatters.js';

interface PurchaseOrderItem {
  id: string;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string;
  itemsCount: number;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  paymentStatus: 'Paid' | 'Pending';
}

interface PurchaseBillItem {
  id: string;
  billNumber: string;
  supplierName: string;
  billDate: string;
  itemsCount: number;
  totalTaxable: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
}

export function PurchaseOrders({ initialTab = 'orders' }: { initialTab?: 'orders' | 'purchases' | 'return' }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'orders' | 'purchases' | 'return'>(initialTab);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Purchase Orders Data
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([
    {
      id: 'po-101',
      poNumber: 'PO-2026-088',
      supplierName: 'Exide Industries Ltd - Regional Depot',
      orderDate: '2026-09-08',
      expectedDate: '2026-09-14',
      itemsCount: 20,
      totalAmount: 84000,
      status: 'Sent',
      paymentStatus: 'Pending',
    },
    {
      id: 'po-102',
      poNumber: 'PO-2026-089',
      supplierName: 'Amaron Batteries - Amara Raja Depot',
      orderDate: '2026-09-10',
      expectedDate: '2026-09-15',
      itemsCount: 15,
      totalAmount: 52000,
      status: 'Draft',
      paymentStatus: 'Pending',
    },
    {
      id: 'po-103',
      poNumber: 'PO-2026-085',
      supplierName: 'Castrol India Lubricants Distributor',
      orderDate: '2026-09-01',
      expectedDate: '2026-09-04',
      itemsCount: 50,
      totalAmount: 65000,
      status: 'Received',
      paymentStatus: 'Paid',
    },
  ]);

  // Purchases Inward Data
  const [purchases, setPurchases] = useState<PurchaseBillItem[]>([
    {
      id: 'pb-201',
      billNumber: 'EXD-INV-9921',
      supplierName: 'Exide Industries Ltd - Regional Depot',
      billDate: '2026-09-05',
      itemsCount: 25,
      totalTaxable: 75000,
      taxAmount: 21000,
      grandTotal: 96000,
      paidAmount: 61000,
      status: 'Partial',
    },
    {
      id: 'pb-202',
      billNumber: 'AMR-DL-5541',
      supplierName: 'Amaron Batteries - Amara Raja Depot',
      billDate: '2026-09-02',
      itemsCount: 18,
      totalTaxable: 45000,
      taxAmount: 12600,
      grandTotal: 57600,
      paidAmount: 57600,
      status: 'Paid',
    },
    {
      id: 'pb-203',
      billNumber: 'CST-LUB-8812',
      supplierName: 'Castrol India Lubricants Distributor',
      billDate: '2026-08-28',
      itemsCount: 40,
      totalTaxable: 52000,
      taxAmount: 9360,
      grandTotal: 61360,
      paidAmount: 61360,
      status: 'Paid',
    },
  ]);

  // Purchase Returns Data
  const [returns, setReturns] = useState([
    {
      id: 'pr-1',
      returnNumber: 'PR-2026-012',
      supplierName: 'Exide Industries Ltd - Regional Depot',
      date: '2026-09-06',
      items: 'Exide MLDIN45L (2 Units - Dead cell DOA)',
      totalAmount: 8400,
      reason: 'Factory Defect / Dead on Arrival',
      status: 'Approved & Adjusted',
    },
    {
      id: 'pr-2',
      returnNumber: 'PR-2026-011',
      supplierName: 'Amaron Batteries - Amara Raja Depot',
      date: '2026-08-20',
      items: 'Amaron Pro Bike 5Ah (1 Unit - Terminal Crack)',
      totalAmount: 1200,
      reason: 'Transit Damage',
      status: 'Credit Note Issued',
    },
  ]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [sups, prods] = await Promise.all([api.getSuppliers(), api.getProducts()]);
        setSuppliers(sups);
        setProducts(prods);
      } catch {
        // quiet
      }
    }
    loadMetadata();
  }, []);

  const handleMarkReceived = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'Received' } : o))
    );
    showToast('PO marked as Received into warehouse inventory!', 'success');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-red-600" />
            <span>Purchases &amp; Vendor Supply Management</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Purchase Orders, Vendor Tax Bills &amp; Supplier Warranty Returns
          </p>
        </div>

        {/* Tab Navigation Matching Sidebar Workflow */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'purchases'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchases (Bills)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('return')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'return'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Return
          </button>
        </div>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO number or vendor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() => showToast('New Purchase Order creator ready', 'info')}
              className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-3">Supplier / Vendor</th>
                  <th className="py-3 px-3">Order Date</th>
                  <th className="py-3 px-3">Expected Delivery</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Total Value</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      {po.poNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {po.supplierName}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{po.orderDate}</td>
                    <td className="py-3 px-3 text-slate-600">{po.expectedDate}</td>
                    <td className="py-3 px-3 font-mono">{po.itemsCount} Units</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {formatINR(po.totalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          po.status === 'Received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : po.status === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {po.status !== 'Received' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkReceived(po.id)}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer"
                        >
                          Receive Goods
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASES (BILLS) */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Vendor Bill #</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Bill Date</th>
                  <th className="py-3 px-3">Taxable</th>
                  <th className="py-3 px-3">GST (Tax)</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Paid Amount</th>
                  <th className="py-3 px-3">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pb) => (
                  <tr key={pb.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {pb.billNumber}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{pb.supplierName}</td>
                    <td className="py-3 px-3 text-slate-600">{pb.billDate}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{formatINR(pb.totalTaxable)}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{formatINR(pb.taxAmount)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{formatINR(pb.grandTotal)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">{formatINR(pb.paidAmount)}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pb.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pb.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PURCHASE RETURN */}
      {activeTab === 'return' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Return Reference #</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Returned Battery Items</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-red-600">{pr.returnNumber}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{pr.supplierName}</td>
                    <td className="py-3 px-3 text-slate-600">{pr.date}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{pr.items}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{formatINR(pr.totalAmount)}</td>
                    <td className="py-3 px-3 text-slate-600">{pr.reason}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {pr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
