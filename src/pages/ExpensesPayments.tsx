import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Calendar,
  CreditCard,
  Building2,
  X,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { Customer, Supplier } from '../types/index.js';

interface ExpenseRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  date: string;
  paidTo: string;
}

interface PaymentTransaction {
  id: string;
  type: 'Inward (Customer Receipt)' | 'Outward (Supplier Payment)';
  partyName: string;
  amount: number;
  mode: string;
  referenceNo: string;
  date: string;
  status: 'Completed' | 'Pending';
  notes?: string;
  partyId?: string;
}

const INITIAL_PAYMENTS: PaymentTransaction[] = [
  {
    id: 'pm-1',
    type: 'Inward (Customer Receipt)',
    partyName: 'Gurpreet Singh',
    amount: 5082,
    mode: 'Cash',
    referenceNo: 'SMA-2026-1001',
    date: '2026-09-12',
    status: 'Completed',
  },
  {
    id: 'pm-2',
    type: 'Inward (Customer Receipt)',
    partyName: 'Rajesh Sharma',
    amount: 4100,
    mode: 'UPI',
    referenceNo: 'SMA-2026-1002',
    date: '2026-09-11',
    status: 'Completed',
  },
  {
    id: 'pm-3',
    type: 'Outward (Supplier Payment)',
    partyName: 'Exide Industries Ltd',
    amount: 35000,
    mode: 'Bank Transfer',
    referenceNo: 'EXD-NEFT-9941',
    date: '2026-09-05',
    status: 'Completed',
  },
  {
    id: 'pm-4',
    type: 'Outward (Supplier Payment)',
    partyName: 'Amaron Batteries Depot',
    amount: 25000,
    mode: 'Bank Transfer',
    referenceNo: 'AMR-RTGS-1102',
    date: '2026-09-01',
    status: 'Completed',
  },
];

