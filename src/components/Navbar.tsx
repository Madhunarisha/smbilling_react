import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  PlusCircle,
  LogOut,
  UserCheck,
  Shield,
  AlertTriangle,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { Product } from '../types/index.js';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigateToPos: () => void;
  onNavigateToStock: () => void;
}

export function Navbar({ onToggleSidebar, onNavigateToPos, onNavigateToStock }: NavbarProps) {
  const { user, role, isAdmin, logout, quickSwitchRole } = useAuth();
  const { showToast } = useToast();
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    async function checkLowStock() {
      try {
        const products = await api.getProducts({ stockStatus: 'low' });
        setLowStockProducts(products);
      } catch (e) {
        // Silently catch
      }
    }
    checkLowStock();
    const interval = setInterval(checkLowStock, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleToggle = async () => {
    const nextRole = isAdmin ? 'staff' : 'admin';
    try {
      await quickSwitchRole(nextRole);
      showToast(`Switched active role to ${nextRole.toUpperCase()}`, 'info');
      setShowProfileMenu(false);
    } catch {
      showToast('Failed to switch role', 'error');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5 print:hidden shadow-2xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c81e3a] flex items-center justify-center text-white font-black text-sm shadow-xs">
              SM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 flex items-center gap-1">
                  SM AUTOS <span className="text-[#c81e3a]">&amp; BATTERY</span>
                </span>
                <span className="hidden md:inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  GST Billing
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Add Invoice Button */}
          <button
            type="button"
            onClick={onNavigateToPos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c81e3a] hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Create a new GST sales invoice"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Add Invoice</span>
            <span className="sm:hidden">Invoice</span>
          </button>

          {/* Low Stock Notification Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Stock Alerts"
            >
              <Bell className="w-4 h-4" />
              {lowStockProducts.length > 0 && (
                <span className="absolute 1 top-1 right-1 w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 text-slate-800 z-50 overflow-hidden animate-in fade-in">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase text-slate-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Low Stock Alerts ({lowStockProducts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigateToStock();
                    }}
                    className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    View Inventory
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {lowStockProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      All battery &amp; lubricant stocks healthy!
                    </div>
                  ) : (
                    lowStockProducts.map((prod) => (
                      <div
                        key={prod.id}
                        className="p-3 hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            SKU: {prod.sku}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold shrink-0">
                          {prod.currentStock} {prod.unit} left
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar / User Info Matching Screenshot */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {isAdmin ? 'Super Admin' : user?.name || 'Staff User'}
                </p>
                <p className="text-[10px] text-slate-500 leading-tight font-medium">
                  SM Autos &amp; Batteries
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-xs">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="font-bold text-slate-900">{user?.name || 'Super Admin'}</p>
                  <p className="text-[11px] text-slate-500">{user?.email || 'admin@smautos.com'}</p>
                  <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 uppercase">
                    Role: {role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRoleToggle}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 font-medium text-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <span>Switch to {isAdmin ? 'Staff Mode' : 'Admin Mode'}</span>
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 font-medium text-red-600 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
