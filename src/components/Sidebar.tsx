import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Boxes,
  BellRing,
  FileText,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Wallet,
  CreditCard,
  FileCheck2,
  Truck,
  BarChart3,
  Settings,
  UserCheck,
  ShieldCheck,
  LogOut,
  X,
  ChevronRight,
  PlusCircle,
  BatteryCharging,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export type ActivePage =
  | 'dashboard'
  | 'customers'
  | 'suppliers'
  | 'products'
  | 'stock'
  | 'service_reminders'
  | 'invoices'
  | 'billing'
  | 'purchase_orders'
  | 'purchases'
  | 'purchase_return'
  | 'expenses'
  | 'payments'
  | 'quotations'
  | 'delivery_challans'
  | 'reports'
  | 'settings'
  | 'manage_users'
  | 'roles_permission'
  | 'ledgers'
  | 'returns'
  | 'audit';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavSection {
  category: string;
  items: {
    id: ActivePage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hasSubmenu?: boolean;
    isLogout?: boolean;
  }[];
}

export function Sidebar({ activePage, onNavigate, isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  const sections: NavSection[] = [
    {
      category: 'MAIN',
      items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      category: 'CUSTOMERS',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'suppliers', label: 'Vendors', icon: Building2 },
      ],
    },
    {
      category: 'INVENTORY',
      items: [
        { id: 'products', label: 'Product / Services', icon: Package, hasSubmenu: true },
        { id: 'stock', label: 'Inventory', icon: Boxes },
      ],
    },
    {
      category: 'SERVICE',
      items: [{ id: 'service_reminders', label: 'Service Reminder', icon: BellRing }],
    },
    {
      category: 'SALES',
      items: [
        { id: 'billing', label: 'Invoice', icon: FileText, hasSubmenu: true },
      ],
    },
    {
      category: 'PURCHASES',
      items: [
        { id: 'purchase_orders', label: 'Purchase Orders', icon: ShoppingCart },
        { id: 'purchases', label: 'Purchases', icon: Receipt },
        { id: 'purchase_return', label: 'Purchase Return', icon: RotateCcw },
      ],
    },
    {
      category: 'FINANCE & ACCOUNTS',
      items: [
        { id: 'expenses', label: 'Expenses', icon: Wallet },
        { id: 'payments', label: 'Payments', icon: CreditCard },
      ],
    },
    {
      category: 'QUOTATIONS',
      items: [
        { id: 'quotations', label: 'Quotations', icon: FileCheck2 },
        { id: 'delivery_challans', label: 'Delivery Challans', icon: Truck },
      ],
    },
    {
      category: 'REPORTS',
      items: [{ id: 'reports', label: 'Payment Summary', icon: BarChart3 }],
    },
    {
      category: 'SETTINGS',
      items: [{ id: 'settings', label: 'Settings', icon: Settings }],
    },
    {
      category: 'USER MANAGEMENT',
      items: [
        { id: 'manage_users', label: 'Manage Users', icon: UserCheck, hasSubmenu: true },
        { id: 'roles_permission', label: 'Roles & Permission', icon: ShieldCheck },
        { id: 'dashboard', label: 'Logout', icon: LogOut, isLogout: true },
      ],
    },
  ];

  const handleItemClick = (id: ActivePage, isLogout?: boolean) => {
    if (isLogout) {
      if (window.confirm('Are you sure you want to sign out?')) {
        logout();
      }
      return;
    }
    onNavigate(id);
    onClose();
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Clean White Sidebar Panel Matching Screenshot */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white text-slate-700 border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static print:hidden shadow-xs ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c81e3a] flex items-center justify-center text-white font-black text-sm shadow-xs">
              SM
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                SM AUTOS
              </div>
              <div className="text-[10px] font-bold text-red-600 tracking-widest leading-tight mt-0.5">
                &amp; BATTERIES
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Invoice Button */}
        <div className="p-3 border-b border-slate-100">
          <button
            type="button"
            onClick={() => handleItemClick('billing')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#c81e3a] hover:bg-red-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Add Invoice"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Invoice</span>
          </button>
        </div>

        {/* Navigation Categories and Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {sections.map((sec) => (
            <div key={sec.category} className="space-y-0.5">
              <div className="px-3 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {sec.category}
              </div>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isSelected =
                  activePage === item.id ||
                  (item.id === 'billing' && activePage === 'invoices') ||
                  (item.id === 'purchase_orders' &&
                    (activePage === 'purchases' || activePage === 'purchase_return'));

                return (
                  <button
                    key={`${sec.category}-${item.label}`}
                    type="button"
                    onClick={() => handleItemClick(item.id, item.isLogout)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-[#c81e3a] text-white shadow-xs'
                        : item.isLogout
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected
                            ? 'text-white'
                            : item.isLogout
                            ? 'text-red-500'
                            : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.hasSubmenu && !isSelected && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Online • v2.6</span>
          </div>
          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
            GST ERP
          </span>
        </div>
      </aside>
    </>
  );
}
