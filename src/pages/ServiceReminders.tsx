import React, { useState } from 'react';
import {
  BellRing,
  Calendar,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  BatteryCharging,
  Car,
  Filter,
  Search,
  Plus,
} from 'lucide-react';
import { useToast } from '../context/ToastContext.js';

interface ServiceReminderItem {
  id: string;
  customerName: string;
  phone: string;
  vehicleModel: string;
  serviceType: 'Battery Warranty Expiry' | 'Battery Health Checkup' | 'Acid & Water Top-Up' | 'Periodic Car Service';
  batteryModel: string;
  purchaseDate: string;
  dueDate: string;
  status: 'Pending' | 'Sent' | 'Completed';
  notes?: string;
}

export function ServiceReminders() {
  const { showToast } = useToast();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [reminders, setReminders] = useState<ServiceReminderItem[]>([
    {
      id: 'rem-1',
      customerName: 'Gurpreet Singh',
      phone: '9876543210',
      vehicleModel: 'Hyundai Creta 1.5 SX',
      serviceType: 'Battery Health Checkup',
      batteryModel: 'Exide Mileage MLDIN45L (45 Ah)',
      purchaseDate: '2025-09-15',
      dueDate: '2026-09-15',
      status: 'Pending',
      notes: 'Due for 12-month terminal grease and specific gravity check.',
    },
    {
      id: 'rem-2',
      customerName: 'Rajesh Sharma',
      phone: '9899001122',
      vehicleModel: 'Maruti Swift Dzire VXI',
      serviceType: 'Acid & Water Top-Up',
      batteryModel: 'Amaron Flo AAM-FL-00042B20R (35 Ah)',
      purchaseDate: '2026-03-10',
      dueDate: '2026-09-10',
      status: 'Pending',
      notes: '6-month distilled water electrolyte level inspection.',
    },
    {
      id: 'rem-3',
      customerName: 'Speedex Logistics & Cabs',
      phone: '9811445566',
      vehicleModel: 'Tata Ace Gold Fleet (5 Vehicles)',
      serviceType: 'Battery Warranty Expiry',
      batteryModel: 'Exide Jai Kisan 12V 75Ah',
      purchaseDate: '2024-10-01',
      dueDate: '2026-10-01',
      status: 'Pending',
      notes: 'Warranty expiring in 18 days. Offer pro-rata renewal discount.',
    },
    {
      id: 'rem-4',
      customerName: 'Manish Tyagi',
      phone: '9822334455',
      vehicleModel: 'Royal Enfield Classic 350',
      serviceType: 'Battery Warranty Expiry',
      batteryModel: 'Amaron Pro Bike Rider (5 Ah)',
      purchaseDate: '2024-09-20',
      dueDate: '2026-09-20',
      status: 'Sent',
      notes: 'WhatsApp notification delivered.',
    },
  ]);

  const handleSendWhatsApp = (item: ServiceReminderItem) => {
    const message = encodeURIComponent(
      `Dear ${item.customerName}, Greetings from SM Autos & Batteries!\n\nThis is a friendly reminder for your vehicle (${item.vehicleModel}):\nService: ${item.serviceType}\nBattery: ${item.batteryModel}\nDue Date: ${item.dueDate}\n\nVisit us for a free computerized load testing and warranty inspection.\nPhone: +91 98765 43210`
    );
    window.open(`https://wa.me/91${item.phone}?text=${message}`, '_blank');
    setReminders((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'Sent' } : r))
    );
    showToast(`WhatsApp reminder opened for ${item.customerName}`, 'success');
  };

  const handleMarkCompleted = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'Completed' } : r))
    );
    showToast('Service marked as completed!', 'success');
  };

  const filtered = reminders.filter((r) => {
    const matchSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery) ||
      r.vehicleModel.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'all' || r.serviceType === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BellRing className="w-6 h-6 text-red-600" />
            <span>Service Reminders</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Automotive Battery Warranty, Electrolyte Checkup &amp; Periodic Service Alerts
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Upcoming Due Alerts
          </span>
          <div className="text-2xl font-black font-mono text-red-600 mt-1">
            {reminders.filter((r) => r.status === 'Pending').length}
          </div>
          <span className="text-[11px] text-slate-500">Require customer follow-up</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Reminders Sent
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">
            {reminders.filter((r) => r.status === 'Sent').length}
          </div>
          <span className="text-[11px] text-slate-500">Via WhatsApp / SMS</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Serviced / Completed
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
            {reminders.filter((r) => r.status === 'Completed').length}
          </div>
          <span className="text-[11px] text-slate-500">Inspected at shop</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, phone or vehicle..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'Battery Warranty Expiry', 'Battery Health Checkup', 'Acid & Water Top-Up'].map(
            (type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filterType === type
                    ? 'bg-[#c81e3a] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'all' ? 'All Alerts' : type}
              </button>
            )
          )}
        </div>
      </div>

      {/* Reminders List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="py-3 px-4">Customer &amp; Vehicle</th>
              <th className="py-3 px-3">Service Type</th>
              <th className="py-3 px-3">Battery Item</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No service reminders found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{item.customerName}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{item.phone}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-blue-700 flex items-center gap-1 mt-0.5">
                      <Car className="w-3 h-3" />
                      <span>{item.vehicleModel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-1 bg-red-50 text-red-700 font-bold rounded-lg border border-red-200/60 inline-block">
                      {item.serviceType}
                    </span>
                    {item.notes && (
                      <p className="text-[10px] text-slate-500 mt-1 max-w-xs">{item.notes}</p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-800">{item.batteryModel}</div>
                    <div className="text-[10px] text-slate-500">
                      Purchased: {item.purchaseDate}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.dueDate}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'Sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(item)}
                        className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        title="Notify on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                      {item.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => handleMarkCompleted(item.id)}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Mark Done"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Done</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
