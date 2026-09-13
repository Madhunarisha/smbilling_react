import React, { useState } from 'react';
import {
  FileCheck2,
  Plus,
  Truck,
  Printer,
  Calendar,
  Search,
  CheckCircle2,
  Eye,
  FileText,
  User,
} from 'lucide-react';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

interface QuotationItem {
  id: string;
  quoteNumber: string;
  customerName: string;
  phone: string;
  date: string;
  validUntil: string;
  itemsSummary: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Expired';
}

interface DeliveryChallanItem {
  id: string;
  challanNumber: string;
  customerName: string;
  date: string;
  vehicleNumber: string;
  driverName: string;
  itemsDispatched: string;
  dispatchReason: 'Supply for Order' | 'Warranty Replacement' | 'Demo / Trial';
  status: 'Dispatched' | 'Delivered';
}

export function QuotationsChallans({ initialTab = 'quotes' }: { initialTab?: 'quotes' | 'challans' }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'quotes' | 'challans'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  const [quotations, setQuotations] = useState<QuotationItem[]>([
    {
      id: 'qt-1',
      quoteNumber: 'EST-2026-045',
      customerName: 'Speedex Logistics & Cabs',
      phone: '9811445566',
      date: '2026-09-11',
      validUntil: '2026-09-25',
      itemsSummary: '10x Exide MLDIN45L Battery + Old Scrap Buyback deduction',
      totalAmount: 43500,
      status: 'Sent',
    },
    {
      id: 'qt-2',
      quoteNumber: 'EST-2026-046',
      customerName: 'Apex Motor Works & Garage',
      phone: '9871122334',
      date: '2026-09-12',
      validUntil: '2026-09-26',
      itemsSummary: '5x Amaron Flo 35R + 10x Castrol Magnatec 5W-30',
      totalAmount: 38200,
      status: 'Accepted',
    },
  ]);

  const [challans, setChallans] = useState<DeliveryChallanItem[]>([
    {
      id: 'dc-1',
      challanNumber: 'DC-2026-021',
      customerName: 'Speedex Logistics & Cabs',
      date: '2026-09-12',
      vehicleNumber: 'DL 1L AA 4521 (Tata Ace)',
      driverName: 'Ramesh Kumar',
      itemsDispatched: '6x Exide Heavy Duty Commercial Inverter/Truck Batteries',
      dispatchReason: 'Supply for Order',
      status: 'Dispatched',
    },
    {
      id: 'dc-2',
      challanNumber: 'DC-2026-020',
      customerName: 'Rajesh Sharma',
      date: '2026-09-08',
      vehicleNumber: 'DL 4S 8899 (Store Van)',
      driverName: 'Vicky Singh',
      itemsDispatched: '1x Amaron Flo 35 Ah (FOC Warranty Replacement)',
      dispatchReason: 'Warranty Replacement',
      status: 'Delivered',
    },
  ]);

  const handlePrint = (title: string, num: string) => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-red-600" />
            <span>Quotations &amp; Delivery Challans</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Proforma Estimates, Price Quotes &amp; Battery Goods Dispatch Slips
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('quotes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'quotes'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quotations / Estimates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('challans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'challans'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Delivery Challans
          </button>
        </div>
      </div>

      {/* TAB 1: QUOTATIONS */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quote number or customer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() => showToast('Quotation generator modal ready', 'info')}
              className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Quotation</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Quote Number</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Valid Until</th>
                  <th className="py-3 px-3">Items Summary</th>
                  <th className="py-3 px-3">Total Estimated</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((qt) => (
                  <tr key={qt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{qt.quoteNumber}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{qt.customerName}</div>
                      <div className="text-[10px] text-slate-500">{qt.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{qt.date}</td>
                    <td className="py-3 px-3 text-slate-600">{qt.validUntil}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium max-w-xs truncate">
                      {qt.itemsSummary}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {formatINR(qt.totalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          qt.status === 'Accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : qt.status === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {qt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handlePrint('Quotation', qt.quoteNumber)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Print Quotation"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY CHALLANS */}
      {activeTab === 'challans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700">Goods Dispatch &amp; Delivery Slips</span>
            <button
              type="button"
              onClick={() => showToast('New Delivery Challan creator ready', 'info')}
              className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Delivery Challan</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Challan #</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Dispatch Date</th>
                  <th className="py-3 px-3">Vehicle / Transport</th>
                  <th className="py-3 px-3">Driver</th>
                  <th className="py-3 px-3">Items Dispatched</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challans.map((dc) => (
                  <tr key={dc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{dc.challanNumber}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{dc.customerName}</td>
                    <td className="py-3 px-3 text-slate-600">{dc.date}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">{dc.vehicleNumber}</td>
                    <td className="py-3 px-3 text-slate-600">{dc.driverName}</td>
                    <td className="py-3 px-3 text-slate-700 max-w-xs">{dc.itemsDispatched}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {dc.dispatchReason}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dc.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {dc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handlePrint('Challan', dc.challanNumber)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Print Delivery Slip"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