export function ExpensesPayments({ initialTab = 'expenses' }: { initialTab?: 'expenses' | 'payments' }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'expenses' | 'payments'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Expenses State
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([
    {
      id: 'exp-1',
      category: 'Electricity & Utilities',
      description: 'Monthly electricity bill for battery charging station',
      amount: 4850,
      paymentMode: 'UPI',
      date: '2026-09-07',
      paidTo: 'BSES Power Supply',
    },
    {
      id: 'exp-2',
      category: 'Shop Rent',
      description: 'Store and warehouse rent for September 2026',
      amount: 25000,
      paymentMode: 'Bank Transfer',
      date: '2026-09-02',
      paidTo: 'Estate Landlord',
    },
    {
      id: 'exp-3',
      category: 'Shop Consumables & Freight',
      description: 'Distilled water carboys, terminal grease, delivery rickshaw',
      amount: 1800,
      paymentMode: 'Cash',
      date: '2026-09-09',
      paidTo: 'Local Freight & Supplies',
    },
    {
      id: 'exp-4',
      category: 'Staff Tea & Refreshments',
      description: 'Weekly tea, water and workshop refreshment',
      amount: 950,
      paymentMode: 'Cash',
      date: '2026-09-10',
      paidTo: 'Sharma Tea Stall',
    },
  ]);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expCategory, setExpCategory] = useState('Shop Consumables & Freight');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidTo, setExpPaidTo] = useState('');
  const [expMode, setExpMode] = useState('Cash');

  // Payments State
  const [payments, setPayments] = useState<PaymentTransaction[]>(INITIAL_PAYMENTS);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Record Payment Modal State
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [payType, setPayType] = useState<'Inward (Customer Receipt)' | 'Outward (Supplier Payment)'>(
    'Inward (Customer Receipt)'
  );
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [customPartyName, setCustomPartyName] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payStatus, setPayStatus] = useState<'Completed' | 'Pending'>('Completed');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Payments Filter
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'inward' | 'outward'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');

  const loadData = async () => {
    try {
      setLoadingPayments(true);
      const [fetchedPayments, fetchedCustomers, fetchedSuppliers] = await Promise.all([
        api.getPayments().catch(() => []),
        api.getCustomers().catch(() => []),
        api.getSuppliers().catch(() => []),
      ]);

      setCustomers(fetchedCustomers || []);
      setSuppliers(fetchedSuppliers || []);

      if (fetchedPayments && fetchedPayments.length > 0) {
        setPayments(fetchedPayments);
      }
    } catch {
      // Keep initial demo payments on fallback
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) {
      showToast('Please enter a valid expense amount', 'error');
      return;
    }

    if (editingExpenseId) {
      setExpenses((prev) =>
        prev.map((exp) =>
          exp.id === editingExpenseId
            ? {
                ...exp,
                category: expCategory,
                description: expDesc || expCategory,
                amount: Number(expAmount),
                paymentMode: expMode,
                paidTo: expPaidTo || 'Cash Vendor',
              }
            : exp
        )
      );
      showToast('Expense updated successfully', 'success');
    } else {
      const newExp: ExpenseRecord = {
        id: `exp-${Date.now()}`,
        category: expCategory,
        description: expDesc || expCategory,
        amount: Number(expAmount),
        paymentMode: expMode,
        date: new Date().toISOString().split('T')[0],
        paidTo: expPaidTo || 'Cash Vendor',
      };
      setExpenses((prev) => [newExp, ...prev]);
      showToast('Expense recorded successfully', 'success');
    }

    setShowAddExpense(false);
    setEditingExpenseId(null);
    setExpAmount('');
    setExpDesc('');
    setExpPaidTo('');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    let resolvedPartyName = customPartyName.trim();
    if (selectedPartyId) {
      if (payType.startsWith('Inward')) {
        const found = customers.find((c) => c.id === selectedPartyId);
        if (found) resolvedPartyName = found.name;
      } else {
        const found = suppliers.find((s) => s.id === selectedPartyId);
        if (found) resolvedPartyName = found.name;
      }
    }

    if (!resolvedPartyName) {
      showToast('Please select or enter the party / customer / vendor name', 'error');
      return;
    }

    try {
      setSavingPayment(true);
      const newPayData = {
        type: payType,
        partyId: selectedPartyId || undefined,
        partyName: resolvedPartyName,
        amount: Number(payAmount),
        mode: payMode,
        referenceNo: payRef.trim() || undefined,
        date: payDate,
        status: payStatus,
        notes: payNotes.trim(),
      };

      try {
        const saved = await api.createPaymentRecord(newPayData);
        setPayments((prev) => [saved, ...prev]);
      } catch {
        // Fallback to local state if offline
        const fallbackPayment: PaymentTransaction = {
          id: `pm-${Date.now()}`,
          ...newPayData,
          referenceNo: newPayData.referenceNo || `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
        };
        setPayments((prev) => [fallbackPayment, ...prev]);
      }

      showToast(`Payment of ${formatINR(Number(payAmount))} recorded successfully!`, 'success');
      setShowRecordPayment(false);
      setSelectedPartyId('');
      setCustomPartyName('');
      setPayAmount('');
      setPayNotes('');
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (id: string, ref: string) => {
    if (!window.confirm(`Delete payment record (${ref})?`)) return;
    try {
      await api.deletePaymentRecord(id).catch(() => {});
      setPayments((prev) => prev.filter((p) => p.id !== id));
      showToast('Payment record deleted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete payment record', 'error');
    }
  };

  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalInward = payments
    .filter((p) => p.type.startsWith('Inward'))
    .reduce((acc, p) => acc + p.amount, 0);
  const totalOutward = payments
    .filter((p) => p.type.startsWith('Outward'))
    .reduce((acc, p) => acc + p.amount, 0);

  const filteredPayments = payments.filter((p) => {
    if (paymentTypeFilter === 'inward' && !p.type.startsWith('Inward')) return false;
    if (paymentTypeFilter === 'outward' && !p.type.startsWith('Outward')) return false;
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase();
      const matchParty = p.partyName?.toLowerCase().includes(q);
      const matchRef = p.referenceNo?.toLowerCase().includes(q);
      const matchMode = p.mode?.toLowerCase().includes(q);
      if (!matchParty && !matchRef && !matchMode) return false;
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-red-600" />
            <span>Finance, Expenses &amp; Payments</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Track Store Operating Overheads, Supplier Vouchers &amp; Customer Collections
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payments
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Monthly Expenses
          </span>
          <div className="text-xl font-black font-mono text-red-600 mt-1">
            {formatINR(totalExpense)}
          </div>
          <span className="text-[11px] text-slate-500">Rent, electricity, supplies</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Customer Payments Collected
          </span>
          <div className="text-xl font-black font-mono text-emerald-600 mt-1">
            {formatINR(totalInward)}
          </div>
          <span className="text-[11px] text-slate-500">Inward receipts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Supplier Payments Disbursed
          </span>
          <div className="text-xl font-black font-mono text-blue-600 mt-1">
            {formatINR(totalOutward)}
          </div>
          <span className="text-[11px] text-slate-500">Exide, Amaron, Castrol</span>
        </div>
      </div>

      {/* TAB 1: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700">Operating Expenses Log</span>
            <button
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setExpCategory('Shop Consumables & Freight');
                setExpAmount('');
                setExpDesc('');
                setExpPaidTo('');
                setExpMode('Cash');
                setShowAddExpense(true);
              }}
              className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Expense Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Paid To</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{exp.date}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{exp.category}</td>
                    <td className="py-3 px-3 text-slate-700">{exp.description}</td>
                    <td className="py-3 px-3 text-slate-600">{exp.paidTo}</td>
                    <td className="py-3 px-3 font-medium">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-red-600">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpenseId(exp.id);
                          setExpCategory(exp.category);
                          setExpDesc(exp.description);
                          setExpAmount(exp.amount.toString());
                          setExpPaidTo(exp.paidTo);
                          setExpMode(exp.paymentMode);
                          setShowAddExpense(true);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setPaymentTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paymentTypeFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({payments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTypeFilter('inward')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paymentTypeFilter === 'inward'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Inward Receipts
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTypeFilter('outward')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paymentTypeFilter === 'outward'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Outward Payments
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search party name, reference #, mode..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>
            </div>

            {/* Actions: Refresh & Record Payment Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadData}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer"
                title="Refresh Payments"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPayments ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPartyId('');
                  setCustomPartyName('');
                  setPayAmount('');
                  setPayMode('Cash');
                  setPayRef(`PAY-${Math.floor(1000 + Math.random() * 9000)}`);
                  setPayDate(new Date().toISOString().split('T')[0]);
                  setPayStatus('Completed');
                  setPayNotes('');
                  setShowRecordPayment(true);
                }}
                className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Transaction Flow</th>
                  <th className="py-3 px-3">Party Name</th>
                  <th className="py-3 px-3">Reference / Bill #</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No payment transactions found. Click &quot;Record Payment&quot; above to add one.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-medium">{p.date}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            p.type.startsWith('Inward') ? 'text-emerald-700' : 'text-blue-700'
                          }`}
                        >
                          {p.type.startsWith('Inward') ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          <span>{p.type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{p.partyName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{p.referenceNo}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                          {p.mode}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                          p.type.startsWith('Inward') ? 'text-emerald-700' : 'text-blue-700'
                        }`}
                      >
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id, p.referenceNo)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal Form */}
      {showRecordPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in fade-in my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Record Payment Transaction
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Inward Customer Collection or Outward Supplier Payment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordPayment(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              {/* Flow Selector Toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Transaction Flow *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPayType('Inward (Customer Receipt)');
                      setSelectedPartyId('');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payType.startsWith('Inward')
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Inward (Customer Receipt)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayType('Outward (Supplier Payment)');
                      setSelectedPartyId('');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payType.startsWith('Outward')
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Outward (Supplier Payment)</span>
                  </button>
                </div>
              </div>

              {/* Party Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {payType.startsWith('Inward') ? 'Customer / Garage *' : 'Vendor / Supplier *'}
                </label>
                {payType.startsWith('Inward') ? (
                  <select
                    value={selectedPartyId}
                    onChange={(e) => {
                      setSelectedPartyId(e.target.value);
                      if (e.target.value) {
                        const cust = customers.find((c) => c.id === e.target.value);
                        setCustomPartyName(cust?.name || '');
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="">-- Select from Customer Directory (or type custom below) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Phone: {c.phone} | Due: ₹{c.currentOutstanding})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedPartyId}
                    onChange={(e) => {
                      setSelectedPartyId(e.target.value);
                      if (e.target.value) {
                        const sup = suppliers.find((s) => s.id === e.target.value);
                        setCustomPartyName(sup?.name || '');
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="">-- Select from Supplier Directory (or type custom below) --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Payable: ₹{s.currentPayable})
                      </option>
                    ))}
                  </select>
                )}

                {/* Custom / Direct Party Name */}
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={customPartyName}
                    onChange={(e) => {
                      setCustomPartyName(e.target.value);
                      setSelectedPartyId('');
                    }}
                    placeholder={
                      payType.startsWith('Inward')
                        ? 'Or type customer name (e.g. Verma Workshop or Cash Customer)'
                        : 'Or type supplier / vendor agency name (e.g. Exide Depot)'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Amount and Payment Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (QR / GPay / PhonePe)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Cheque">Bank Cheque</option>
                  </select>
                </div>
              </div>

              {/* Reference and Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reference / Bill / UTR #</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value.toUpperCase())}
                    placeholder="e.g. SMA-2026-1002 or UTR-98210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as 'Completed' | 'Pending')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Completed">Completed (Realized)</option>
                    <option value="Pending">Pending Clearance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. Partial settlement for invoice"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingPayment ? 'Saving...' : 'Save & Record Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4 text-red-600" />
                <span>{editingExpenseId ? 'Edit Shop Expense' : 'Record Shop Expense'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddExpense(false);
                  setEditingExpenseId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="Electricity & Utilities">Electricity &amp; Utilities</option>
                  <option value="Shop Rent">Shop Rent</option>
                  <option value="Shop Consumables & Freight">Shop Consumables &amp; Freight</option>
                  <option value="Staff Tea & Refreshments">Staff Tea &amp; Refreshments</option>
                  <option value="Tools & Machine Maintenance">Tools &amp; Machine Maintenance</option>
                  <option value="Packaging & Delivery">Packaging &amp; Delivery</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paid To</label>
                <input
                  type="text"
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  placeholder="e.g. Electric Board / Vendor Name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={expMode}
                    onChange={(e) => setExpMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    placeholder="Short note"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpense(false);
                    setEditingExpenseId(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  {editingExpenseId ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
