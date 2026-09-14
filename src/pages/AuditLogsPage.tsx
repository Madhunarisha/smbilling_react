import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  Printer,
  Trash2,
  Calendar,
  Filter,
  User,
  Clock,
  FileText,
  CreditCard,
  Package,
  Layers,
  Settings,
  LogIn,
  AlertCircle,
  Eye,
  X,
  ChevronRight,
  BookOpen,
  Receipt,
} from 'lucide-react';
import { api } from '../services/api.js';
import { AuditLog } from '../types/index.js';
import { formatDateTime, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

export function AuditLogsPage() {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Clear confirmation modal
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Distinct lists for dropdowns
  const modules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.module && set.add(l.module));
    return ['All', ...Array.from(set).sort()];
  }, [logs]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.action && set.add(l.action));
    return ['All', ...Array.from(set).sort()];
  }, [logs]);

  const users = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.userName && set.add(l.userName));
    return ['All', ...Array.from(set).sort()];
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter
      if (dateFilter !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (dateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      // Module
      if (moduleFilter !== 'All' && log.module.toLowerCase() !== moduleFilter.toLowerCase()) {
        return false;
      }

      // Action
      if (actionFilter !== 'All' && log.action !== actionFilter) {
        return false;
      }

      // User
      if (userFilter !== 'All' && log.userName !== userFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const det = (log.details || '').toLowerCase();
        const usr = (log.userName || '').toLowerCase();
        const act = (log.action || '').toLowerCase();
        const mod = (log.module || '').toLowerCase();
        const rec = (log.recordId || '').toLowerCase();
        if (!det.includes(q) && !usr.includes(q) && !act.includes(q) && !mod.includes(q) && !rec.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, dateFilter, moduleFilter, actionFilter, userFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const today = logs.filter((l) => new Date(l.timestamp).toDateString() === new Date().toDateString()).length;
    const financial = logs.filter((l) => ['Billing', 'Ledgers', 'Stock'].includes(l.module)).length;
    const security = logs.filter((l) => ['Auth', 'Settings', 'System', 'Users'].includes(l.module)).length;
    return { total, today, financial, security };
  }, [logs]);

  // Handle Clear Logs
  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      await api.clearAuditLogs();
      showToast('Audit trail purged successfully', 'success');
      setIsClearModalOpen(false);
      await fetchLogs();
    } catch (err: any) {
      showToast(err.message || 'Failed to clear audit logs', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User ID', 'User Name', 'Module', 'Action', 'Record ID', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${formatDateTime(l.timestamp)}"`,
      `"${l.userId || ''}"`,
      `"${l.userName || ''}"`,
      `"${l.module || ''}"`,
      `"${l.action || ''}"`,
      `"${l.recordId || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit-Logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported audit trail to CSV', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const getModuleBadgeColor = (mod: string) => {
    switch (mod.toLowerCase()) {
      case 'billing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'stock':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ledgers':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'auth':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'settings':
      case 'system':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'returns':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getModuleIcon = (mod: string) => {
    switch (mod.toLowerCase()) {
      case 'billing':
        return <Receipt className="w-3.5 h-3.5" />;
      case 'stock':
        return <Package className="w-3.5 h-3.5" />;
      case 'ledgers':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'auth':
        return <LogIn className="w-3.5 h-3.5" />;
      case 'settings':
      case 'system':
        return <Settings className="w-3.5 h-3.5" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const timeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Audit Logs &amp; Activity Trail
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive tamper-evident record of all invoicing, stock adjustments, ledger entries, and logins
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition-colors border border-rose-200"
            title="Purge logs (Admin)"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Logs</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Logged Events</span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-slate-900 mt-2">{stats.total}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Historical activity entries</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Today's Activity</span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-amber-600 mt-2">{stats.today}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Actions recorded today</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Financial &amp; Stock</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 mt-2">{stats.financial}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Billing, ledgers &amp; stock</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">System &amp; Security</span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-purple-700 mt-2">{stats.security}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Auth, settings &amp; users</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail by description, user, action, invoice #..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
            >
              {modules.map((m) => (
                <option key={m} value={m}>
                  Module: {m}
                </option>
              ))}
            </select>

            {/* User Filter */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
            >
              {users.map((u) => (
                <option key={u} value={u}>
                  User: {u}
                </option>
              ))}
            </select>

            {/* Date Preset */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(moduleFilter !== 'All' || userFilter !== 'All' || dateFilter !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-[11px]">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {moduleFilter !== 'All' && (
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 flex items-center gap-1">
                Module: {moduleFilter}
                <button type="button" onClick={() => setModuleFilter('All')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {userFilter !== 'All' && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-100 flex items-center gap-1">
                User: {userFilter}
                <button type="button" onClick={() => setUserFilter('All')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateFilter !== 'all' && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100 flex items-center gap-1">
                Date: {dateFilter}
                <button type="button" onClick={() => setDateFilter('all')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 flex items-center gap-1">
                Query: "{searchQuery}"
                <button type="button" onClick={() => setSearchQuery('')}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setModuleFilter('All');
                setUserFilter('All');
                setDateFilter('all');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold ml-2 underline"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:bg-white print:border-b-2 print:border-black">
          <div>
            <h2 className="font-black text-sm text-slate-900">
              Activity Logs ({filteredLogs.length} Records)
            </h2>
            <p className="text-xs text-slate-500">Sorted by newest events first</p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            System Time: {new Date().toLocaleTimeString('en-IN')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold print:bg-slate-200">
              <tr>
                <th className="p-3 whitespace-nowrap">Timestamp</th>
                <th className="p-3 whitespace-nowrap">User</th>
                <th className="p-3 whitespace-nowrap">Module</th>
                <th className="p-3 whitespace-nowrap">Action Type</th>
                <th className="p-3">Activity Details</th>
                <th className="p-3 whitespace-nowrap">Record ID</th>
                <th className="p-3 text-right whitespace-nowrap print:hidden">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading activity records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No activity records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800 text-[11px]">
                        {formatDateTime(log.timestamp)}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(log.timestamp)}
                      </div>
                    </td>

                    {/* User */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                          {log.userName ? log.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{log.userName || 'System'}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{log.userId}</span>
                        </div>
                      </div>
                    </td>

                    {/* Module */}
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${getModuleBadgeColor(
                          log.module
                        )}`}
                      >
                        {getModuleIcon(log.module)}
                        {log.module}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                        {log.action}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="p-3 max-w-md text-slate-700">
                      <span className="font-medium text-slate-900">{log.details}</span>
                    </td>

                    {/* Record ID */}
                    <td className="p-3 whitespace-nowrap">
                      {log.recordId ? (
                        <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-600 font-semibold">
                          {log.recordId}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Inspect */}
                    <td className="p-3 text-right whitespace-nowrap print:hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="View log metadata"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Audit Record Inspector</h3>
                  <span className="text-[10px] font-mono text-slate-500">ID: {selectedLog.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Module</span>
                  <span className="font-bold text-slate-900">{selectedLog.module}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Action Type</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Operator / User</span>
                  <span className="font-medium text-slate-900">
                    {selectedLog.userName} ({selectedLog.userId})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Timestamp</span>
                  <span className="font-mono text-slate-800">{formatDateTime(selectedLog.timestamp)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Activity Details Description
                </label>
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 font-medium leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {selectedLog.recordId && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                    Related Entity / Record Reference
                  </label>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono font-bold text-slate-800">
                    {selectedLog.recordId}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Raw JSON Metadata
                </label>
                <pre className="p-3 bg-slate-900 text-amber-300 rounded-xl font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purge / Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-slate-900">Purge Audit Log History?</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to clear all existing audit logs? This action is permanent, though a new log entry
                recording this purge will be created.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearLogs}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isClearing ? 'Purging...' : 'Yes, Purge Logs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
