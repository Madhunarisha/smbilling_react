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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col my-4 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
        {/* Action Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">GST Tax Invoice Preview</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              {invoice.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(invoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Invoice Document */}
        <div
          ref={printRef}
          className="p-6 sm:p-8 text-slate-800 bg-white font-sans text-xs leading-normal print:p-4 print:text-black"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 block mb-0.5 print:text-black">
                  Original for Recipient • GST TAX INVOICE
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                  {defaultBiz.tradeName || defaultBiz.businessName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 mt-0.5 font-medium">
                  {defaultBiz.legalName && (
                    <span>
                      <strong className="text-slate-800">Proprietor:</strong> {defaultBiz.legalName}
                    </span>
                  )}
                  {defaultBiz.constitution && (
                    <span className="px-1.5 py-0.2 bg-slate-100 print:bg-transparent border border-slate-300 rounded text-[10px] font-semibold text-slate-700">
                      {defaultBiz.constitution}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 italic font-medium mt-0.5">{defaultBiz.tagline}</p>
                <div className="text-xs text-slate-700 mt-1 max-w-lg leading-relaxed">
                  <p className="font-semibold text-slate-800">
                    {defaultBiz.address}
                  </p>
                  <p>
                    {defaultBiz.city}
                    {defaultBiz.district ? `, ${defaultBiz.district} Dist.` : ''}, {defaultBiz.state} - {defaultBiz.pincode}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-700 mt-1">
                  <span>
                    <strong>Phone:</strong> {defaultBiz.phone}
                  </span>
                  <span>
                    <strong>Email:</strong> {defaultBiz.email}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-block bg-slate-100 print:bg-transparent px-2 py-0.5 rounded font-mono font-bold text-slate-900 text-xs border border-slate-300">
                    GSTIN: {defaultBiz.gstin}
                  </span>
                  {defaultBiz.pan && (
                    <span className="inline-block bg-slate-100 print:bg-transparent px-2 py-0.5 rounded font-mono font-bold text-slate-900 text-xs border border-slate-300">
                      PAN: {defaultBiz.pan}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-700">
                    State: {defaultBiz.state} (Code: {defaultBiz.stateCode})
                  </span>
                </div>
              </div>

              <div className="text-right border-l-2 border-slate-200 pl-4">
                <div className="mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Invoice Number</span>
                  <span className="text-base sm:text-lg font-black font-mono text-slate-900">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Issue</span>
                  <span className="font-semibold text-slate-800">{formatDate(invoice.date)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Place of Supply</span>
                  <span className="font-semibold text-slate-800">
                    {invoice.isInterState ? 'Inter-State (IGST)' : `${defaultBiz.state} (${defaultBiz.stateCode})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To & Shipped To */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3.5 mb-4 bg-slate-50/50 print:bg-transparent">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Details of Receiver / Billed To:
              </span>
              <h4 className="font-bold text-sm text-slate-900">{invoice.customerName}</h4>
              <p className="text-xs text-slate-700 mt-0.5">
                <strong>Phone:</strong> {invoice.customerPhone || 'N/A'}
              </p>
              {invoice.billingAddress && (
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">{invoice.billingAddress}</p>
              )}
              {invoice.customerGstin && (
                <p className="text-xs font-mono font-semibold text-slate-800 mt-1">
                  <strong>Customer GSTIN:</strong> {invoice.customerGstin}
                </p>
              )}
            </div>

            <div className="border-l border-slate-200 pl-4 print:border-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Payment & Billing Details:
              </span>
              <div className="space-y-1 text-xs text-slate-700">
                <p>
                  <strong>Payment Mode:</strong> <span className="font-semibold">{invoice.paymentMode}</span>
                </p>
                <p>
                  <strong>Payment Status:</strong>{' '}
                  <span
                    className={`inline-block px-2 py-0.2 rounded font-bold text-[11px] ${
                      invoice.paymentStatus === 'Paid'
                        ? 'text-emerald-700 bg-emerald-100 print:text-black'
                        : invoice.paymentStatus === 'Partially Paid'
                        ? 'text-amber-700 bg-amber-100 print:text-black'
                        : 'text-rose-700 bg-rose-100 print:text-black'
                    }`}
                  >
                    {invoice.paymentStatus}
                  </span>
                </p>
                <p>
                  <strong>Billed By:</strong> {invoice.createdBy || 'Staff'}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 print:bg-slate-200">
                <tr>
                  <th className="p-2 w-8 text-center border-r border-slate-300">#</th>
                  <th className="p-2 border-r border-slate-300">Description of Goods / Parts</th>
                  <th className="p-2 w-16 text-center border-r border-slate-300">HSN/SKU</th>
                  <th className="p-2 w-12 text-center border-r border-slate-300">Qty</th>
                  <th className="p-2 w-16 text-right border-r border-slate-300">Rate (₹)</th>
                  <th className="p-2 w-14 text-right border-r border-slate-300">Disc</th>
                  <th className="p-2 w-20 text-right border-r border-slate-300">Taxable (₹)</th>
                  {invoice.isInterState ? (
                    <th className="p-2 w-20 text-right border-r border-slate-300">IGST</th>
                  ) : (
                    <>
                      <th className="p-2 w-16 text-right border-r border-slate-300">CGST</th>
                      <th className="p-2 w-16 text-right border-r border-slate-300">SGST</th>
                    </>
                  )}
                  <th className="p-2 w-20 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-slate-50/50">
                    <td className="p-2 text-center font-medium text-slate-500 border-r border-slate-200">
                      {index + 1}
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      {item.barcode && (
                        <div className="text-[10px] text-slate-400 font-mono">Barcode: {item.barcode}</div>
                      )}
                    </td>
                    <td className="p-2 text-center font-mono text-[11px] border-r border-slate-200">{item.sku}</td>
                    <td className="p-2 text-center font-bold text-slate-900 border-r border-slate-200">
                      {item.quantity} <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
                    </td>
                    <td className="p-2 text-right font-mono border-r border-slate-200">
                      {item.rate.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2 text-right text-slate-600 border-r border-slate-200">
                      {item.discountAmount > 0 ? `₹${item.discountAmount}` : '—'}
                    </td>
                    <td className="p-2 text-right font-medium text-slate-900 border-r border-slate-200">
                      {item.taxableAmount.toLocaleString('en-IN')}
                    </td>
                    {invoice.isInterState ? (
                      <td className="p-2 text-right border-r border-slate-200">
                        <div className="text-[10px] text-slate-500">{item.gstRate}%</div>
                        <div className="font-mono">₹{item.igstAmount.toFixed(1)}</div>
                      </td>
                    ) : (
                      <>
                        <td className="p-2 text-right border-r border-slate-200">
                          <div className="text-[10px] text-slate-500">{item.gstRate / 2}%</div>
                          <div className="font-mono">₹{item.cgstAmount.toFixed(1)}</div>
                        </td>
                        <td className="p-2 text-right border-r border-slate-200">
                          <div className="text-[10px] text-slate-500">{item.gstRate / 2}%</div>
                          <div className="font-mono">₹{item.sgstAmount.toFixed(1)}</div>
                        </td>
                      </>
                    )}
                    <td className="p-2 text-right font-bold text-slate-900">
                      {item.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Amount In Words & Financial Summary */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            {/* Left: Words & Bank details */}
            <div className="col-span-7 space-y-3">
              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 print:bg-transparent">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Amount in Words</span>
                <p className="font-semibold text-slate-900 italic mt-0.5 text-xs">
                  {numberToWordsIndian(invoice.grandTotal)}
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 print:bg-transparent text-[11px] leading-relaxed">
                <span className="text-[10px] uppercase font-bold text-blue-700 block mb-1 print:text-black">
                  Bank Details for Electronic Transfer (NEFT / RTGS / UPI)
                </span>
                <div className="grid grid-cols-2 gap-x-2 text-slate-700">
                  <p>
                    <strong>Bank:</strong> {defaultBiz.bankName}
                  </p>
                  <p>
                    <strong>A/C No:</strong> <span className="font-mono">{defaultBiz.bankAccount}</span>
                  </p>
                  <p>
                    <strong>IFSC:</strong> <span className="font-mono">{defaultBiz.ifscCode}</span>
                  </p>
                  <p>
                    <strong>UPI ID:</strong> <span className="font-mono font-bold text-slate-900">{defaultBiz.upiId}</span>
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 leading-tight">
                <span className="font-bold text-slate-700 block mb-0.5">Terms & Conditions:</span>
                <p className="whitespace-pre-line">{defaultBiz.termsAndConditions}</p>
              </div>
            </div>

            {/* Right: Calculations breakdown */}
            <div className="col-span-5 border border-slate-300 rounded-lg p-3 bg-slate-50/40 print:bg-transparent text-xs">
              <div className="space-y-1.5 divide-y divide-slate-200">
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-medium">{formatINR(invoice.subtotal)}</span>
                </div>

                {invoice.overallDiscountAmount > 0 && (
                  <div className="flex justify-between py-0.5 text-emerald-700">
                    <span>Overall Discount:</span>
                    <span className="font-mono font-medium">-{formatINR(invoice.overallDiscountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between py-0.5 font-medium text-slate-800">
                  <span>Taxable Value:</span>
                  <span className="font-mono">{formatINR(invoice.taxableAmount)}</span>
                </div>

                {invoice.isInterState ? (
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Total IGST:</span>
                    <span className="font-mono">{formatINR(invoice.igstTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Total CGST:</span>
                      <span className="font-mono">{formatINR(invoice.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Total SGST:</span>
                      <span className="font-mono">{formatINR(invoice.sgstTotal)}</span>
                    </div>
                  </>
                )}

                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between py-0.5 text-slate-500">
                    <span>Round Off:</span>
                    <span className="font-mono">
                      {invoice.roundOff > 0 ? `+₹${invoice.roundOff}` : `-₹${Math.abs(invoice.roundOff)}`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 font-black text-sm text-slate-900 border-t-2 border-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-base text-blue-950 print:text-black">
                    {formatINR(invoice.grandTotal)}
                  </span>
                </div>

                <div className="flex justify-between py-1 text-slate-700">
                  <span>Paid Amount:</span>
                  <span className="font-mono font-bold text-emerald-700 print:text-black">
                    {formatINR(invoice.paidAmount)}
                  </span>
                </div>

                <div className="flex justify-between py-1 text-slate-800 font-bold">
                  <span>Balance Due:</span>
                  <span
                    className={`font-mono ${
                      invoice.balanceAmount > 0 ? 'text-rose-600 font-black' : 'text-slate-500'
                    }`}
                  >
                    {formatINR(invoice.balanceAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature & Declaration */}
          <div className="pt-6 border-t border-slate-300 flex justify-between items-end mt-4">
            <div className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
              This is a computer generated tax invoice. Subject to {defaultBiz.district || defaultBiz.city || 'Theni'} jurisdiction only.
            </div>
            <div className="text-center">
              <div className="h-12 border-b border-dashed border-slate-400 w-52 mb-1"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 block">
                For {defaultBiz.tradeName || defaultBiz.businessName}
              </span>
              <span className="text-[9px] text-slate-600 block">Authorized Signatory / Proprietor</span>
              {defaultBiz.legalName && (
                <span className="text-[9px] font-semibold text-slate-700 block">
                  ({defaultBiz.legalName})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
