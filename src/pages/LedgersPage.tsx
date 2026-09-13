import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  Customer,
  Supplier,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
} from '../types/index.js';
import { formatINR, formatDate } from '../utils/formatters.js';
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

  // Load lists
  useEffect(() => {
    async function loadLists() {
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
    }
    loadLists();
  }, []);

  // Fetch customer ledger when customer changes
  useEffect(() => {
    if (tab === 'customer' && selectedCustomerId) {
      setLoading(true);
      api
        .getCustomerLedger(selectedCustomerId)
        .then((data) => setCustomerEntries(data))
        .catch((err) => showToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [tab, selectedCustomerId]);

  // Fetch supplier ledger when supplier changes
  useEffect(() => {
    if (tab === 'supplier' && selectedSupplierId) {
      setLoading(true);
      api
        .getSupplierLedger(selectedSupplierId)
        .then((data) => setSupplierEntries(data))
        .catch((err) => showToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [tab, selectedSupplierId]);

  // Fetch business ledger
  useEffect(() => {
    if (tab === 'business') {
      setLoading(true);
      api
        .getBusinessLedger()
        .then((data) => setBusinessData(data))
        .catch((err) => showToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const handlePrint = () => {
    window.print();
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Financial Ledgers &amp; Account Statements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time debit, credit and running balance ledgers for all counterparties
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          type="button"
          onClick={() => setTab('customer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'customer'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Ledger (Khata)</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('supplier')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'supplier'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Ledger (Payables)</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('business')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'business'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Business Cash &amp; Bank Summary</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMER LEDGER */}
      {tab === 'customer' && (
        <div className="space-y-4">
          {/* Customer Picker */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Select Customer Account
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) — Outstanding: {formatINR(c.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="text-right flex items-center gap-4">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">Current Balance</span>
                  <span
                    className={`font-mono font-black text-lg ${
                      selectedCustomer.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {formatINR(selectedCustomer.currentBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Statement Header for Print & View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    STATEMENT OF ACCOUNT • {selectedCustomer?.name || 'Customer'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Phone: {selectedCustomer?.phone} • GSTIN: {selectedCustomer?.gstin || 'Unregistered'}
                  </p>
                  {selectedCustomer?.address && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedCustomer.address}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">SM Autos &amp; Batteries</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    Printed on {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Voucher Type</th>
                    <th className="p-3">Reference / Bill No.</th>
                    <th className="p-3">Particulars &amp; Details</th>
                    <th className="p-3 text-right">Debit / Billed (₹)</th>
                    <th className="p-3 text-right">Credit / Received (₹)</th>
                    <th className="p-3 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading statement entries...
                      </td>
                    </tr>
                  ) : customerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    customerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-800 capitalize">
                            {entry.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {entry.referenceNumber}
                        </td>
                        <td className="p-3 text-slate-700 max-w-sm">{entry.particulars}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {entry.debit > 0 ? formatINR(entry.debit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {entry.credit > 0 ? formatINR(entry.credit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          {formatINR(entry.runningBalance)}
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

      {/* TAB 2: SUPPLIER LEDGER */}
      {tab === 'supplier' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Select Supplier Account
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white font-medium"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — Pending Payable: {formatINR(s.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier && (
              <div className="text-right">
                <span className="text-[11px] text-slate-500 uppercase font-bold block">
                  Total Payable to Vendor
                </span>
                <span className="font-mono font-black text-lg text-amber-700">
                  {formatINR(selectedSupplier.currentBalance)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 print:bg-white print:border-b-2 print:border-black">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    SUPPLIER VENDOR LEDGER • {selectedSupplier?.name || 'Supplier'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    GSTIN: {selectedSupplier?.gstin} • Terms: {selectedSupplier?.paymentTerms}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">SM Autos &amp; Batteries</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    Printed on {new Date().toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Voucher Type</th>
                    <th className="p-3">Invoice / Ref No.</th>
                    <th className="p-3">Particulars &amp; Consignment</th>
                    <th className="p-3 text-right">Debit / Paid (₹)</th>
                    <th className="p-3 text-right">Credit / Inward Purchase (₹)</th>
                    <th className="p-3 text-right">Payable Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading supplier ledger...
                      </td>
                    </tr>
                  ) : supplierEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions recorded with this supplier.
                      </td>
                    </tr>
                  ) : (
                    supplierEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-800 capitalize">
                            {entry.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {entry.referenceNumber}
                        </td>
                        <td className="p-3 text-slate-700 max-w-sm">{entry.particulars}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {entry.debit > 0 ? formatINR(entry.debit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {entry.credit > 0 ? formatINR(entry.credit) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-amber-700">
                          {formatINR(entry.runningBalance)}
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

      {/* TAB 3: BUSINESS CASH & BANK LEDGER */}
      {tab === 'business' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Revenue
              </span>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatINR(businessData?.totalRevenue)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Expenses / Purchases
              </span>
              <div className="text-xl font-black font-mono text-slate-800 mt-1">
                {formatINR(businessData?.totalExpense)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Customer Receivables
              </span>
              <div className="text-xl font-black font-mono text-rose-600 mt-1">
                {formatINR(businessData?.totalCustomerReceivables)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Supplier Payables
              </span>
              <div className="text-xl font-black font-mono text-amber-600 mt-1">
                {formatINR(businessData?.totalSupplierPayables)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Payment Inflows by Mode</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {businessData?.paymentModeBreakdown &&
                Object.entries(businessData.paymentModeBreakdown).map(([mode, amt]: any) => (
                  <div key={mode} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase">{mode}</span>
                    <div className="font-mono font-bold text-base text-slate-900 mt-1">
                      {formatINR(amt)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
