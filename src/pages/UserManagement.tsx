import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  KeyRound,
  CheckCircle2,
  XCircle,
  Edit2,
  UserCheck,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  status: 'active' | 'inactive';
  lastLogin: string;
}

export function UserManagement({ initialTab = 'users' }: { initialTab?: 'users' | 'roles' }) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(initialTab);

  const [users, setUsers] = useState<UserRecord[]>([
    {
      id: 'usr-1',
      name: 'Sardar Manjit Singh',
      username: 'admin',
      email: 'manjit@smautos.com',
      role: 'admin',
      status: 'active',
      lastLogin: '2026-09-13 10:15 AM',
    },
    {
      id: 'usr-2',
      name: 'Rohan Sharma',
      username: 'staff',
      email: 'rohan@smautos.com',
      role: 'staff',
      status: 'active',
      lastLogin: '2026-09-13 09:30 AM',
    },
    {
      id: 'usr-3',
      name: 'Harpreet Kaur',
      username: 'harpreet',
      email: 'accounts@smautos.com',
      role: 'manager',
      status: 'active',
      lastLogin: '2026-09-12 05:40 PM',
    },
  ]);

  const permissionMatrix = [
    { module: 'GST Invoicing (Create & Print)', admin: true, manager: true, staff: true },
    { module: 'Stock Adjustment & Movement Logs', admin: true, manager: true, staff: false },
    { module: 'Purchase Bills & Vendor Orders', admin: true, manager: true, staff: false },
    { module: 'Customer & Vendor Ledgers Access', admin: true, manager: true, staff: true },
    { module: 'Delete Invoices / Reset Records', admin: true, manager: false, staff: false },
    { module: 'Financial Reports & Profit Margins', admin: true, manager: true, staff: false },
    { module: 'Bank Accounts & Company Settings', admin: true, manager: false, staff: false },
    { module: 'Manage Users & Permissions', admin: true, manager: false, staff: false },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" />
            <span>User Management &amp; Role Permissions</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Staff Logins, Operational Security Matrix &amp; Multi-Role Controls
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manage Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-[#c81e3a] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Roles &amp; Permission
          </button>
        </div>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-700">Active System Users</span>
            <button
              type="button"
              onClick={() => showToast('Add new user modal ready', 'info')}
              className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">User Name</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Assigned Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">{u.username}</td>
                    <td className="py-3 px-3 text-slate-600">{u.email}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          u.role === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : u.role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{u.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{u.lastLogin}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => showToast(`Edit user details for ${u.name}`, 'info')}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSION MATRIX */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Role Permissions Matrix</span>
            </h3>
            <p className="text-xs text-slate-500">
              Configured access levels per role according to SM Autos &amp; Batteries security policy.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Software Feature / Module</th>
                  <th className="py-3 px-4 text-center font-bold text-red-700">Super Admin</th>
                  <th className="py-3 px-4 text-center font-bold text-blue-700">Store Manager</th>
                  <th className="py-3 px-4 text-center font-bold text-slate-700">Staff / Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissionMatrix.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.module}</td>
                    <td className="py-3 px-4 text-center">
                      {item.admin ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.manager ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.staff ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
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
