import React, { useState, useEffect } from 'react';
import { X, ChevronDown, AlertCircle } from 'lucide-react';
import { Invoice, PaymentMode } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSavePayment: (
    invoiceId: string,
    data: { amount: number; paymentMode: string; transactionRef?: string; notes?: string }
  ) => Promise<void>;
}

export function PaymentModal({ isOpen, onClose, invoice, onSavePayment }: PaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [receivedDate, setReceivedDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setAmount(invoice.balanceAmount.toFixed(2));
      setPaymentMode('Cash');
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      setReceivedDate(`${day}/${month}/${year}`);
      setNotes('');
      setError(null);
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (numAmount > invoice.balanceAmount) {
      setError(
        `Payment amount cannot exceed pending balance of ${formatINR(invoice.balanceAmount)}.`
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSavePayment(invoice.id, {
        amount: numAmount,
        paymentMode,
        transactionRef: '',
        notes: `${notes ? notes + ' ' : ''}[Date: ${receivedDate}]`,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4 border border-slate-200 animate-in fade-in">
        {/* Header: Title + Close Icon */}
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-xl font-bold text-slate-900">Add Payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Row 1: Invoice * | Invoice Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={invoice.invoiceNumber}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice Amount
              </label>
              <input
                type="text"
                readOnly
                value={invoice.grandTotal.toFixed(2)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Row 2: Balance Amount * | Received Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Balance Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={invoice.balanceAmount.toFixed(2)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Received Date
              </label>
              <input
                type="text"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] transition-all"
              />
            </div>
          </div>

          {/* Row 3: Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Method
            </label>
            <div className="relative">
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 appearance-none pr-10 focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] font-medium transition-all"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI (GPay / PhonePe / QR)</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                <option value="Credit">Credit</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Row 4: Amount * */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.balanceAmount}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] transition-all"
            />
          </div>

          {/* Row 5: Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter Notes"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] resize-y transition-all"
            />
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-xs sm:text-sm font-semibold text-[#c81e3a] hover:bg-red-50 border border-[#c81e3a] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-2 text-xs sm:text-sm font-bold text-white bg-[#c81e3a] hover:bg-red-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
