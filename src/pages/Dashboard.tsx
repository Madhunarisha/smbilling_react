import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  FileText,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Printer,
  Share2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Boxes,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.js';
import { DashboardStats, Invoice, Product } from '../types/index.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { ActivePage } from '../components/Sidebar.js';

interface DashboardProps {
  onNavigate: (page: ActivePage) => void;
  onOpenPrintModal: (inv: Invoice) => void;
  onOpenWhatsAppModal: (inv: Invoice) => void;
  onOpenStockModal: (prod?: Product) => void;
}

export function Dashboard({
  onNavigate,
  onOpenPrintModal,
  onOpenWhatsAppModal,
  onOpenStockModal,
}: DashboardProps) {
  const { showToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setStats(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500">Loading live business analytics...</p>
        </div>
      </div>
    );
  }

  const salesTrend = stats?.salesTrend || [];
  const maxSales = Math.max(...salesTrend.map((t) => t.sales), 10000);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Direct Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Business Dashboard &amp; Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time operations summary for <span className="font-semibold text-blue-700">SM Autos &amp; Batteries</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchStats}
            title="Refresh Data"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Direct Link: Add Invoice Button */}
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-950/20 transition-all border border-red-500/40"
            title="Direct link to add a new GST sales invoice"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add New Invoice (POS)</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenStockModal()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
          >
            <Boxes className="w-4 h-4 text-blue-100" />
            <span>Stock Inward</span>
          </button>
        </div>
      </div>

      {/* Prominent Direct Quick Action Card: Add Invoice & Counter Billing */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-slate-950 rounded-2xl p-5 text-white border border-blue-800/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white tracking-wider shadow-xs">
              ⚡ FAST BILLING COUNTER
            </span>
            <span className="text-xs text-blue-300 font-medium">Quick GST Invoice Generation</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Ready to bill a customer or garage?
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Jump directly into the high-speed POS billing counter. Support for barcode scanning, scrap battery exchange deductions, 1-click WhatsApp bills, and GST tax invoice printing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('billing')}
            className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-red-950/40 flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-red-400/40"
            title="Click to open the POS billing counter"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Invoice Now</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className="px-4 py-3 rounded-xl bg-blue-800/80 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-colors border border-blue-500/40"
          >
            <FileText className="w-4 h-4" />
            <span>View All Invoices</span>
          </button>
        </div>

        {/* Decorative subtle accent shape in background */}
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
      </div>

      {/* Critical Alerts Banner (if any low stock or overdue) */}
      {stats && stats.lowStockItems > 0 && (
        <div className="bg-red-50 border border-red-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-950">
                Action Required: {stats.lowStockItems} Products Below Reorder Level
              </h4>
              <p className="text-xs text-red-800/90 mt-0.5">
                Fast-moving batteries and lubricants are running low. Refill stock to prevent billing counter stockouts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors shadow-xs"
          >
            View Low Stock List
          </button>
        </div>
      )}

      {/* Primary KPI Grid (10 Core Metrics with Red & Blue theme) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Today's Sales</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-blue-900">
            {formatINR(stats?.todaySales)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats?.todayInvoicesCount} invoices generated today
          </p>
        </div>

        {/* Today's Purchases */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Today Purchases</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {formatINR(stats?.todayPurchases)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Supplier inward stock</p>
        </div>

        {/* Estimated Profit Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Today's Profit</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700">
            {formatINR(stats?.todayProfit)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Gross sales minus cost</p>
        </div>

        {/* Total Outstanding Receivables (From Customers) */}
        <div
          onClick={() => onNavigate('ledgers')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-red-400 cursor-pointer transition-colors"
          title="Click to view Customer Khata Ledgers"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Customer Dues</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600 font-bold">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-red-600">
            {formatINR(stats?.totalOutstandingReceivable)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">To collect from customers • View Khata →</p>
        </div>

        {/* Total Payables (To Suppliers) */}
        <div
          onClick={() => onNavigate('ledgers')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 cursor-pointer transition-colors"
          title="Click to view Supplier Payables Ledgers"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Supplier Dues</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-blue-700">
            {formatINR(stats?.totalPayableToSuppliers)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pending vendor bills • View Ledger →</p>
        </div>

        {/* Total Stock Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Inventory Value</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {formatINR(stats?.totalInventoryValue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Based on purchase cost</p>
        </div>

        {/* Total Active Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Active SKUs</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {stats?.totalProducts}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all categories</p>
        </div>

        {/* Low Stock Items */}
        <div
          onClick={() => onNavigate('stock')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Low Stock Items</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-amber-600">
            {stats?.lowStockItems}
          </div>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1">Click to inspect →</p>
        </div>

        {/* Out of Stock Items */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-rose-400 transition-colors">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Out of Stock</span>
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-700">
            {stats?.outOfStockItems}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Zero inventory available</p>
        </div>

        {/* Total Invoices Count */}
        <div
          onClick={() => onNavigate('invoices')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-400 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>All Invoices</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900">
            {stats?.totalInvoices}
          </div>
          <p className="text-[11px] text-indigo-600 font-semibold mt-1">View history →</p>
        </div>
      </div>

      {/* Analytical Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Sales & Profit Bar Graph */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">7-Day Sales &amp; Revenue Trends</h3>
              <p className="text-xs text-slate-500">Daily billing totals and gross performance</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span>
                <span className="text-slate-600 font-semibold">Sales</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-600 inline-block"></span>
                <span className="text-slate-600 font-semibold">Profit</span>
              </span>
            </div>
          </div>

          <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-2 border-b border-slate-100">
            {salesTrend.map((day) => {
              const salesHeight = Math.max(8, (day.sales / maxSales) * 100);
              const profitHeight = Math.max(4, (day.profit / maxSales) * 100);

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full">
                    {/* Sales bar (Blue) */}
                    <div
                      style={{ height: `${salesHeight}%` }}
                      className="w-full max-w-[22px] bg-blue-600 hover:bg-blue-500 rounded-t transition-all relative group/bar shadow-xs"
                    >
                      <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                        Sales: {formatINR(day.sales)}
                      </div>
                    </div>
                    {/* Profit bar (Red) */}
                    <div
                      style={{ height: `${profitHeight}%` }}
                      className="w-full max-w-[22px] bg-red-600 hover:bg-red-500 rounded-t transition-all relative group/bar shadow-xs"
                    >
                      <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                        Profit: {formatINR(day.profit)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600 truncate mt-1">{day.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Top Selling Parts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <h3 className="font-bold text-sm text-slate-900">Top Selling Products</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Fastest moving spare parts and battery units</p>

            <div className="space-y-3">
              {stats?.topProducts && stats.topProducts.length > 0 ? (
                stats.topProducts.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800 line-clamp-1">{p.productName}</span>
                      <span className="font-mono text-slate-600 shrink-0 ml-2 font-medium">
                        {p.quantitySold} sold • {formatINR(p.revenue)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-red-600 rounded-full"
                        style={{
                          width: `${Math.min(100, (p.quantitySold / (stats.topProducts[0]?.quantitySold || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">No sale records available</div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="w-full mt-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-center border border-blue-200"
          >
            Full Product Sales Report →
          </button>
        </div>
      </div>

      {/* Two Column Section: Low Stock Table & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Low Stock Alert List
              </h3>
              <p className="text-xs text-slate-500">Items nearing or below minimum replenishment limit</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Manage Stock
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="pb-2">Part Name / Brand</th>
                  <th className="pb-2 text-center">Stock</th>
                  <th className="pb-2 text-center">Min Level</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.lowStockList && stats.lowStockList.length > 0 ? (
                  stats.lowStockList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.brand} • SKU: {item.sku}
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="font-bold font-mono text-red-600 px-2 py-0.5 rounded bg-red-50 border border-red-200">
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-mono text-slate-600">{item.minStockLevel}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenStockModal(item)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs transition-colors"
                        >
                          + Refill
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      All products have adequate inventory!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Recent Invoices &amp; Bills
              </h3>
              <p className="text-xs text-slate-500">Latest customer transactions from billing counter</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              View All ({stats?.totalInvoices})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="pb-2">Invoice / Date</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                  stats.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2.5">
                        <div className="font-bold font-mono text-slate-900">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-500">{formatDate(inv.date)}</div>
                      </td>
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-800 line-clamp-1">{inv.customerName}</div>
                        <div className="text-[10px] text-slate-500">{inv.paymentMode}</div>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatINR(inv.grandTotal)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.paymentStatus === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenPrintModal(inv)}
                            title="Print GST Invoice"
                            className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenWhatsAppModal(inv)}
                            title="Share on WhatsApp"
                            className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
