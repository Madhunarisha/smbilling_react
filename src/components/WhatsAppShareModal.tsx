import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';
import { Invoice } from '../types/index.js';
import { generateWhatsAppMessage, getWhatsAppShareUrl } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function WhatsAppShareModal({ isOpen, onClose, invoice }: WhatsAppShareModalProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (invoice) {
      setPhone(invoice.customerPhone || '');
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const message = generateWhatsAppMessage(
    invoice.customerName,
    invoice.invoiceNumber,
    invoice.grandTotal,
    invoice.paidAmount,
    invoice.balanceAmount,
    invoice.items
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    showToast('WhatsApp message copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    if (!phone || phone.length < 10) {
      showToast('Please provide a valid 10-digit customer mobile number.', 'warning');
      return;
    }
    const url = getWhatsAppShareUrl(phone, message);
    window.open(url, '_blank');
    showToast('Opening WhatsApp with invoice details...', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700/60 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-none">Share Invoice via WhatsApp</h3>
              <p className="text-xs text-emerald-100 mt-1">
                Invoice {invoice.invoiceNumber} • {invoice.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-700 transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Customer Mobile Number (WhatsApp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Enter 10-digit mobile number"
                className="w-full pl-12 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-medium text-slate-800"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Country code +91 will be automatically prefixed.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Message Preview
            </label>
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {message}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors border border-slate-300"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
