import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider, useToast } from './context/ToastContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, ActivePage } from './components/Sidebar.js';
import { InvoicePrintModal } from './components/InvoicePrintModal.js';
import { WhatsAppShareModal } from './components/WhatsAppShareModal.js';
import { StockAdjustmentModal } from './components/StockAdjustmentModal.js';
import { PaymentModal } from './components/PaymentModal.js';

// Pages
import { LoginPage } from './pages/LoginPage.js';
import { Dashboard } from './pages/Dashboard.js';
import { AddInvoice } from './pages/AddInvoice.js';
import { InvoicesList } from './pages/InvoicesList.js';
import { ProductsList } from './pages/ProductsList.js';
import { StockManagement } from './pages/StockManagement.js';
import { CustomersList } from './pages/CustomersList.js';
import { SuppliersList } from './pages/SuppliersList.js';
import { LedgersPage } from './pages/LedgersPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { ReturnsPage } from './pages/ReturnsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ServiceReminders } from './pages/ServiceReminders.js';
import { PurchaseOrders } from './pages/PurchaseOrders.js';
import { ExpensesPayments } from './pages/ExpensesPayments.js';
import { UserManagement } from './pages/UserManagement.js';

import { Invoice, Product, BusinessSettings } from './types/index.js';
import { api } from './services/api.js';

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const { showToast } = useToast();

  // Default to 'billing' (Add Invoice) or 'dashboard'
  const [currentView, setCurrentView] = useState<ActivePage>('billing');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global Modals
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [whatsAppInvoice, setWhatsAppInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);

  // Stock Adjustment modal triggered globally
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [stockModalTargetProduct, setStockModalTargetProduct] = useState<Product | null>(null);

  // Direct Ledger Navigation
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetSupplierId, setTargetSupplierId] = useState<string | null>(null);

  // Load products and settings
  const loadInitialData = async () => {
    try {
      const [prods, biz] = await Promise.all([
        api.getProducts(),
        api.getSettings().catch(() => null),
      ]);
      setAllProducts(prods);
      if (biz) setBusinessSettings(biz);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#c81e3a] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-4">
          Loading SM Autos System...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleOpenPrintModal = async (invoice: Invoice) => {
    try {
      // Always fetch the full invoice so items are real (not list placeholders)
      const full = await api.getInvoiceById(invoice.id);
      setPrintInvoice(full);
    } catch {
      // Fallback to the passed invoice if fetch fails
      setPrintInvoice(invoice);
    }
  };

  const handleOpenWhatsAppModal = (invoice: Invoice) => {
    setWhatsAppInvoice(invoice);
  };

  const handleOpenStockAdjustment = (product?: Product) => {
    setStockModalTargetProduct(product || null);
    setIsStockModalOpen(true);
  };

  const handleViewCustomerLedger = (customerId: string) => {
    setTargetCustomerId(customerId);
    setTargetSupplierId(null);
    setCurrentView('ledgers');
  };

  const handleViewSupplierLedger = (supplierId: string) => {
    setTargetSupplierId(supplierId);
    setTargetCustomerId(null);
    setCurrentView('ledgers');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onNavigateToPos={() => setCurrentView('billing')}
        onNavigateToStock={() => setCurrentView('stock')}
      />

      {/* Main App Layout */}
      <div className="flex flex-1 relative min-h-[calc(100vh-57px)]">
        {/* Sidebar Matching Requirements */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activePage={currentView}
          onNavigate={(page) => {
            setCurrentView(page);
            if (page !== 'ledgers') {
              setTargetCustomerId(null);
              setTargetSupplierId(null);
            }
          }}
        />

        {/* Dynamic Page Views */}
        <main className={`flex-1 w-full min-w-0 transition-all duration-200 ${printInvoice ? 'print:hidden' : ''}`}>
          {/* Main -> Dashboard */}
          {currentView === 'dashboard' && (
            <Dashboard
              onNavigate={(page) => setCurrentView(page)}
              onOpenPrintModal={handleOpenPrintModal}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onOpenStockModal={handleOpenStockAdjustment}
            />
          )}

          {/* Sales -> Add Invoice (Workflow exactly matching screenshot) */}
          {currentView === 'billing' && (
            <AddInvoice
              onInvoiceCreated={(invoice, action) => {
                if (action === 'print') {
                  setPrintInvoice(invoice);
                } else if (action === 'whatsapp') {
                  setWhatsAppInvoice(invoice);
                }
              }}
              onNavigateToList={() => setCurrentView('invoices')}
            />
          )}

          {/* Sales -> Invoice History List */}
          {currentView === 'invoices' && (
            <InvoicesList
              onOpenPrintModal={handleOpenPrintModal}
              onOpenWhatsAppModal={handleOpenWhatsAppModal}
              onNavigateToBilling={() => setCurrentView('billing')}
            />
          )}

          {/* Inventory -> Product / Services */}
          {currentView === 'products' && (
            <ProductsList onOpenStockAdjustment={handleOpenStockAdjustment} />
          )}

          {/* Inventory -> Inventory Movements */}
          {currentView === 'stock' && <StockManagement />}

          {/* Service -> Service Reminder */}
          {currentView === 'service_reminders' && <ServiceReminders />}

          {/* Customers -> Customers */}
          {currentView === 'customers' && (
            <CustomersList onViewLedger={handleViewCustomerLedger} />
          )}

          {/* Customers -> Vendors */}
          {currentView === 'suppliers' && (
            <SuppliersList onViewLedger={handleViewSupplierLedger} />
          )}

          {/* Purchases -> Purchase Orders */}
          {currentView === 'purchase_orders' && <PurchaseOrders initialTab="orders" />}

          {/* Purchases -> Purchases Bills */}
          {currentView === 'purchases' && <PurchaseOrders initialTab="purchases" />}

          {/* Purchases -> Purchase Return */}
          {currentView === 'purchase_return' && <PurchaseOrders initialTab="return" />}

          {/* Finance & Accounts -> Expenses */}
          {currentView === 'expenses' && <ExpensesPayments initialTab="expenses" />}

          {/* Finance & Accounts -> Payments */}
          {currentView === 'payments' && <ExpensesPayments initialTab="payments" />}

          {/* Reports -> Payment Summary */}
          {currentView === 'reports' && <ReportsPage />}

          {/* Settings -> Settings */}
          {currentView === 'settings' && <SettingsPage />}

          {/* Audit Logs */}
          {currentView === 'audit' && <AuditLogsPage />}

          {/* User Management -> Manage Users */}
          {currentView === 'manage_users' && <UserManagement initialTab="users" />}

          {/* User Management -> Roles & Permission */}
          {currentView === 'roles_permission' && <UserManagement initialTab="roles" />}

          {/* Additional Ledgers & Returns Support */}
          {currentView === 'ledgers' && (
            <LedgersPage
              initialCustomerId={targetCustomerId}
              initialSupplierId={targetSupplierId}
            />
          )}
          {currentView === 'returns' && <ReturnsPage />}
        </main>
      </div>

      {/* Invoice Print & Preview Modal */}
      <InvoicePrintModal
        isOpen={Boolean(printInvoice)}
        onClose={() => setPrintInvoice(null)}
        invoice={printInvoice}
        settings={businessSettings || undefined}
        onShareWhatsApp={(inv) => {
          setWhatsAppInvoice(inv);
        }}
        onAddPayment={(inv) => {
          setPrintInvoice(null);
          setPaymentInvoice(inv);
        }}
      />

      {/* Global Payment Modal */}
      <PaymentModal
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSavePayment={async (invoiceId, paymentData) => {
          await api.recordPayment(invoiceId, paymentData);
          showToast(`Payment recorded successfully!`, 'success');
        }}
      />

      {/* WhatsApp Sharing Dialog */}
      <WhatsAppShareModal
        isOpen={Boolean(whatsAppInvoice)}
        onClose={() => setWhatsAppInvoice(null)}
        invoice={whatsAppInvoice}
      />

      {/* Global Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isStockModalOpen}
        onClose={() => {
          setIsStockModalOpen(false);
          setStockModalTargetProduct(null);
        }}
        products={allProducts}
        selectedProduct={stockModalTargetProduct}
        onSave={async (data) => {
          await api.adjustStock(data);
          showToast('Stock inventory updated successfully!', 'success');
          loadInitialData();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
