import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Supplier } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { SupplierModal } from '../components/SupplierModal.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

interface SuppliersListProps {
  onViewLedger: (supplierId: string) => void;
}

export function SuppliersList({ onViewLedger }: SuppliersListProps) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSaveSupplier = async (data: Partial<Supplier>) => {
    if (editingSupplier) {
      const updated = await api.updateSupplier(editingSupplier.id, data);
      setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast(`Supplier "${updated.name}" updated!`, 'success');
    } else {
      const created = await api.createSupplier(data);
      setSuppliers((prev) => [created, ...prev]);
      showToast(`Supplier "${created.name}" added!`, 'success');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      await api.deleteSupplier(supplierToDelete.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierToDelete.id));
      showToast(`Supplier "${supplierToDelete.name}" removed`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete supplier', 'error');
    } finally {
      setSupplierToDelete(null);
    }
  };

  const totalPayables = suppliers.reduce((acc, s) => acc + s.currentBalance, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Suppliers &amp; Vendor Partners
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage battery manufacturers, oil distributors, spare parts vendors and payables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Suppliers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSupplier(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Active Suppliers
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">{suppliers.length}</div>
          <span className="text-[11px] text-slate-500">Authorized agencies &amp; depots</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Outstanding Payables
          </span>
          <div className="text-xl font-black font-mono text-amber-600 mt-1">
            {formatINR(totalPayables)}
          </div>
          <span className="text-[11px] text-amber-700 font-medium">To pay for consignments</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Vendors with Pending Dues
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">
            {suppliers.filter((s) => s.currentBalance > 0).length}
          </div>
          <span className="text-[11px] text-slate-500">Under credit payment terms</span>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">Supplier Name &amp; Contact</th>
                <th className="p-3">Phone</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Payment Terms</th>
                <th className="p-3 text-right">Total Purchases</th>
                <th className="p-3 text-right">Pending Payable (₹)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading supplier accounts...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No suppliers configured. Click "Add New Supplier" to create one.
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => {
                  const hasPayable = sup.currentBalance > 0;

                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{sup.name}</div>
                        {sup.contactPerson && (
                          <div className="text-[11px] text-slate-500">Contact: {sup.contactPerson}</div>
                        )}
                        {sup.address && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{sup.address}</div>
                        )}
                      </td>

                      <td className="p-3 font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{sup.phone}</span>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {sup.gstin || '—'}
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {sup.paymentTerms}
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatINR(sup.totalPurchases)}
                      </td>

                      <td className="p-3 text-right font-mono font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${
                            hasPayable
                              ? 'bg-amber-50 text-amber-700 font-black'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatINR(sup.currentBalance)}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Ledger */}
                          <button
                            type="button"
                            onClick={() => onViewLedger(sup.id)}
                            title="View Supplier Ledger Account"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSupplier(sup);
                              setIsModalOpen(true);
                            }}
                            title="Edit Supplier"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setSupplierToDelete(sup)}
                              title="Delete Supplier"
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

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSupplier}
        supplier={editingSupplier}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(supplierToDelete)}
        title="Delete Supplier?"
        message={`Are you sure you want to remove supplier "${supplierToDelete?.name}"?`}
        confirmText="Delete Supplier"
        isDangerous={true}
        onConfirm={handleDeleteSupplier}
        onCancel={() => setSupplierToDelete(null)}
      />
    </div>
  );
}
