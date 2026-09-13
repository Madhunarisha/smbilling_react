import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Invoice, Product, Customer } from '../types/index.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

export function ReportsPage() {
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [invs, prods, custs] = await Promise.all([
        api.getInvoices(),
        api.getProducts(),
        api.getCustomers(),
      ]);
      setInvoices(invs);
      setProducts(prods);
      setCustomers(custs);
    } catch (err: any) {
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter invoices by time
  const now = new Date();
  const filteredInvoices = invoices.filter((inv) => {
    if (timeFilter === 'all') return true;
    const d = new Date(inv.date);
    if (timeFilter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }
    if (timeFilter === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // Calculate Metrics
  const totalSales = filteredInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const totalTaxable = filteredInvoices.reduce((acc, inv) => acc + inv.taxableAmount, 0);
  const totalCgst = filteredInvoices.reduce((acc, inv) => acc + inv.cgstTotal, 0);
  const totalSgst = filteredInvoices.reduce((acc, inv) => acc + inv.sgstTotal, 0);
  const totalIgst = filteredInvoices.reduce((acc, inv) => acc + inv.igstTotal, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const totalPaid = filteredInvoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
  const totalUnpaid = filteredInvoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);

  // Inventory Metrics
  const totalStockQty = products.reduce((acc, p) => acc + p.currentStock, 0);
  const totalInventoryValuation = products.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const totalRetailValuation = products.reduce((acc, p) => acc + p.currentStock * p.sellingPrice, 0);
  const potentialGrossProfit = totalRetailValuation - totalInventoryValuation;

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Date',
      'Customer Name',
      'Phone',
      'Payment Mode',
      'Payment Status',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
      'Grand Total',
      'Paid Amount',
      'Balance Due',
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      formatDate(inv.date),
      `"${inv.customerName}"`,
      inv.customerPhone || '',
      inv.paymentMode,
      inv.paymentStatus,
      inv.taxableAmount.toFixed(2),
      inv.cgstTotal.toFixed(2),
      inv.sgstTotal.toFixed(2),
      inv.igstTotal.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.paidAmount.toFixed(2),
      inv.balanceAmount.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SM_Autos_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sales Report downloaded as CSV!', 'success');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Business &amp; GST Compliance Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed sales reports, GST tax summaries, and inventory valuation analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit print:hidden">
        {[
          { id: 'today', label: "Today's Operations" },
          { id: 'week', label: 'Last 7 Days' },
          { id: 'month', label: 'This Month' },
          { id: 'all', label: 'All Time' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTimeFilter(t.id as any)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              timeFilter === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sales & Financial Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Gross Total Sales
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">
            {formatINR(totalSales)}
          </div>
          <span className="text-[11px] text-slate-500">{filteredInvoices.length} total invoices</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Net Taxable Value
          </span>
          <div className="text-xl font-black font-mono text-slate-800 mt-1">
            {formatINR(totalTaxable)}
          </div>
          <span className="text-[11px] text-slate-500">Excluding GST</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            GST Tax Collected
          </span>
          <div className="text-xl font-black font-mono text-indigo-700 mt-1">
            {formatINR(totalTax)}
          </div>
          <span className="text-[11px] text-indigo-600 font-semibold">Payable to Gov</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Cash / Digital Collected
          </span>
          <div className="text-xl font-black font-mono text-emerald-700 mt-1">
            {formatINR(totalPaid)}
          </div>
          <span className="text-[11px] text-rose-600 font-semibold">
            {formatINR(totalUnpaid)} pending
          </span>
        </div>
      </div>

      {/* GST Tax Filing Breakdown Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center justify-between">
          <span>GST Tax Breakdown (GSTR-1 &amp; 3B Readiness)</span>
          <span className="text-xs font-mono font-semibold text-indigo-700">
            Total Tax: {formatINR(totalTax)}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Central GST (CGST)</span>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatINR(totalCgst)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Intra-State Central component</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">State GST (SGST)</span>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatINR(totalSgst)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Intra-State Delhi State component</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Integrated GST (IGST)</span>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatINR(totalIgst)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Inter-State supplies</p>
          </div>
        </div>
      </div>

      {/* Inventory Valuation & Health Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Stock &amp; Inventory Asset Valuation</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Valuation at Cost</span>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatINR(totalInventoryValuation)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{totalStockQty} items in godown</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">Valuation at Selling Price</span>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatINR(totalRetailValuation)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Expected retail turnover</p>
          </div>

          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 uppercase">Projected Gross Margin</span>
            <div className="text-lg font-black font-mono text-emerald-800 mt-1">
              {formatINR(potentialGrossProfit)}
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5">Potential unrealized margin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
