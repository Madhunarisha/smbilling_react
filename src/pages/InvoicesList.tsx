import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  FileText,
  Printer,
  Share2,
  DollarSign,
  Trash2,
  Calendar,
  CreditCard,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Invoice } from '../types/index.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { PaymentModal } from '../components/PaymentModal.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

interface InvoicesListProps {
  onOpenPrintModal: (inv: Invoice) => void;
  onOpenWhatsAppModal: (inv: Invoice) => void;
  onNavigateToBilling: () => void;
}

export function InvoicesList({
  onOpenPrintModal,
  onOpenWhatsAppModal,
  onNavigateToBilling,
}: InvoicesListProps) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices({
        q: searchQuery,
        status: statusFilter,
      });
      setInvoices(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      await api.deleteInvoice(invoiceToDelete.id);
      showToast(`Invoice ${invoiceToDelete.invoiceNumber} deleted and stock restored`, 'success');
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceToDelete.id));
    } catch (err: any) {
      showToast(err.message || 'Failed to delete invoice', 'error');
    } finally {
      setInvoiceToDelete(null);
    }
  };

  const handleRecordPayment = async (
    invoiceId: string,
    paymentData: { amount: number; paymentMode: string; transactionRef?: string; notes?: string }
  ) => {
    const updated = await api.recordPayment(invoiceId, paymentData);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated.invoice : inv)));
    showToast(`Payment of ${formatINR(paymentData.amount)} recorded!`, 'success');
  };

  const totalSales = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
  const totalDue = invoices.reduce((acc, inv) => acc + inv.balanceAmount, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Invoices &amp; Bills History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, print, track payments and share GST invoices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchInvoices}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onNavigateToBilling}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md shadow-red-950/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Billed
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">
            {formatINR(totalSales)}
          </div>
          <span className="text-[11px] text-slate-500">{invoices.length} invoices in view</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Collected Cash / Payments
          </span>
          <div className="text-xl font-black font-mono text-emerald-700 mt-1">
            {formatINR(totalPaid)}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">Realized revenue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Pending Receivables
          </span>
          <div className="text-xl font-black font-mono text-rose-600 mt-1">
            {formatINR(totalDue)}
          </div>
          <span className="text-[11px] text-rose-600 font-semibold">To collect from customers</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice number (e.g. SMA-2026-1001), customer name or phone..."
              className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {['all', 'Paid', 'Partially Paid', 'Unpaid'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Invoice No / Date</th>
                <th className="p-3">Customer Details</th>
                <th className="p-3 text-center">Items</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Balance Due</th>
                <th className="p-3 text-center">Mode</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No matching invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold font-mono text-slate-900 text-sm">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{formatDate(inv.date)}</div>
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {inv.customerPhone || 'No phone'}
                      </div>
                    </td>

                    <td className="p-3 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                        {inv.items.length} {inv.items.length === 1 ? 'part' : 'parts'}
                      </span>
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(inv.grandTotal)}
                    </td>

                    <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                      {formatINR(inv.paidAmount)}
                    </td>

                    <td className="p-3 text-right font-mono font-bold">
                      <span className={inv.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatINR(inv.balanceAmount)}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {inv.paymentMode}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.paymentStatus === 'Partially Paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Print Invoice */}
                        <button
                          type="button"
                          onClick={() => onOpenPrintModal(inv)}
                          title="Print Tax Invoice"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* WhatsApp Share */}
                        <button
                          type="button"
                          onClick={() => onOpenWhatsAppModal(inv)}
                          title="Send on WhatsApp"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </button>

                        {/* Record Payment (if pending) */}
                        {inv.balanceAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForPayment(inv)}
                            title="Record Payment"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete/Void (Admin Only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setInvoiceToDelete(inv)}
                            title="Delete / Void Invoice"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={Boolean(selectedInvoiceForPayment)}
        onClose={() => setSelectedInvoiceForPayment(null)}
        invoice={selectedInvoiceForPayment}
        onSavePayment={handleRecordPayment}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(invoiceToDelete)}
        title="Delete / Void Invoice?"
        message={`Are you sure you want to delete invoice ${invoiceToDelete?.invoiceNumber}? Stock quantities will be automatically restored to inventory.`}
        confirmText="Yes, Delete Invoice"
        isDangerous={true}
        onConfirm={handleDeleteInvoice}
        onCancel={() => setInvoiceToDelete(null)}
      />
    </div>
  );
}
