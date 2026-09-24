import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { Invoice, BusinessSettings } from '../types/index.js';
import {
  numberToWordsINR,
  formatTallyDate,
  formatTallyCurrency,
} from '../utils/formatters.js';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings?: BusinessSettings | null;
  onShareWhatsApp?: (inv: Invoice) => void;
  onAddPayment?: (inv: Invoice) => void;
}

export function InvoicePrintModal({
  isOpen,
  onClose,
  invoice,
  settings,
  onShareWhatsApp,
  onAddPayment,
}: InvoicePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const defaultBiz: BusinessSettings = {
    businessName: 'SM AUTOS & BATTERY',
    legalName: 'SM AUTOS & BATTERY',
    tradeName: 'SM AUTOS & BATTERY',
    constitution: 'Proprietorship',
    tagline: 'Complete Auto Solutions',
    address: 'No:5/1, Mela Pudu Theru, Thimmarasanayakkanur, Aundipatti',
    buildingNo: 'No:5/1',
    roadStreet: 'Mela Pudu Theru',
    locality: 'Thimmarasanayakkanur, Aundipatti',
    city: 'Theni',
    district: 'Theni',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '625536',
    phone: '+91 9578851650',
    alternatePhone: '',
    email: 'contact@smautos.com',
    gstin: '33ARQPH7005P1ZE',
    pan: '',
    invoicePrefix: 'SM AUTOS & BATTERY',
    nextInvoiceNumber: 1000,
    termsAndConditions: 'Goods once sold will not be taken back.',
    bankName: 'HDFC Bank',
    bankAccount: '12345678901234',
    ifscCode: 'HDFC0001234',
    bankBranch: 'Main Branch',
    upiId: 'smautos@hdfcbank',
    defaultGstRate: 18,
    maxDiscountPercent: 20,
  };

  // Merge API settings — map all known API key names into the biz object
  const apiSettings = (settings || {}) as BusinessSettings;
  const biz: BusinessSettings = {
    ...defaultBiz,
    ...apiSettings,
    // Ensure these keys are always populated from API if available
    businessName: apiSettings.businessName || defaultBiz.businessName,
    legalName: apiSettings.legalName || apiSettings.businessName || defaultBiz.businessName,
    tradeName: apiSettings.tradeName || apiSettings.businessName || defaultBiz.businessName,
    tagline: apiSettings.tagline || defaultBiz.tagline,
    address: apiSettings.address || defaultBiz.address,
    city: apiSettings.city || defaultBiz.city,
    state: apiSettings.state || defaultBiz.state,
    stateCode: String(apiSettings.stateCode || defaultBiz.stateCode),
    pincode: apiSettings.pincode || defaultBiz.pincode,
    phone: apiSettings.phone || defaultBiz.phone,
    email: apiSettings.email || defaultBiz.email,
    gstin: apiSettings.gstin || defaultBiz.gstin,
    bankName: apiSettings.bankName || defaultBiz.bankName,
    bankAccount: apiSettings.bankAccount || defaultBiz.bankAccount,
    ifscCode: apiSettings.ifscCode || defaultBiz.ifscCode,
    bankBranch: apiSettings.bankBranch || defaultBiz.bankBranch,
    upiId: apiSettings.upiId || defaultBiz.upiId,
    termsAndConditions: apiSettings.termsAndConditions || defaultBiz.termsAndConditions,
  };

  // Buyer / Customer details
  const customerName = invoice.customerName || 'Cash Sale';
  const customerAddress =
    invoice.billingAddress || invoice.shippingAddress || 'THENI';
  const customerGstin = invoice.customerGstin || '';

  // Determine Customer State
  let customerState = 'Tamil Nadu';
  let customerStateCode = '33';
  if (customerGstin && customerGstin.length >= 2) {
    const code = customerGstin.substring(0, 2);
    if (code === '33') {
      customerState = 'Tamil Nadu';
      customerStateCode = '33';
    } else {
      customerStateCode = code;
    }
  }

  // Totals & calculations
  const safeItems = Array.isArray(invoice.items) ? invoice.items.filter(Boolean) : [];
  const totalQuantity = safeItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0),
    0
  );
  const firstUnit = safeItems[0]?.unit || 'NOS';

  // Overall tax amount
  const totalTaxAmount = invoice.isInterState
    ? invoice.igstTotal
    : invoice.cgstTotal + invoice.sgstTotal;

  // Spacer height to give clean single A4 page fit
  const itemCount = safeItems.length;
  const spacerHeight = Math.max(0, 15 - itemCount * 3);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="invoice-modal-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:block">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 3mm 4mm !important;
          }
          html, body, #root, #root > div, .min-h-screen, .h-screen, .overflow-hidden, .overflow-y-auto {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, main, nav, footer, .print-hide, .print\:hidden, div.print-hide, div.print\:hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            border: none !important;
          }
          .invoice-modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            inset: 0 !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
            z-index: 99999 !important;
          }
          .invoice-modal-card {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: none !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .invoice-printable-wrapper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          .tally-invoice-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .tally-border-box {
            border: 1px solid #000000 !important;
          }
          .tally-border-t {
            border-top: 1px solid #000000 !important;
          }
          .tally-border-b {
            border-bottom: 1px solid #000000 !important;
          }
          .tally-border-r {
            border-right: 1px solid #000000 !important;
          }
          .tally-border-l {
            border-left: 1px solid #000000 !important;
          }
        }
      `}</style>

      <div className="invoice-modal-card bg-slate-100 rounded-xl max-w-4xl w-full flex flex-col my-4 shadow-2xl print:shadow-none print:m-0 print:max-w-none print:w-full print:bg-white overflow-hidden print:block print:rounded-none">
        {/* Top Modal Toolbar (Hidden on print) */}
        <div className="bg-white px-5 py-3 flex items-center justify-between border-b border-slate-200 print-hide print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">
              Tax Invoice Preview
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${invoice.paymentStatus === 'Paid'
                  ? 'bg-emerald-100 text-emerald-700'
                  : invoice.paymentStatus === 'Unpaid'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
            >
              {invoice.paymentStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => onShareWhatsApp(invoice)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                  alt="WhatsApp"
                  className="w-3.5 h-3.5 brightness-0 invert"
                />
                Send WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area Wrapper */}
        <div className="invoice-printable-wrapper overflow-x-auto p-4 sm:p-6 bg-slate-200/60 print:p-0 print:bg-white flex justify-center print:block">
          <div
            ref={printRef}
            className="tally-invoice-page bg-white w-full max-w-[210mm] text-black font-sans text-[11px] leading-tight shadow-md p-4 print:p-0 print:shadow-none"
            style={{ fontFamily: "Arial, Helvetica, 'Segoe UI', sans-serif" }}
          >
            {/* Top Header: "Tax Invoice" */}
            <div className="text-center font-bold text-sm tracking-wide text-black mb-1">
              Tax Invoice
            </div>

            {/* Main Outer Box Border */}
            <div className="tally-border-box border border-black flex flex-col bg-white">
              {/* TOP ROW: Two Columns (Left = Seller & Buyer, Right = Metadata Grid) */}
              <div className="flex tally-border-b border-b border-black">
                {/* LEFT HALF (Supplier & Buyer) */}
                <div className="w-[53%] tally-border-r border-r border-black flex flex-col justify-between">
                  {/* Supplier / Seller Info */}
                  <div className="p-2 space-y-0.5">
                    <div className="font-black text-[15px] tracking-tight text-[#0f2942] uppercase">
                      {biz.tradeName || biz.businessName}
                    </div>
                    <div className="text-[10.5px] uppercase text-slate-900 leading-tight">
                      NO : 5/1 ST-3, MELAPUDU THERU, <br />
                      THIMMARASANAYAKKANUR <br />
                      AUNDIPATTI
                      <br />
                      THENI - 625531
                    </div>
                    <div className="text-[10.5px] pt-0.5">
                      <span className="font-bold">GSTIN/UIN: </span>
                      <span className="font-bold">{biz.gstin}</span>
                    </div>
                    <div className="text-[10.5px]">
                      <span>State Name : </span>
                      <span>{biz.state}</span>
                      <span>, Code : </span>
                      <span>{biz.stateCode}</span>
                    </div>
                    <div className="text-[10.5px]">
                      <span>Contact : </span>
                      <span>{biz.phone}</span>
                    </div>
                    <div className="text-[10.5px]">
                      <span>E-Mail : </span>
                      <span>{biz.email}</span>
                    </div>
                  </div>

                  {/* Horizontal Divider between Seller and Buyer */}
                  <div className="tally-border-t border-t border-black p-2 space-y-0.5 min-h-[90px]">
                    <div className="text-[10px] text-slate-800">
                      Buyer (Bill to)
                    </div>
                    <div className="font-black text-[12.5px] uppercase tracking-tight text-black">
                      {customerName}
                    </div>
                    <div className="text-[10.5px] uppercase text-slate-900">
                      {customerAddress}
                    </div>
                    <div className="text-[10.5px] pt-1">
                      <span className="inline-block w-24">GSTIN/UIN</span>
                      <span>: </span>
                      <span className="font-bold">
                        {customerGstin || '—'}
                      </span>
                    </div>
                    <div className="text-[10.5px]">
                      <span className="inline-block w-24">State Name</span>
                      <span>: </span>
                      <span>{customerState}</span>
                      <span>, Code : </span>
                      <span>{customerStateCode}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT HALF (Invoice & Dispatch Metadata Grid) */}
                <div className="w-[47%] flex flex-col text-[10.5px]">
                  {/* Row 1: Invoice No. & Dated */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[38px]">
                      <div className="text-[9.5px] text-slate-700">
                        Invoice No.
                      </div>
                      <div className="font-bold text-[12px] text-black">
                        {invoice.invoiceNumber}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[38px]">
                      <div className="text-[9.5px] text-slate-700">Dated</div>
                      <div className="font-bold text-[12px] text-black">
                        {formatTallyDate(invoice.date)}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Delivery Note & Mode/Terms of Payment */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Delivery Note
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.deliveryNote || ''}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Mode/Terms of Payment
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.modeOfPayment || invoice.paymentMode || ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Reference No. & Date. & Other References */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Reference No. &amp; Date.
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.referenceNo || ''}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Other References
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.otherReferences || ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Buyer's Order No. & Dated */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Buyer's Order No.
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.buyersOrderNo || ''}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">Dated</div>
                      <div className="font-semibold text-black">
                        {invoice.orderDate
                          ? formatTallyDate(invoice.orderDate)
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Dispatch Doc No. & Delivery Note Date */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Dispatch Doc No.
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.dispatchDocNo || ''}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Delivery Note Date
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.deliveryDate
                          ? formatTallyDate(invoice.deliveryDate)
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Dispatched through & Destination */}
                  <div className="flex tally-border-b border-b border-black">
                    <div className="w-1/2 p-1.5 tally-border-r border-r border-black min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Dispatched through
                      </div>
                      <div className="font-bold text-black">
                        {invoice.dispatchedThrough || 'Saran'}
                      </div>
                    </div>
                    <div className="w-1/2 p-1.5 min-h-[32px]">
                      <div className="text-[9.5px] text-slate-700">
                        Destination
                      </div>
                      <div className="font-semibold text-black">
                        {invoice.destination || ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 7: Terms of Delivery (Spans full right width) */}
                  <div className="p-1.5 flex-1 min-h-[36px]">
                    <div className="text-[9.5px] text-slate-700">
                      Terms of Delivery
                    </div>
                    <div className="text-[10px] text-black">
                      {invoice.termsOfDelivery || ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* ITEMS TABLE */}
              <div className="w-full">
                <table className="w-full border-collapse text-[10.5px] leading-tight">
                  <thead>
                    <tr className="tally-border-b border-b border-black font-bold text-center">
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[4%]">
                        SI<br />No.
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[32%] text-left">
                        Description of Goods
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[8%]">
                        HSN/SAC
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[6%]">
                        GST<br />Rate
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[9%]">
                        Quantity
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[9%] text-right">
                        Rate<br />(Incl. of Tax)
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[9%] text-right">
                        Rate
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[5%]">
                        per
                      </th>
                      <th className="tally-border-r border-r border-black py-1 px-1 w-[6%] text-right">
                        Disc. %
                      </th>
                      <th className="py-1 px-1.5 w-[12%] text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Items List */}
                    {safeItems.map((item, idx) => {
                      const qty = Number(item.quantity) || 1;
                      const taxableAmt =
                        item.taxableAmount !== undefined &&
                          item.taxableAmount !== null
                          ? item.taxableAmount
                          : item.rate * qty;
                      const taxableRate =
                        qty > 0 ? taxableAmt / qty : item.rate;
                      const gstRateVal = item.gstRate || 0;
                      const rateInclTax =
                        item.totalAmount && qty > 0
                          ? item.totalAmount / qty
                          : taxableRate * (1 + gstRateVal / 100);

                      const serial =
                        item.batterySerial || item.barcode || '';

                      return (
                        <tr key={item.id || idx} className="align-top">
                          {/* SI No. */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {idx + 1}
                          </td>

                          {/* Description of Goods */}
                          <td className="tally-border-r border-r border-black py-1 px-1.5">
                            <div className="font-bold text-black uppercase">
                              {item.productName}
                            </div>
                            {serial && (
                              <div className="italic text-[10px] text-slate-800 ml-3">
                                {serial}
                              </div>
                            )}
                          </td>

                          {/* HSN/SAC */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {item.hsnCode || item.sku || ''}
                          </td>

                          {/* GST Rate */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {gstRateVal > 0 ? `${gstRateVal} %` : ''}
                          </td>

                          {/* Quantity */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center font-bold">
                            {qty} {item.unit || 'NOS'}
                          </td>

                          {/* Rate (Incl. of Tax) */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(rateInclTax)}
                          </td>

                          {/* Rate (taxable) */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(taxableRate)}
                          </td>

                          {/* per */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center uppercase">
                            {item.unit || 'NOS'}
                          </td>

                          {/* Disc. % */}
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {item.discountPercent > 0
                              ? `${item.discountPercent}`
                              : ''}
                          </td>

                          {/* Amount */}
                          <td className="py-1 px-1.5 text-right font-semibold">
                            {formatTallyCurrency(taxableAmt)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Intra-State Tax Lines: CGST & SGST inside the table */}
                    {!invoice.isInterState ? (
                      <>
                        <tr className="align-top">
                          <td className="tally-border-r border-r border-black py-0.5 px-1 text-center"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1.5 text-right italic font-bold pr-4">
                            CGST
                          </td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="py-0.5 px-1.5 text-right font-bold">
                            {formatTallyCurrency(invoice.cgstTotal)}
                          </td>
                        </tr>
                        <tr className="align-top">
                          <td className="tally-border-r border-r border-black py-0.5 px-1 text-center"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1.5 text-right italic font-bold pr-4">
                            SGST
                          </td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="py-0.5 px-1.5 text-right font-bold">
                            {formatTallyCurrency(invoice.sgstTotal)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      /* Inter-State Tax Line: IGST */
                      <tr className="align-top">
                        <td className="tally-border-r border-r border-black py-0.5 px-1 text-center"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1.5 text-right italic font-bold pr-4">
                          IGST
                        </td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                        <td className="py-0.5 px-1.5 text-right font-bold">
                          {formatTallyCurrency(invoice.igstTotal)}
                        </td>
                      </tr>
                    )}

                    {/* Round Off Line if applicable */}
                    {Boolean(
                      invoice.roundOff && Math.abs(invoice.roundOff) >= 0.01
                    ) && (
                        <tr className="align-top">
                          <td className="tally-border-r border-r border-black py-0.5 px-1 text-center"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1.5 text-right italic font-bold pr-4">
                            Round Off
                          </td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="tally-border-r border-r border-black py-0.5 px-1"></td>
                          <td className="py-0.5 px-1.5 text-right font-bold">
                            {formatTallyCurrency(invoice.roundOff)}
                          </td>
                        </tr>
                      )}

                    {/* Spacer Row ensuring the vertical column lines run all the way down to Total */}
                    <tr style={{ height: `${spacerHeight}px` }}>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td className="tally-border-r border-r border-black"></td>
                      <td></td>
                    </tr>

                    {/* TOTAL ROW */}
                    <tr className="tally-border-t tally-border-b border-t border-b border-black font-bold">
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1.5 text-right pr-2">
                        Total
                      </td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1 text-center font-bold">
                        {totalQuantity} {firstUnit}
                      </td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="tally-border-r border-r border-black py-1 px-1"></td>
                      <td className="py-1 px-1.5 text-right font-black text-[12px]">
                        ₹ {formatTallyCurrency(invoice.grandTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* AMOUNT CHARGEABLE IN WORDS */}
              <div className="tally-border-b border-b border-black p-1.5">
                <div className="flex justify-between items-center text-[10px] text-slate-800">
                  <span>Amount Chargeable (in words)</span>
                  <span className="italic">E. &amp; O.E</span>
                </div>
                <div className="font-bold text-[11.5px] mt-0.5 text-black">
                  {numberToWordsINR(invoice.grandTotal)}
                </div>
              </div>

              {/* HSN/SAC TAX SUMMARY TABLE */}
              <div className="w-full">
                <table className="w-full border-collapse text-[10px] leading-tight">
                  <thead>
                    {!invoice.isInterState ? (
                      /* Intra-state Header (CGST & SGST/UTGST) */
                      <>
                        <tr className="tally-border-b border-b border-black font-bold text-center">
                          <th
                            rowSpan={2}
                            className="tally-border-r border-r border-black py-1 px-1 w-[38%]"
                          >
                            HSN/SAC
                          </th>
                          <th
                            rowSpan={2}
                            className="tally-border-r border-r border-black py-1 px-1 w-[16%] text-right"
                          >
                            Taxable
                            <br />
                            Value
                          </th>
                          <th
                            colSpan={2}
                            className="tally-border-r border-r border-black py-0.5 px-1 w-[20%]"
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            className="tally-border-r border-r border-black py-0.5 px-1 w-[20%]"
                          >
                            SGST/UTGST
                          </th>
                          <th
                            rowSpan={2}
                            className="py-1 px-1.5 w-[16%] text-right"
                          >
                            Total
                            <br />
                            Tax Amount
                          </th>
                        </tr>
                        <tr className="tally-border-b border-b border-black font-bold text-center">
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[8%]">
                            Rate
                          </th>
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[12%] text-right">
                            Amount
                          </th>
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[8%]">
                            Rate
                          </th>
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[12%] text-right">
                            Amount
                          </th>
                        </tr>
                      </>
                    ) : (
                      /* Inter-state Header (IGST) */
                      <>
                        <tr className="tally-border-b border-b border-black font-bold text-center">
                          <th
                            rowSpan={2}
                            className="tally-border-r border-r border-black py-1 px-1 w-[40%]"
                          >
                            HSN/SAC
                          </th>
                          <th
                            rowSpan={2}
                            className="tally-border-r border-r border-black py-1 px-1 w-[20%] text-right"
                          >
                            Taxable Value
                          </th>
                          <th
                            colSpan={2}
                            className="tally-border-r border-r border-black py-0.5 px-1 w-[24%]"
                          >
                            IGST
                          </th>
                          <th
                            rowSpan={2}
                            className="py-1 px-1.5 w-[16%] text-right"
                          >
                            Total Tax Amount
                          </th>
                        </tr>
                        <tr className="tally-border-b border-b border-black font-bold text-center">
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[10%]">
                            Rate
                          </th>
                          <th className="tally-border-r border-r border-black py-0.5 px-1 w-[14%] text-right">
                            Amount
                          </th>
                        </tr>
                      </>
                    )}
                  </thead>
                  <tbody>
                    {/* Tax Breakdown Data Row */}
                    <tr className="align-top">
                      <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                        {safeItems[0]?.hsnCode ||
                          safeItems[0]?.sku ||
                          ''}
                      </td>
                      <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                        {formatTallyCurrency(invoice.taxableAmount)}
                      </td>
                      {!invoice.isInterState ? (
                        <>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {(safeItems[0]?.gstRate || 18) / 2}%
                          </td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.cgstTotal)}
                          </td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {(safeItems[0]?.gstRate || 18) / 2}%
                          </td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.sgstTotal)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-center">
                            {safeItems[0]?.gstRate || 18}%
                          </td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.igstTotal)}
                          </td>
                        </>
                      )}
                      <td className="py-1 px-1.5 text-right">
                        {formatTallyCurrency(totalTaxAmount)}
                      </td>
                    </tr>

                    {/* Tax Breakdown Total Row */}
                    <tr className="tally-border-t border-t border-black font-bold">
                      <td className="tally-border-r border-r border-black py-1 px-1.5 text-right">
                        Total
                      </td>
                      <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                        {formatTallyCurrency(invoice.taxableAmount)}
                      </td>
                      {!invoice.isInterState ? (
                        <>
                          <td className="tally-border-r border-r border-black py-1 px-1"></td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.cgstTotal)}
                          </td>
                          <td className="tally-border-r border-r border-black py-1 px-1"></td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.sgstTotal)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="tally-border-r border-r border-black py-1 px-1"></td>
                          <td className="tally-border-r border-r border-black py-1 px-1 text-right">
                            {formatTallyCurrency(invoice.igstTotal)}
                          </td>
                        </>
                      )}
                      <td className="py-1 px-1.5 text-right">
                        {formatTallyCurrency(totalTaxAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TAX AMOUNT IN WORDS */}
              <div className="tally-border-t tally-border-b border-t border-b border-black p-1.5 text-[10.5px]">
                <span>Tax Amount (in words) : </span>
                <span className="font-bold">
                  {numberToWordsINR(totalTaxAmount)}
                </span>
              </div>

              {/* FOOTER SECTION: Declaration & Bank Details / Signatory */}
              <div className="flex">
                {/* Left Half: Declaration */}
                <div className="w-[50%] tally-border-r border-r border-black p-2 flex flex-col justify-end">
                  <div className="font-bold text-[10px] underline mb-1">
                    Declaration
                  </div>
                  <div className="text-[9.5px] text-slate-800 leading-tight">
                    We declare that this invoice shows the actual price of the
                    goods described and that all particulars are true and
                    correct.
                  </div>
                </div>

                {/* Right Half: Bank Details & Signatory */}
                <div className="w-[50%] p-2 flex flex-col justify-between">
                  {/* Bank Details */}
                  <div className="text-[10px] space-y-0.5">
                    <div className="font-bold mb-0.5">
                      Company's Bank Details
                    </div>
                    <div className="grid grid-cols-[105px_1fr] gap-x-1">
                      <span>Bank Name</span>
                      <span>
                        : <strong className="font-bold uppercase">{biz.bankName}</strong>
                      </span>
                      <span>A/c No.</span>
                      <span>
                        : <strong className="font-bold">{biz.bankAccount}</strong>
                      </span>
                      <span>Branch &amp; IFS Code</span>
                      <span>
                        : <strong className="font-bold uppercase">{biz.bankBranch} &amp; {biz.ifscCode}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Signatory Box */}
                  <div className="pt-2 flex flex-col items-end">
                    <div className="font-bold text-[10.5px] uppercase">
                      for {biz.tradeName || biz.businessName}
                    </div>
                    <div className="h-6"></div>
                    <div className="font-bold text-[10.5px]">
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Centered Bottom Footer Lines (Outside Box) */}
            <div className="mt-1.5 text-center space-y-0.5">
              <div className="font-bold text-[10.5px] tracking-wider uppercase">
                SUBJECT TO THENI JURISDICTION
              </div>
              <div className="text-[9.5px] text-slate-700">
                This is a Computer Generated Invoice
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 flex justify-end gap-3 print-hide print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
          {invoice.balanceAmount > 0 && onAddPayment && (
            <button
              type="button"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
              onClick={() => {
                onAddPayment(invoice);
                onClose();
              }}
            >
              Add Payment
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
