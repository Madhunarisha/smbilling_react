import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Users,
  Truck,
  Building2,
  Printer,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  RefreshCw,
  Plus,
  Filter,
  CreditCard,
  Receipt,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  Customer,
  Supplier,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
} from '../types/index.js';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

interface LedgersPageProps {
  initialCustomerId?: string | null;
  initialSupplierId?: string | null;
}

export function LedgersPage({ initialCustomerId, initialSupplierId }: LedgersPageProps) {
  const { showToast } = useToast();

  const [tab, setTab] = useState<'customer' | 'supplier' | 'business'>(
    initialSupplierId ? 'supplier' : 'customer'
  );

  // Entities
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Selected for ledger
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '');

  // Ledger entries
  const [customerEntries, setCustomerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [supplierEntries, setSupplierEntries] = useState<SupplierLedgerEntry[]>([]);
  const [businessData, setBusinessData] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Manual Entry Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'debit' | 'credit'>('credit');
  const [entryVoucherType, setEntryVoucherType] = useState<string>('payment');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryReference, setEntryReference] = useState<string>('');
  const [entryDescription, setEntryDescription] = useState<string>('');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load lists
  const loadLists = async () => {
    try {
      const [cList, sList] = await Promise.all([api.getCustomers(), api.getSuppliers()]);
      setCustomers(cList);
      setSuppliers(sList);

      if (!selectedCustomerId && cList.length > 0) {
        setSelectedCustomerId(cList[0].id);
      }
      if (!selectedSupplierId && sList.length > 0) {
        setSelectedSupplierId(sList[0].id);
      }
    } catch (err: any) {
      showToast('Failed to load accounts list', 'error');
    }
  };

  useEffect(() => {
    loadLists();
  }, []);

  // Fetch customer ledger when customer changes
  const fetchCustomerLedger = async (cId: string) => {
    if (!cId) return;
    setLoading(true);
    try {
      const data = await api.getCustomerLedger(cId);
      setCustomerEntries(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch customer ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'customer' && selectedCustomerId) {
      fetchCustomerLedger(selectedCustomerId);
    }
  }, [tab, selectedCustomerId]);

  // Fetch supplier ledger when supplier changes
  const fetchSupplierLedger = async (sId: string) => {
    if (!sId) return;
    setLoading(true);
    try {
      const data = await api.getSupplierLedger(sId);
      setSupplierEntries(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch supplier ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'supplier' && selectedSupplierId) {
      fetchSupplierLedger(selectedSupplierId);
    }
  }, [tab, selectedSupplierId]);

  // Fetch business ledger
  const fetchBusinessLedger = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (dateFilter === 'custom' && customStartDate) params.fromDate = customStartDate;
      if (dateFilter === 'custom' && customEndDate) params.toDate = customEndDate;
      const data = await api.getBusinessLedger(params);
      setBusinessData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch business cashbook', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'business') {
      fetchBusinessLedger();
    }
  }, [tab, dateFilter, customStartDate, customEndDate]);

  const handlePrint = () => {
    window.print();
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Filtered customer entries
  const filteredCustomerEntries = useMemo(() => {
    return customerEntries.filter((entry) => {
      // Date filter
      if (dateFilter !== 'all') {
        const entryDate = new Date(entry.date);
        const now = new Date();
        if (dateFilter === 'today') {
          if (entryDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (entryDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (entryDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate && entryDate < new Date(customStartDate)) return false;
          if (customEndDate && entryDate > new Date(customEndDate + 'T23:59:59')) return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ref = (entry.referenceNo || '').toLowerCase();
        const desc = (entry.description || '').toLowerCase();
        const notes = (entry.notes || '').toLowerCase();
        if (!ref.includes(q) && !desc.includes(q) && !notes.includes(q)) return false;
      }

      return true;
    });
  }, [customerEntries, dateFilter, customStartDate, customEndDate, typeFilter, searchQuery]);

  // Filtered supplier entries
  const filteredSupplierEntries = useMemo(() => {
    return supplierEntries.filter((entry) => {
      // Date filter
      if (dateFilter !== 'all') {
        const entryDate = new Date(entry.date);
        const now = new Date();
        if (dateFilter === 'today') {
          if (entryDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (entryDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (entryDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate && entryDate < new Date(customStartDate)) return false;
          if (customEndDate && entryDate > new Date(customEndDate + 'T23:59:59')) return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ref = (entry.referenceNo || '').toLowerCase();
        const desc = (entry.description || '').toLowerCase();
        const notes = (entry.notes || '').toLowerCase();
        if (!ref.includes(q) && !desc.includes(q) && !notes.includes(q)) return false;
      }

      return true;
    });
  }, [supplierEntries, dateFilter, customStartDate, customEndDate, typeFilter, searchQuery]);

  // Totals for Customer Ledger
  const customerTotals = useMemo(() => {
    const totalDebit = filteredCustomerEntries.reduce((acc, curr) => acc + (curr.debit || 0), 0);
    const totalCredit = filteredCustomerEntries.reduce((acc, curr) => acc + (curr.credit || 0), 0);
    const netOutstanding = selectedCustomer?.currentOutstanding ?? (totalDebit - totalCredit);
    return { totalDebit, totalCredit, netOutstanding };
  }, [filteredCustomerEntries, selectedCustomer]);

  // Totals for Supplier Ledger
  const supplierTotals = useMemo(() => {
    const totalDebit = filteredSupplierEntries.reduce((acc, curr) => acc + (curr.debit || 0), 0);
    const totalCredit = filteredSupplierEntries.reduce((acc, curr) => acc + (curr.credit || 0), 0);
    const netPayable = selectedSupplier?.currentPayable ?? (totalCredit - totalDebit);
    return { totalDebit, totalCredit, netPayable };
  }, [filteredSupplierEntries, selectedSupplier]);

  // Handle manual voucher / ledger entry submission
  const handleCreateLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(entryAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'customer') {
        if (!selectedCustomerId) {
          showToast('Please select a customer account first', 'error');
          return;
        }
        await api.addCustomerLedgerEntry({
          customerId: selectedCustomerId,
          description: entryDescription || (modalType === 'debit' ? 'Manual Debit Voucher' : 'Payment / Credit Adjustment'),
          type: entryVoucherType,
          referenceNo: entryReference || `VOUCH-${Date.now().toString().slice(-6)}`,
          debit: modalType === 'debit' ? amt : 0,
          credit: modalType === 'credit' ? amt : 0,
          notes: entryNotes,
          date: entryDate,
        });
        showToast('Customer ledger entry added successfully', 'success');
        await fetchCustomerLedger(selectedCustomerId);
        await loadLists();
      } else if (tab === 'supplier') {
        if (!selectedSupplierId) {
          showToast('Please select a supplier account first', 'error');
          return;
        }
        await api.addSupplierLedgerEntry({
          supplierId: selectedSupplierId,
          description: entryDescription || (modalType === 'credit' ? 'Purchase / Credit Adjustment' : 'Payment / Debit Note'),
          type: entryVoucherType,
          referenceNo: entryReference || `VOUCH-${Date.now().toString().slice(-6)}`,
          debit: modalType === 'debit' ? amt : 0,
          credit: modalType === 'credit' ? amt : 0,
          notes: entryNotes,
          date: entryDate,
        });
        showToast('Supplier ledger entry added successfully', 'success');
        await fetchSupplierLedger(selectedSupplierId);
        await loadLists();
      }

      // Reset modal
      setIsModalOpen(false);
      setEntryAmount('');
      setEntryReference('');
      setEntryDescription('');
      setEntryNotes('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record ledger entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    let rows: string[][] = [];
    let filename = 'ledger-statement.csv';

    if (tab === 'customer') {
      filename = `${selectedCustomer?.name || 'Customer'}-Ledger-${new Date().toISOString().split('T')[0]}.csv`;
      rows.push(['Date', 'Type', 'Reference No', 'Description', 'Debit (Rs.)', 'Credit (Rs.)', 'Running Balance (Rs.)', 'Notes']);
      filteredCustomerEntries.forEach((e) => {
        rows.push([
          formatDate(e.date),
          e.type,
          e.referenceNo,
          `"${e.description.replace(/"/g, '""')}"`,
          String(e.debit || 0),
          String(e.credit || 0),
          String(e.balance || 0),
          `"${(e.notes || '').replace(/"/g, '""')}"`,
        ]);
      });
    } else if (tab === 'supplier') {
      filename = `${selectedSupplier?.name || 'Supplier'}-Ledger-${new Date().toISOString().split('T')[0]}.csv`;
      rows.push(['Date', 'Type', 'Reference No', 'Description', 'Paid/Debit (Rs.)', 'Inward/Credit (Rs.)', 'Payable Balance (Rs.)', 'Notes']);
      filteredSupplierEntries.forEach((e) => {
        rows.push([
          formatDate(e.date),
          e.type,
          e.referenceNo,
          `"${e.description.replace(/"/g, '""')}"`,
          String(e.debit || 0),
          String(e.credit || 0),
          String(e.balance || 0),
          `"${(e.notes || '').replace(/"/g, '""')}"`,
        ]);
      });
    } else {
      filename = `Business-Cashbook-${new Date().toISOString().split('T')[0]}.csv`;
      rows.push(['Date', 'Payment Mode', 'Invoice No', 'Customer', 'Amount (Rs.)', 'Reference', 'Notes']);
      (businessData?.payments || []).forEach((p: any) => {
        rows.push([
          formatDate(p.date),
          p.paymentMode,
          p.invoiceNumber,
          `"${p.customerName || ''}"`,
          String(p.amount),
          p.transactionRef || '',
          `"${(p.notes || '').replace(/"/g, '""')}"`,
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported ledger to CSV', 'success');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Ledger Management &amp; Statements
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Double-entry Khata management, party statements, debit/credit vouchers, and cashbooks
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {tab !== 'business' && (
            <button
              type="button"
              onClick={() => {
                setModalType(tab === 'customer' ? 'credit' : 'debit');
                setEntryVoucherType('payment');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry / Voucher</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('customer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            tab === 'customer'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Khata (Receivables)</span>
          {customers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/40 font-mono">
              {customers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('supplier')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            tab === 'supplier'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Ledger (Payables)</span>
          {suppliers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/40 font-mono">
              {suppliers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('business')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            tab === 'business'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Cash &amp; Bank Daybook</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMER LEDGER */}
      {tab === 'customer' && (
        <div className="space-y-4">
          {/* Party Selector & Metric Cards */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 w-full sm:max-w-md">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Customer Account
                </label>
                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white font-semibold text-slate-800"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) • Due: {formatINR(c.currentOutstanding)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCustomer && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex-1 sm:flex-initial text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Credit Limit</span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {selectedCustomer.creditLimit > 0 ? formatINR(selectedCustomer.creditLimit) : 'No Limit'}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex-1 sm:flex-initial text-right">
                    <span className="text-[10px] text-amber-700 uppercase font-bold block">Net Outstanding</span>
                    <span
                      className={`font-mono font-black text-base sm:text-lg ${
                        selectedCustomer.currentOutstanding > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatINR(selectedCustomer.currentOutstanding)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Filter and search row */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search voucher, reference, notes..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="invoice">Invoices</option>
                  <option value="payment">Payments</option>
                  <option value="customer_return">Returns</option>
                  <option value="adjustment">Adjustments</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="custom">Custom Date</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => selectedCustomerId && fetchCustomerLedger(selectedCustomerId)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                  title="Refresh Ledger"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Billed / Debit</span>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                  {formatINR(customerTotals.totalDebit)}
                </div>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Paid / Credit</span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                  {formatINR(customerTotals.totalCredit)}
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Closing Balance</span>
                <div
                  className={`text-lg font-black font-mono mt-0.5 ${
                    customerTotals.netOutstanding > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {formatINR(customerTotals.netOutstanding)}{' '}
                  <span className="text-xs font-bold text-slate-500">
                    {customerTotals.netOutstanding > 0 ? '(Dr - Due)' : '(Cleared)'}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Statement View / Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            {/* Printable Statement Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
                      Customer Khata Statement
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Acc ID: {selectedCustomer?.id}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-slate-900 mt-1">
                    {selectedCustomer?.name || 'Customer Statement'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Phone: <span className="font-semibold">{selectedCustomer?.phone}</span>
                    {selectedCustomer?.email ? ` • Email: ${selectedCustomer.email}` : ''}
                    {selectedCustomer?.gstin ? ` • GSTIN: ${selectedCustomer.gstin}` : ' • GSTIN: Unregistered'}
                  </p>
                  {selectedCustomer?.address && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedCustomer.address}</p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-black tracking-wide text-slate-900 block">SM AUTOS &amp; BATTERIES</span>
                  <span className="text-xs text-slate-500 block">Automotive Spares &amp; Batteries Specialists</span>
                  <span className="text-[11px] font-mono text-slate-500 block mt-1">
                    Generated: {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-200">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Date</th>
                    <th className="p-3 whitespace-nowrap">Type</th>
                    <th className="p-3 whitespace-nowrap">Reference / Bill No.</th>
                    <th className="p-3">Particulars &amp; Notes</th>
                    <th className="p-3 text-right whitespace-nowrap">Debit / Billed (₹)</th>
                    <th className="p-3 text-right whitespace-nowrap">Credit / Paid (₹)</th>
                    <th className="p-3 text-right whitespace-nowrap">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Loading ledger entries...
                      </td>
                    </tr>
                  ) : filteredCustomerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions found for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              entry.type === 'invoice'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : entry.type === 'payment'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : entry.type === 'customer_return'
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {entry.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {entry.referenceNo || '—'}
                        </td>
                        <td className="p-3 text-slate-700">
                          <div className="font-medium text-slate-900">{entry.description}</div>
                          {entry.notes && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">{entry.notes}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {entry.debit > 0 ? formatINR(entry.debit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {entry.credit > 0 ? formatINR(entry.credit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                          {formatINR(entry.balance)}{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            {entry.balance > 0 ? 'Dr' : 'Cr'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredCustomerEntries.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={4} className="p-3 text-right text-slate-700 uppercase text-xs">
                        Statement Total:
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900">
                        {formatINR(customerTotals.totalDebit)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700">
                        {formatINR(customerTotals.totalCredit)}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-700 font-black">
                        {formatINR(customerTotals.netOutstanding)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Print Signature Box */}
            <div className="hidden print:flex justify-between items-end p-8 mt-12 border-t border-slate-300">
              <div className="text-center">
                <div className="w-44 border-b border-black mb-1"></div>
                <span className="text-xs font-medium">Customer Acknowledgment</span>
              </div>
              <div className="text-center">
                <div className="w-44 border-b border-black mb-1"></div>
                <span className="text-xs font-medium">Authorized Signatory (SM Autos)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER LEDGER */}
      {tab === 'supplier' && (
        <div className="space-y-4">
          {/* Party Selector & Metric Cards */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 w-full sm:max-w-md">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Supplier / Vendor
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white font-semibold text-slate-800"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} • Payable: {formatINR(s.currentPayable)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplier && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex-1 sm:flex-initial text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Payment Terms</span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {selectedSupplier.paymentTerms || 'Standard'}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex-1 sm:flex-initial text-right">
                    <span className="text-[10px] text-amber-700 uppercase font-bold block">Total Payable</span>
                    <span className="font-mono font-black text-base sm:text-lg text-amber-700">
                      {formatINR(selectedSupplier.currentPayable)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Filter and search row */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search voucher, bill, consignment..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="purchase">Purchases / Inward</option>
                  <option value="payment">Payments to Vendor</option>
                  <option value="supplier_return">Purchase Returns</option>
                  <option value="adjustment">Adjustments</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="custom">Custom Date</option>
                </select>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => selectedSupplierId && fetchSupplierLedger(selectedSupplierId)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                  title="Refresh Ledger"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Inward Stock / Credit</span>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                  {formatINR(supplierTotals.totalCredit)}
                </div>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Amount Paid / Debit</span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                  {formatINR(supplierTotals.totalDebit)}
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Closing Payable</span>
                <div className="text-lg font-black font-mono text-amber-700 mt-0.5">
                  {formatINR(supplierTotals.netPayable)}
                </div>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Statement View / Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            {/* Printable Statement Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-100 text-indigo-800">
                      Supplier Account Ledger
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Vendor ID: {selectedSupplier?.id}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-slate-900 mt-1">
                    {selectedSupplier?.name || 'Supplier Statement'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Contact: <span className="font-semibold">{selectedSupplier?.contactPerson || selectedSupplier?.phone}</span>
                    {selectedSupplier?.phone ? ` • Tel: ${selectedSupplier.phone}` : ''}
                    {selectedSupplier?.gstin ? ` • GSTIN: ${selectedSupplier.gstin}` : ''}
                  </p>
                  {selectedSupplier?.address && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedSupplier.address}</p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-black tracking-wide text-slate-900 block">SM AUTOS &amp; BATTERIES</span>
                  <span className="text-xs text-slate-500 block">Delhi Hub Depot</span>
                  <span className="text-[11px] font-mono text-slate-500 block mt-1">
                    Printed: {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-200">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Date</th>
                    <th className="p-3 whitespace-nowrap">Type</th>
                    <th className="p-3 whitespace-nowrap">Invoice / Ref No.</th>
                    <th className="p-3">Particulars &amp; Consignment</th>
                    <th className="p-3 text-right whitespace-nowrap">Debit / Paid (₹)</th>
                    <th className="p-3 text-right whitespace-nowrap">Credit / Inward (₹)</th>
                    <th className="p-3 text-right whitespace-nowrap">Payable Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                        Loading supplier ledger...
                      </td>
                    </tr>
                  ) : filteredSupplierEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions recorded for this supplier yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              entry.type === 'purchase'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : entry.type === 'payment'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {entry.referenceNo || '—'}
                        </td>
                        <td className="p-3 text-slate-700">
                          <div className="font-medium text-slate-900">{entry.description}</div>
                          {entry.notes && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">{entry.notes}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {entry.debit > 0 ? formatINR(entry.debit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {entry.credit > 0 ? formatINR(entry.credit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-amber-700 whitespace-nowrap">
                          {formatINR(entry.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredSupplierEntries.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={4} className="p-3 text-right text-slate-700 uppercase text-xs">
                        Statement Total:
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700">
                        {formatINR(supplierTotals.totalDebit)}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900">
                        {formatINR(supplierTotals.totalCredit)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 font-black">
                        {formatINR(supplierTotals.netPayable)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BUSINESS CASH & BANK LEDGER */}
      {tab === 'business' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Invoiced Sales
              </span>
              <div className="text-xl font-black font-mono text-indigo-600 mt-1">
                {formatINR(businessData?.totalInvoiced)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Gross sales turnover</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Cash &amp; Bank Inflows
              </span>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatINR(businessData?.totalCollections)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Realized payments</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Market Receivables
              </span>
              <div className="text-xl font-black font-mono text-rose-600 mt-1">
                {formatINR(businessData?.totalReceivables)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Pending from customers</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Vendor Payables
              </span>
              <div className="text-xl font-black font-mono text-amber-600 mt-1">
                {formatINR(businessData?.totalPayables)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Liabilities to suppliers</span>
            </div>
          </div>

          {/* Realized Payments Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Collections &amp; Receipts Ledger</h3>
                <p className="text-xs text-slate-500">Real-time breakdown of cash, UPI, and bank collections</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">
                {(businessData?.payments || []).length} Transactions Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Date &amp; Time</th>
                    <th className="p-3 whitespace-nowrap">Invoice No</th>
                    <th className="p-3">Party / Customer</th>
                    <th className="p-3 whitespace-nowrap">Payment Mode</th>
                    <th className="p-3 whitespace-nowrap">Ref / UTR</th>
                    <th className="p-3">Cashier / Staff</th>
                    <th className="p-3 text-right whitespace-nowrap">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading collections data...
                      </td>
                    </tr>
                  ) : (businessData?.payments || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No payments recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    (businessData?.payments || []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDateTime(p.date)}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {p.invoiceNumber}
                        </td>
                        <td className="p-3 font-medium text-slate-800">{p.customerName || 'Walk-in'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                            {p.paymentMode}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{p.transactionRef || '—'}</td>
                        <td className="p-3 text-slate-600">{p.createdBy || 'Counter'}</td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                          {formatINR(p.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Voucher / Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Add Ledger Voucher / Adjustment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {tab === 'customer' ? `Account: ${selectedCustomer?.name}` : `Vendor: ${selectedSupplier?.name}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLedgerEntry} className="p-5 space-y-4 text-xs">
              {/* Debit vs Credit toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wide text-[10px]">
                  Entry Nature (Debit / Credit)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('debit');
                      setEntryVoucherType(tab === 'customer' ? 'adjustment' : 'payment');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-center border transition-all ${
                      modalType === 'debit'
                        ? 'bg-rose-50 border-rose-400 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Debit (+)
                    <span className="block text-[10px] font-normal text-slate-500">
                      {tab === 'customer' ? 'Increases Due from Customer' : 'Decreases Vendor Payable (Payment)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalType('credit');
                      setEntryVoucherType(tab === 'customer' ? 'payment' : 'purchase');
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-center border transition-all ${
                      modalType === 'credit'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Credit (-)
                    <span className="block text-[10px] font-normal text-slate-500">
                      {tab === 'customer' ? 'Decreases Due (Payment/Discount)' : 'Increases Vendor Payable (Inward)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Amount & Voucher Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Voucher Type</label>
                  <select
                    value={entryVoucherType}
                    onChange={(e) => setEntryVoucherType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium bg-white"
                  >
                    <option value="payment">Payment Voucher</option>
                    <option value="adjustment">Manual Adjustment</option>
                    <option value="invoice">Invoice / Charge</option>
                    <option value="credit_sale">Credit Note / Discount</option>
                  </select>
                </div>
              </div>

              {/* Reference & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reference / UTR / Voucher No</label>
                  <input
                    type="text"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    placeholder={`REF-${Date.now().toString().slice(-4)}`}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Particulars</label>
                <input
                  type="text"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  placeholder="e.g. Counter Cash Settlement, Discount given, Bank transfer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Internal Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="Additional information for auditor / khata record..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
