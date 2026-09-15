import React, { useRef } from 'react';
import { X, Printer, Download, Share2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Invoice, BusinessSettings } from '../types/index.js';
import { formatINR, formatDate, numberToWordsIndian } from '../utils/formatters.js';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings?: BusinessSettings | null;
  onShareWhatsApp?: (inv: Invoice) => void;
}

export function InvoicePrintModal({
  isOpen,
  onClose,
  invoice,
  settings,
  onShareWhatsApp,
}: InvoicePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const defaultBiz: BusinessSettings = settings || {
    businessName: 'SM AUTOS AND BATTERY',
    legalName: 'HARIHARAN SHANMUGASUNDARAM',
    tradeName: 'SM AUTOS AND BATTERY',
    constitution: 'Proprietorship',
    tagline: 'Automotive Batteries, Lubricants & Genuine Spares',
    address: 'NO 5/1, WARD NO 10, ST-3, MELAPUDU THERU, Timmarasanayakkanur',
    buildingNo: 'NO 5/1, WARD NO 10',
    roadStreet: 'ST-3, MELAPUDU THERU',
    locality: 'Timmarasanayakkanur',
    city: 'Aundipatti',
    district: 'Theni',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '625536',
    phone: '+91 98765 43210',
    alternatePhone: '+91 98111 22334',
    email: 'billing@smautos.com',
    gstin: '33ARQPH7005P1ZE',
    pan: 'ARQPH7005P',
    invoicePrefix: 'SMA-2026',
    nextInvoiceNumber: 1000,
    termsAndConditions:
      '1. Goods once sold will be replaced within 7 days against valid bill.\n2. Battery warranty is handled directly as per manufacturer norms.\n3. All electrical parts carry test-warranty only.\n4. Subject to Theni jurisdiction only.',
    bankName: 'HDFC Bank Ltd',
    bankAccount: '50200012345678',
    ifscCode: 'HDFC0001234',
    bankBranch: 'Aundipatti Branch, Theni',
    upiId: 'smautos@hdfcbank',
    defaultGstRate: 18,
    maxDiscountPercent: 25,
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-[#f8fafc] rounded-2xl max-w-5xl w-full flex flex-col my-4 print:shadow-none print:m-0 print:max-w-none print:w-full overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-200 print:hidden">
          <h2 className="text-xl font-bold text-slate-900">Invoice Details</h2>
          <div className="flex gap-3">
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(invoice)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-4 h-4 brightness-0 invert" />
                Send to WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div 
          ref={printRef}
          className="p-6 sm:p-8 bg-white print:p-4 font-sans flex flex-col gap-8 shadow-sm m-6 rounded-xl border border-slate-100 print:m-0 print:border-none print:shadow-none"
        >
          {/* Top Section: Logo and Status */}
          <div className="flex justify-between items-start">
            <div className="border border-slate-200 p-2 rounded max-w-xs">
              {/* Placeholder for Logo, using text for now as in requirements */}
              <h1 className="text-xl font-black text-red-600 leading-tight">
                {defaultBiz.tradeName || defaultBiz.businessName}
              </h1>
            </div>
            <div>
              <span className={`text-3xl font-bold ${
                  invoice.paymentStatus === 'Paid' ? 'text-blue-600' :
                  invoice.paymentStatus === 'Unpaid' ? 'text-red-500' : 'text-amber-500'
                }`}>
                {invoice.paymentStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Dates & Invoice No Row */}
          <div className="flex flex-wrap items-center justify-between text-sm text-slate-600 font-medium">
            <div>Issue Date: <span className="font-semibold text-slate-800">{formatDate(invoice.date)}</span></div>
            <div>
              Due Date: <span className="font-semibold text-slate-800">{formatDate(invoice.date)}</span>
              {invoice.balanceAmount > 0 && <span className="text-red-500 ml-1">(Overdue)</span>}
            </div>
            <div>Invoice No: <span className="font-semibold text-slate-800">{invoice.invoiceNumber}</span></div>
          </div>

          {/* Items Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="p-4">Product / Service</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Quantity</th>
                  <th className="p-4">Rate</th>
                  <th className="p-4">Discount</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item, index) => (
                  <tr key={item.id || index}>
                    <td className="p-4 text-slate-600">{item.productName}</td>
                    <td className="p-4 text-slate-600">{item.unit}</td>
                    <td className="p-4 text-slate-600">{item.quantity}</td>
                    <td className="p-4 text-slate-600">{formatINR(item.rate)}</td>
                    <td className="p-4 text-slate-600">
                      {item.discountAmount > 0 ? formatINR(item.discountAmount) : '-'}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-800">
                      {formatINR(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
            {/* Left: Warranty, Notes, Terms */}
            <div className="space-y-6">
              <div className="flex gap-3 text-sm">
                <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Warranty Details</h4>
                  <p className="text-slate-500 mb-0.5">Start Date: <span className="text-slate-600">{new Date().toISOString()}</span></p>
                  <p className="text-slate-500">End Date / Duration: <span className="text-slate-600">No warranty details provided.</span></p>
                </div>
              </div>
              
              <div className="flex gap-3 text-sm">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Notes</h4>
                  <p className="text-slate-500">{invoice.notes || 'No notes available.'}</p>
                </div>
              </div>

              <div className="flex gap-3 text-sm">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Terms & Conditions</h4>
                  <p className="text-slate-500">Standard terms apply.</p>
                </div>
              </div>
            </div>

            {/* Right: Totals */}
            <div className="text-sm">
              <div className="flex justify-between py-3 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Amount</span>
                <span className="font-bold text-slate-900">{formatINR(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Tax</span>
                <span className="font-bold text-slate-900">{formatINR(invoice.cgstTotal + invoice.sgstTotal + invoice.igstTotal)}</span>
              </div>
              <div className="flex justify-between py-4 mt-2">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-indigo-900">{formatINR(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons (Hidden on Print) */}
          <div className="flex justify-end gap-3 pt-6 print:hidden">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-pink-500 text-pink-600 font-bold text-sm rounded-lg hover:bg-pink-50 transition-colors"
            >
              Back
            </button>
            <button
              className="px-6 py-2 bg-[#d82451] hover:bg-[#c01d44] text-white font-bold text-sm rounded-lg transition-colors shadow-sm"
              onClick={() => {
                 // The screenshot has Add Payment but logic is not wired in the print modal
                 // In a full implementation, this might open the PaymentModal or navigate
                 onClose();
              }}
            >
              Add Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

