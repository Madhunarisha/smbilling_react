import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Phone,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Customer } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { CustomerModal } from '../components/CustomerModal.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

interface CustomersListProps {
  onViewLedger: (customerId: string) => void;
}

export function CustomersList({ onViewLedger }: CustomersListProps) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(searchQuery);
      setCustomers(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers();
  };

  const handleSaveCustomer = async (data: Partial<Customer>) => {
    if (editingCustomer) {
      const updated = await api.updateCustomer(editingCustomer.id, data);
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Customer "${updated.name}" updated!`, 'success');
    } else {
      const created = await api.createCustomer(data);
      setCustomers((prev) => [created, ...prev]);
      showToast(`Customer "${created.name}" created!`, 'success');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await api.deleteCustomer(customerToDelete.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      showToast(`Customer "${customerToDelete.name}" deleted`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete customer', 'error');
    } finally {
      setCustomerToDelete(null);
    }
  };

  const totalOutstanding = customers.reduce((acc, c) => acc + c.currentBalance, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customer Directory &amp; Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage auto garages, wholesale fleet clients, retail vehicle owners and dues
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCustomers}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Customers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Customers
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">{customers.length}</div>
          <span className="text-[11px] text-slate-500">Retail &amp; commercial garages</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Outstanding Receivables
          </span>
          <div className="text-xl font-black font-mono text-rose-600 mt-1">
            {formatINR(totalOutstanding)}
          </div>
          <span className="text-[11px] text-rose-600 font-semibold">To be recovered</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Customers with Active Dues
          </span>
          <div className="text-xl font-black font-mono text-amber-600 mt-1">
            {customers.filter((c) => c.currentBalance > 0).length}
          </div>
          <span className="text-[11px] text-slate-500">Follow up on pending credit</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone number, address or GSTIN..."
            className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 font-medium"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Customer Name</th>
                <th className="p-3">Mobile Phone</th>
                <th className="p-3">Type</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3 text-right">Credit Limit</th>
                <th className="p-3 text-right">Total Purchased</th>
                <th className="p-3 text-right">Outstanding Due</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const hasDue = cust.currentBalance > 0;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{cust.name}</div>
                        {cust.address && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">{cust.address}</div>
                        )}
                      </td>

                      <td className="p-3 font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{cust.phone}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {cust.customerType}
                        </span>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {cust.gstin || '—'}
                      </td>

                      <td className="p-3 text-right font-mono text-slate-600">
                        {cust.creditLimit ? formatINR(cust.creditLimit) : 'No limit'}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(cust.totalPurchases)}
                      </td>

                      <td className="p-3 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${
                            hasDue
                              ? 'bg-rose-50 text-rose-700 font-black'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatINR(cust.currentBalance)}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Ledger */}
                          <button
                            type="button"
                            onClick={() => onViewLedger(cust.id)}
                            title="View Customer Ledger Account"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>

                          {/* WhatsApp Chat */}
                          {cust.phone && (
                            <a
                              href={`https://wa.me/91${cust.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Chat on WhatsApp"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomer(cust);
                              setIsModalOpen(true);
                            }}
                            title="Edit Customer Details"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setCustomerToDelete(cust)}
                              title="Delete Customer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(customerToDelete)}
        title="Delete Customer?"
        message={`Are you sure you want to delete customer "${customerToDelete?.name}"?`}
        confirmText="Delete Customer"
        isDangerous={true}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
}
