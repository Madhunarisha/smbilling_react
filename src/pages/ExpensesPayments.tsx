import React, { useState } from 'react';
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
} from 'lucide-react';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

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
}

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
  const [payments, setPayments] = useState<PaymentTransaction[]>([
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
  ]);

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

  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalInward = payments
    .filter((p) => p.type.startsWith('Inward'))
    .reduce((acc, p) => acc + p.amount, 0);
  const totalOutward = payments
    .filter((p) => p.type.startsWith('Outward'))
    .reduce((acc, p) => acc + p.amount, 0);

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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{p.date}</td>
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
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                        {p.mode}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        p.type.startsWith('Inward') ? 'text-emerald-700' : 'text-blue-700'
                      }`}
                    >
                      {formatINR(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
