import React, { useState, useEffect } from 'react';
import {
  Building2,
  Save,
  ShieldAlert,
  CreditCard,
  FileText,
  History,
  RotateCcw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { api } from '../services/api.js';
import { BusinessSettings, AuditLog } from '../types/index.js';
import { formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';

export function SettingsPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'audit' | 'security'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Security Form
  const [credentials, setCredentials] = useState({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Business Profile Form
  const [profile, setProfile] = useState<BusinessSettings>({
    businessName: 'SM AUTOS AND BATTERY',
    tradeName: 'SM AUTOS AND BATTERY',
    legalName: 'HARIHARAN SHANMUGASUNDARAM',
    constitution: 'Proprietorship',
    tagline: 'Automobile Spare Parts & Battery Specialists',
    address: 'NO 5/1, WARD NO 10, ST-3, MELAPUDU THERU, Timmarasanayakkanur',
    buildingNo: 'NO 5/1, WARD NO 10',
    roadStreet: 'ST-3, MELAPUDU THERU',
    locality: 'Timmarasanayakkanur',
    city: 'Aundipatti',
    district: 'Theni',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '625536',
    phone: '+91 9578851650',
    alternatePhone: '+91 98111 22334',
    email: 'billing@smautos.com',
    gstin: '33ARQPH7005P1ZE',
    pan: 'ARQPH7005P',
    invoicePrefix: 'SMA',
    nextInvoiceNumber: 1001,
    termsAndConditions: '1. Goods once sold will only be replaced as per manufacturer warranty policy.\n2. Battery warranty strictly valid with serial number card.\n3. Electrical items carry no testing warranty once installed.\n4. Subject to Theni jurisdiction only.',
    bankName: 'HDFC Bank Ltd',
    bankAccount: '50200012345678',
    ifscCode: 'HDFC0001234',
    bankBranch: 'Aundipatti Branch, Theni',
    upiId: 'smautos@hdfcbank',
    defaultGstRate: 18,
    maxDiscountPercent: 20,
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profData, logsData] = await Promise.all([
          api.getSettings(),
          isAdmin ? api.getAuditLogs() : Promise.resolve([]),
        ]);
        if (profData) setProfile(profData);
        setAuditLogs(logsData);
      } catch (err: any) {
        showToast('Failed to load settings data', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isAdmin]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings(profile);
      setProfile(updated);
      showToast('Business details updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update business profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (credentials.newPassword && credentials.newPassword !== credentials.confirmPassword) {
      showToast('New passwords do not match!', 'error');
      return;
    }
    if (!credentials.currentPassword) {
      showToast('Current password is required to save changes.', 'error');
      return;
    }

    try {
      setSavingCredentials(true);
      await api.updateCredentials({
        currentPassword: credentials.currentPassword,
        newUsername: credentials.newUsername,
        newPassword: credentials.newPassword,
      });
      showToast('Credentials updated successfully!', 'success');
      setCredentials({ newUsername: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      showToast(err.message || 'Failed to update credentials', 'error');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('Reset database back to initial factory demo dataset?')) {
      try {
        await api.resetDatabase();
        showToast('Demo database re-initialized!', 'success');
        window.location.reload();
      } catch (err: any) {
        showToast(err.message || 'Reset failed', 'error');
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            System &amp; Business Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure business identity, GST registration, bank account &amp; inspect security audit trails
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleResetDemoData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Factory Data</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Business Identity &amp; Tax Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'security'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security &amp; Credentials</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'audit'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <History className="w-4 h-4" />
            <span>Security &amp; Audit Trail ({auditLogs.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: Business Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <span>Shop / Enterprise Identity</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trade Name (As per GST Certificate)
                </label>
                <input
                  type="text"
                  required
                  value={profile.tradeName || profile.businessName}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      tradeName: e.target.value,
                      businessName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Name / Proprietor Name
                </label>
                <input
                  type="text"
                  value={profile.legalName || ''}
                  onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                  placeholder="e.g. HARIHARAN SHANMUGASUNDARAM"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Constitution of Business
                </label>
                <input
                  type="text"
                  value={profile.constitution || ''}
                  onChange={(e) => setProfile({ ...profile, constitution: e.target.value })}
                  placeholder="e.g. Proprietorship"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tagline / Sub-heading
                </label>
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Principal Place of Business (Building / Road / Locality)
                </label>
                <input
                  type="text"
                  required
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City / Town / Village
                </label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  District
                </label>
                <input
                  type="text"
                  value={profile.district || ''}
                  onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                  placeholder="e.g. Theni"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={profile.pincode}
                  onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Counter Mobile
                </label>
                <input
                  type="text"
                  required
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* GST & Tax Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Goods &amp; Services Tax (GST) Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN (15 Digits)
                </label>
                <input
                  type="text"
                  required
                  value={profile.gstin}
                  onChange={(e) => {
                    const clean = e.target.value.toUpperCase();
                    const extractedPan = clean.length >= 12 ? clean.slice(2, 12) : profile.pan;
                    const extractedStateCode = clean.length >= 2 ? clean.slice(0, 2) : profile.stateCode;
                    setProfile({
                      ...profile,
                      gstin: clean,
                      pan: extractedPan,
                      stateCode: extractedStateCode,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PAN (Permanent Account Number)
                </label>
                <input
                  type="text"
                  value={profile.pan || ''}
                  onChange={(e) => setProfile({ ...profile, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. ARQPH7005P"
                  className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State Code
                </label>
                <input
                  type="text"
                  value={profile.stateCode}
                  onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Bank & UPI Information for Invoices */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Banking &amp; UPI Payment Details (Printed on Invoices)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={profile.bankName}
                  onChange={(e) => setProfile({ ...profile, bankName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={profile.bankAccount}
                  onChange={(e) => setProfile({ ...profile, bankAccount: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={profile.ifscCode}
                  onChange={(e) =>
                    setProfile({ ...profile, ifscCode: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={profile.bankBranch}
                  onChange={(e) => setProfile({ ...profile, bankBranch: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UPI VPA Handle
                </label>
                <input
                  type="text"
                  value={profile.upiId}
                  onChange={(e) => setProfile({ ...profile, upiId: e.target.value })}
                  placeholder="smautos@okhdfcbank"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Terms &amp; Conditions
              </label>
              <textarea
                rows={3}
                value={profile.termsAndConditions}
                onChange={(e) => setProfile({ ...profile, termsAndConditions: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Business Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Audit Logs */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Immutable Action Log
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Details / Modifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{log.userName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{log.module}</td>
                      <td className="p-3 text-slate-600 max-w-sm truncate">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Security & Credentials */}
      {activeTab === 'security' && (
        <form onSubmit={handleSecuritySubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 max-w-2xl mx-auto">
            <div className="flex flex-col mb-4 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-500" />
                <span>Update Login Credentials</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                You can update your username and/or password here. Your current password is required for any changes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Username (Optional)
              </label>
              <input
                type="text"
                value={credentials.newUsername}
                onChange={(e) => setCredentials({ ...credentials, newUsername: e.target.value })}
                placeholder="Leave blank to keep current username"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (Optional)
              </label>
              <input
                type="password"
                value={credentials.newPassword}
                onChange={(e) => setCredentials({ ...credentials, newPassword: e.target.value })}
                placeholder="Leave blank to keep current password"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium bg-slate-50 focus:bg-white"
              />
            </div>

            {credentials.newPassword && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={credentials.confirmPassword}
                  onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium bg-slate-50 focus:bg-white"
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={credentials.currentPassword}
                onChange={(e) => setCredentials({ ...credentials, currentPassword: e.target.value })}
                placeholder="Enter current password to save changes"
                className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg font-medium bg-rose-50 focus:bg-white"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingCredentials}
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{savingCredentials ? 'Saving...' : 'Update Credentials'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
