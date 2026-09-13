import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  Barcode,
  Search,
  CheckCircle2,
  Building2,
  X,
  CreditCard,
  Printer,
  Share2,
  Inbox,
  AlertCircle,
  FileText,
  List,
  ChevronDown,
  Percent,
  Sparkles,
} from 'lucide-react';
import { Product, Customer, Invoice, PaymentMode } from '../types/index.js';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { formatINR } from '../utils/formatters.js';

interface InvoiceRowItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  unit: string;
  quantity: number;
  rate: number;
  discount: number; // percentage
  tax: number; // GST rate e.g. 0, 5, 12, 18, 28
  amount: number;
  warrantyPeriod?: string;
  batterySerial?: string;
}

interface BankOption {
  id: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
}

interface AddInvoiceProps {
  onInvoiceCreated: (invoice: Invoice, action: 'print' | 'whatsapp' | 'view') => void;
  onNavigateToList?: () => void;
}

// Indian GST State Codes Map for Dynamic Detection
const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
};

export function AddInvoice({ onInvoiceCreated, onNavigateToList }: AddInvoiceProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Products and Customers data
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Next Invoice Number
  const [invoiceNumber, setInvoiceNumber] = useState('SMA000226');

  // Customer details
  const [mobileNumber, setMobileNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Dynamic GST Field (Non-mandatory / Optional)
  const [customerGstin, setCustomerGstin] = useState('');
  const [applyGst, setApplyGst] = useState(true);
  const [isInterState, setIsInterState] = useState(false);
  const [globalGstRate, setGlobalGstRate] = useState<string>('item-wise');
  const [customGstRate, setCustomGstRate] = useState<number>(18);
  const [showCustomGstInput, setShowCustomGstInput] = useState(false);

  // Invoice & Payment details
  const todayStr = new Date().toISOString().split('T')[0];
  const dueDefaultStr = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(dueDefaultStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('Cash');

  // Barcode & Product Selection
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Warranty Dates
  const [warrantyStartDate, setWarrantyStartDate] = useState(todayStr);
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Table Items
  const [items, setItems] = useState<InvoiceRowItem[]>([]);

  // Bank & Notes
  const [banks, setBanks] = useState<BankOption[]>([
    {
      id: 'bank-1',
      bankName: 'HDFC Bank',
      accountNumber: '50200055443322',
      ifsc: 'HDFC0001234',
      branch: 'Main Branch, Delhi',
    },
    {
      id: 'bank-2',
      bankName: 'State Bank of India',
      accountNumber: '30998877665',
      ifsc: 'SBIN0000456',
      branch: 'Commercial Area, Delhi',
    },
    {
      id: 'bank-3',
      bankName: 'ICICI Bank Current A/c',
      accountNumber: '001205009988',
      ifsc: 'ICIC0000012',
      branch: 'Industrial Estate',
    },
  ]);
  const [selectedBankId, setSelectedBankId] = useState('bank-1');
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAcc, setNewBankAcc] = useState('');
  const [newBankIfsc, setNewBankIfsc] = useState('');
  const [newBankBranch, setNewBankBranch] = useState('');

  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Batteries carry manufacturer warranty. Please retain this original tax invoice for warranty claims.\n2. Warranty is void if battery physical damage, electrolyte contamination or serial tampering occurs.\n3. Goods once sold will not be taken back unless covered under manufacturer return terms.'
  );

  // Signature Settings
  const [signatureType, setSignatureType] = useState<'manual' | 'esignature'>('manual');
  const [signatureName, setSignatureName] = useState('SM Autos Authorized Signatory');

  // Add Payment Modal State (triggered by "Payment Now" button)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalPaymentMethod, setModalPaymentMethod] = useState<PaymentMode>('Cash');
  const [modalPaymentAmount, setModalPaymentAmount] = useState<string>('');
  const [modalReceivedDate, setModalReceivedDate] = useState<string>('');
  const [modalPaymentNotes, setModalPaymentNotes] = useState<string>('');

  // Fetch products, customers and settings on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        const [prods, custs, settings] = await Promise.all([
          api.getProducts(),
          api.getCustomers(),
          api.getSettings().catch(() => null),
        ]);
        setProducts(prods);
        setCustomers(custs);

        if (settings) {
          const num = settings.nextInvoiceNumber || 1001;
          const prefix = settings.invoicePrefix || 'SMA';
          setInvoiceNumber(`${prefix}${String(num).padStart(6, '0')}`);
          if (settings.termsAndConditions) {
            setTermsAndConditions(settings.termsAndConditions);
          }
        }
      } catch (err) {
        showToast('Error loading invoice initialization data', 'error');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Customer Auto-Search by Mobile Number
  const handleMobileChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setMobileNumber(clean);
    if (clean.length >= 5) {
      const match = customers.find((c) => c.phone.includes(clean));
      if (match) {
        setSelectedCustomerId(match.id);
        setCustomerName(match.name);
        setAddress(match.address || '');
        if (match.gstin) {
          setCustomerGstin(match.gstin);
          handleGstinChange(match.gstin);
        }
      }
    }
  };

  // Dynamic GSTIN / GST Number Change Handler
  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    setCustomerGstin(clean);

    if (clean.length >= 2) {
      const stateCode = clean.slice(0, 2);
      // Auto-detect inter-state vs intra-state (Delhi state code is 07)
      if (GST_STATE_CODES[stateCode]) {
        if (stateCode !== '07') {
          setIsInterState(true);
        } else {
          setIsInterState(false);
        }
      }
    }
  };

  // Helper to get detected GST state info
  const getGstinStateInfo = () => {
    if (customerGstin.length >= 2) {
      const code = customerGstin.slice(0, 2);
      const stateName = GST_STATE_CODES[code];
      if (stateName) {
        return {
          code,
          name: stateName,
          isLocal: code === '07',
        };
      }
    }
    return null;
  };

  // Dynamic GST Applicability Toggle
  const handleToggleApplyGst = (enabled: boolean) => {
    setApplyGst(enabled);
    if (!enabled) {
      // Set all items tax rate to 0
      setItems((prev) =>
        prev.map((item) => {
          const qty = item.quantity;
          const rate = item.rate;
          const disc = (qty * rate * item.discount) / 100;
          const taxable = qty * rate - disc;
          return {
            ...item,
            tax: 0,
            amount: Math.round(taxable * 100) / 100,
          };
        })
      );
      showToast('GST disabled: Invoice set to 0% (Tax Exempted)', 'info');
    } else {
      // Restore default GST rates from original products
      setItems((prev) =>
        prev.map((item) => {
          const origProduct = products.find((p) => p.id === item.productId);
          const restoredTax =
            globalGstRate === 'custom'
              ? customGstRate
              : globalGstRate !== 'item-wise'
              ? parseFloat(globalGstRate) || 18
              : origProduct?.gstRate ?? 18;

          const qty = item.quantity;
          const rate = item.rate;
          const disc = (qty * rate * item.discount) / 100;
          const taxable = qty * rate - disc;
          const taxAmt = (taxable * restoredTax) / 100;
          return {
            ...item,
            tax: restoredTax,
            amount: Math.round((taxable + taxAmt) * 100) / 100,
          };
        })
      );
      showToast('GST enabled: Rates recalculated', 'info');
    }
  };

  // Apply Global GST Rate across all items dynamically
  const handleApplyGlobalGstRate = (rateKey: string) => {
    setGlobalGstRate(rateKey);
    if (rateKey === 'custom') {
      setShowCustomGstInput(true);
      return;
    }
    setShowCustomGstInput(false);

    let targetTaxRate: number | null = null;
    if (rateKey !== 'item-wise') {
      targetTaxRate = parseFloat(rateKey) || 0;
    }

    setItems((prev) =>
      prev.map((item) => {
        const origProduct = products.find((p) => p.id === item.productId);
        const appliedTax =
          targetTaxRate !== null
            ? targetTaxRate
            : origProduct?.gstRate ?? 18;

        const qty = item.quantity;
        const rate = item.rate;
        const disc = (qty * rate * item.discount) / 100;
        const taxable = qty * rate - disc;
        const taxAmt = applyGst ? (taxable * appliedTax) / 100 : 0;

        return {
          ...item,
          tax: applyGst ? appliedTax : 0,
          amount: Math.round((taxable + taxAmt) * 100) / 100,
        };
      })
    );

    if (rateKey !== 'item-wise') {
      showToast(`Applied ${rateKey}% GST across all line items`, 'info');
    } else {
      showToast('Reverted to product-specific GST rates', 'info');
    }
  };

  // Custom GST Rate submission
  const handleCustomGstRateChange = (val: number) => {
    setCustomGstRate(val);
    if (!applyGst) return;

    setItems((prev) =>
      prev.map((item) => {
        const qty = item.quantity;
        const rate = item.rate;
        const disc = (qty * rate * item.discount) / 100;
        const taxable = qty * rate - disc;
        const taxAmt = (taxable * val) / 100;

        return {
          ...item,
          tax: val,
          amount: Math.round((taxable + taxAmt) * 100) / 100,
        };
      })
    );
  };

  // Barcode quick add
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      const cleanBarcode = barcodeInput.trim().toLowerCase();
      const found = products.find(
        (p) =>
          p.barcode?.toLowerCase() === cleanBarcode ||
          p.sku.toLowerCase() === cleanBarcode
      );
      if (found) {
        addProductToTable(found);
        setBarcodeInput('');
        showToast(`Added "${found.name}" via barcode`, 'info');
      } else {
        showToast(`No item matching barcode "${barcodeInput}"`, 'error');
      }
    }
  };

  // Add Product to Table
  const addProductToTable = (product: Product) => {
    // Calculate end date based on warranty period if available
    if (product.warrantyPeriod) {
      const matchMonths = product.warrantyPeriod.match(/(\d+)\s*month/i);
      if (matchMonths) {
        const months = parseInt(matchMonths[1], 10);
        const endD = new Date();
        endD.setMonth(endD.getMonth() + months);
        setWarrantyEndDate(endD.toISOString().split('T')[0]);
      }
    }

    // Determine GST tax rate dynamically
    let initialTax = 0;
    if (applyGst) {
      if (globalGstRate === 'custom') {
        initialTax = customGstRate;
      } else if (globalGstRate !== 'item-wise') {
        initialTax = parseFloat(globalGstRate) || 0;
      } else {
        initialTax = product.gstRate || 18;
      }
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        const gross = newQty * item.rate;
        const discountAmount = (gross * item.discount) / 100;
        const taxable = gross - discountAmount;
        const taxAmount = applyGst ? (taxable * item.tax) / 100 : 0;
        item.quantity = newQty;
        item.amount = Math.round((taxable + taxAmount) * 100) / 100;
        return updated;
      }

      const gross = 1 * product.sellingPrice;
      const discountAmount = (gross * (product.discountPercent || 0)) / 100;
      const taxable = gross - discountAmount;
      const taxAmount = applyGst ? (taxable * initialTax) / 100 : 0;
      const amount = Math.round((taxable + taxAmount) * 100) / 100;

      const newItem: InvoiceRowItem = {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit || 'Nos',
        quantity: 1,
        rate: product.sellingPrice,
        discount: product.discountPercent || 0,
        tax: initialTax,
        amount,
        warrantyPeriod: product.warrantyPeriod,
      };
      return [...prev, newItem];
    });

    setSelectedProductId('');
  };

  const handleProductSelectAndAdd = () => {
    if (!selectedProductId) return;
    const found = products.find((p) => p.id === selectedProductId);
    if (found) {
      addProductToTable(found);
    }
  };

  // Update item field
  const updateItemField = (id: string, field: keyof InvoiceRowItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        const qty = Number(updated.quantity) || 0;
        const rate = Number(updated.rate) || 0;
        const discPct = Number(updated.discount) || 0;
        const taxPct = applyGst ? Number(updated.tax) || 0 : 0;

        const gross = qty * rate;
        const discAmount = (gross * discPct) / 100;
        const taxable = gross - discAmount;
        const taxAmount = (taxable * taxPct) / 100;
        updated.amount = Math.round((taxable + taxAmount) * 100) / 100;
        return updated;
      })
    );
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subAmount = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const taxableAmount = items.reduce((acc, item) => {
    const gross = item.quantity * item.rate;
    const disc = (gross * item.discount) / 100;
    return acc + (gross - disc);
  }, 0);

  const totalGstAmount = applyGst
    ? items.reduce((acc, item) => {
        const gross = item.quantity * item.rate;
        const disc = (gross * item.discount) / 100;
        const taxable = gross - disc;
        return acc + (taxable * item.tax) / 100;
      }, 0)
    : 0;

  // Division of GST for Intra-state (CGST + SGST) vs Inter-state (IGST)
  const cgstAmount = !isInterState && applyGst ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
  const sgstAmount = !isInterState && applyGst ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
  const igstAmount = isInterState && applyGst ? Math.round(totalGstAmount * 100) / 100 : 0;
  const totalAmount = Math.round((taxableAmount + totalGstAmount) * 100) / 100;

  // Add Bank
  const handleAddNewBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBankAcc.trim()) {
      showToast('Please enter bank name and account number', 'error');
      return;
    }
    const newB: BankOption = {
      id: `bank-${Date.now()}`,
      bankName: newBankName.trim(),
      accountNumber: newBankAcc.trim(),
      ifsc: newBankIfsc.trim().toUpperCase(),
      branch: newBankBranch.trim(),
    };
    setBanks((prev) => [...prev, newB]);
    setSelectedBankId(newB.id);
    setShowAddBankModal(false);
    setNewBankName('');
    setNewBankAcc('');
    setNewBankIfsc('');
    setNewBankBranch('');
    showToast('Bank account added successfully', 'success');
  };

  // Trigger Payment Now popup matching reference
  const handleOpenPaymentNowModal = () => {
    if (!customerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Please add at least one product or service to the invoice', 'error');
      return;
    }

    setModalPaymentAmount(totalAmount.toFixed(2));
    setModalPaymentMethod(paymentMethod || 'Cash');
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    setModalReceivedDate(`${day}/${month}/${year}`);
    setModalPaymentNotes(notes || '');
    setShowPaymentModal(true);
  };

  // Process and save invoice from Add Payment modal
  const handleConfirmPaymentAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredAmount = parseFloat(modalPaymentAmount) || 0;
    if (enteredAmount <= 0) {
      showToast('Payment amount must be greater than zero', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const invoicePayload = {
        customerName: customerName.trim(),
        customerPhone: mobileNumber.trim(),
        customerId: selectedCustomerId || undefined,
        customerGstin: customerGstin.trim() || undefined,
        billingAddress: address.trim() || undefined,
        shippingAddress: address.trim() || undefined,
        isInterState: Boolean(isInterState),
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discountPercent: it.discount,
          gstRate: applyGst ? it.tax : 0,
        })),
        paidAmount: Math.min(enteredAmount, totalAmount),
        paymentMode: modalPaymentMethod,
        notes: `${modalPaymentNotes ? modalPaymentNotes + '\n' : ''}${notes ? notes + '\n' : ''}${
          !applyGst ? '[Tax Status: Non-GST / Exempted Sale]\n' : ''
        }Warranty: ${warrantyStartDate} to ${warrantyEndDate}${
          signatureName ? ` | Signatory: ${signatureName}` : ''
        }`,
      };

      const createdInvoice = await api.createInvoice(invoicePayload);
      setShowPaymentModal(false);
      showToast(
        `Invoice ${createdInvoice.invoiceNumber} created and payment of ₹${enteredAmount.toFixed(2)} recorded!`,
        'success'
      );

      onInvoiceCreated(createdInvoice, 'print');
    } catch (err: any) {
      showToast(err.message || 'Failed to save payment and invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Process standard draft/pending invoice save
  const handleSaveInvoice = async (mode: 'save') => {
    if (!customerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Please add at least one product or service to the invoice', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const invoicePayload = {
        customerName: customerName.trim(),
        customerPhone: mobileNumber.trim(),
        customerId: selectedCustomerId || undefined,
        customerGstin: customerGstin.trim() || undefined,
        billingAddress: address.trim() || undefined,
        shippingAddress: address.trim() || undefined,
        isInterState: Boolean(isInterState),
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          barcode: it.barcode,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discountPercent: it.discount,
          gstRate: applyGst ? it.tax : 0,
        })),
        paidAmount: 0,
        paymentMode: paymentMethod,
        notes: `${notes ? notes + '\n' : ''}${
          !applyGst ? '[Tax Status: Non-GST / Exempted Sale]\n' : ''
        }Warranty: ${warrantyStartDate} to ${warrantyEndDate}${
          signatureName ? ` | Signatory: ${signatureName}` : ''
        }`,
      };

      const createdInvoice = await api.createInvoice(invoicePayload);
      showToast(
        `Invoice ${createdInvoice.invoiceNumber} saved as pending!`,
        'success'
      );

      onInvoiceCreated(createdInvoice, 'view');
    } catch (err: any) {
      showToast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (items.length > 0 && !window.confirm('Discard current invoice data?')) {
      return;
    }
    setItems([]);
    setCustomerName('');
    setMobileNumber('');
    setCustomerGstin('');
    setAddress('');
    setNotes('');
    if (onNavigateToList) {
      onNavigateToList();
    }
  };

  const gstinState = getGstinStateInfo();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Add Invoice</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              {applyGst ? (customerGstin ? 'B2B GST Tax Invoice' : 'B2C Retail Invoice') : 'Non-GST / Bill of Supply'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            SM Autos &amp; Batteries • Counter Sales &amp; Battery Tax Invoicing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToList && (
            <button
              type="button"
              onClick={onNavigateToList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <List className="w-3.5 h-3.5 text-slate-600" />
              <span>Invoices List</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Invoice Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        {/* Row 1: Invoice Number, Mobile Number, Customer Name */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              readOnly
              value={invoiceNumber}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 select-all cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => handleMobileChange(e.target.value)}
              placeholder="Enter Mobile Number"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter Customer Name"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium transition-all"
            />
          </div>
        </div>

        {/* Row 2: Address & Dynamic GSTIN Field (Not Mandatory / Optional) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Address */}
          <div className="md:col-span-7">
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
              <span>Address</span>
              <span className="text-[11px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Street / Garage / Delivery Address"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium transition-all resize-y"
            />
          </div>

          {/* Dynamic GST Field (Non-mandatory / Optional) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>GST Number / GSTIN</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </span>
                {customerGstin && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerGstin('');
                      setIsInterState(false);
                    }}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Clear GST
                  </button>
                )}
              </label>

              <div className="relative">
                <input
                  type="text"
                  maxLength={15}
                  value={customerGstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-mono uppercase font-semibold transition-all"
                />
                <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Dynamic GST State Feedback Badge */}
            <div className="mt-1 text-[11px]">
              {customerGstin ? (
                gstinState ? (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        gstinState.isLocal ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    ></span>
                    <span className="font-semibold text-slate-800">
                      {gstinState.name} (Code {gstinState.code})
                    </span>
                    <span className="text-slate-400">•</span>
                    <span
                      className={`font-bold ${
                        gstinState.isLocal ? 'text-emerald-700' : 'text-blue-700'
                      }`}
                    >
                      {gstinState.isLocal
                        ? 'Intra-State (CGST + SGST)'
                        : 'Inter-State (IGST)'}
                    </span>
                  </div>
                ) : (
                  <span className="text-amber-600 font-medium">
                    15-digit GSTIN (First 2 digits = State code)
                  </span>
                )
              ) : (
                <span className="text-slate-400">
                  Leave blank for Retail / Consumer B2C sales
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic GST Application & Tax Modes Control Bar */}
        <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyGst}
                onChange={(e) => handleToggleApplyGst(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#c81e3a]"></div>
              <span className="ml-2.5 text-xs font-bold text-slate-800">
                Apply GST Tax on this Bill
              </span>
            </label>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                applyGst
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {applyGst ? 'GST Active' : '0% Exempt / Non-GST'}
            </span>
          </div>

          {applyGst && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Dynamic GST Rate Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-600 font-medium">Dynamic Rate:</span>
                <select
                  value={globalGstRate}
                  onChange={(e) => handleApplyGlobalGstRate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-[#c81e3a]"
                >
                  <option value="item-wise">Item-wise Default</option>
                  <option value="28">28% (Automotive Batteries)</option>
                  <option value="18">18% (Spares &amp; Lubricants)</option>
                  <option value="12">12% (Accessories)</option>
                  <option value="5">5% (Specialized Parts)</option>
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="custom">Custom Dynamic Rate...</option>
                </select>
              </div>

              {/* Inline Custom GST Rate Input */}
              {showCustomGstInput && (
                <div className="flex items-center gap-1 text-xs">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={customGstRate}
                    onChange={(e) =>
                      handleCustomGstRateChange(parseFloat(e.target.value) || 0)
                    }
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                  />
                  <span className="font-bold text-slate-600">%</span>
                </div>
              )}

              {/* Interstate IGST Toggle */}
              <div className="flex items-center gap-1.5 text-xs pl-2 border-l border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isInterState}
                    onChange={(e) => setIsInterState(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Inter-State (IGST)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Invoice Date, Due Date, Payment Method */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Invoice Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium pr-8"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium pr-8"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMode)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI (QR / PhonePe / GPay)</option>
              <option value="Card">Credit / Debit Card</option>
              <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
              <option value="Credit">Credit / Pay Later</option>
            </select>
          </div>
        </div>

        {/* Row 4: Barcode Scanner Input */}
        <div>
          <div className="relative">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="Scan Barcode... (Press Enter)"
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:bg-white text-slate-900 font-medium"
            />
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Row 5: Product Selection with + button */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Products <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium"
            >
              <option value="">Select Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatINR(p.sellingPrice)} (Stock: {p.currentStock} {p.unit})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleProductSelectAndAdd}
              disabled={!selectedProductId}
              title="Add selected product to invoice table"
              className="w-9 h-9 flex items-center justify-center bg-[#c81e3a] hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Row 6: Warranty Start Date, Warranty End Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Warranty Start Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={warrantyStartDate}
                onChange={(e) => setWarrantyStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium pr-8"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Warranty End Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={warrantyEndDate}
                onChange={(e) => setWarrantyEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium pr-8"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Row 7: Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-3 min-w-[180px]">Product / Service</th>
                <th className="py-3 px-2 min-w-[70px]">Unit</th>
                <th className="py-3 px-2 min-w-[80px]">Quantity</th>
                <th className="py-3 px-2 min-w-[90px]">Rate</th>
                <th className="py-3 px-2 min-w-[80px]">Discount (%)</th>
                <th className="py-3 px-2 min-w-[95px]">
                  <div className="flex items-center gap-1">
                    <span>Tax (%)</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (GST)
                    </span>
                  </div>
                </th>
                <th className="py-3 px-2 min-w-[90px]">Amount</th>
                <th className="py-3 px-2 text-center min-w-[60px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Inbox className="w-10 h-10 stroke-[1.2] mb-2 text-slate-300" />
                      <span className="text-xs font-medium text-slate-400">No data</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.productName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.sku} {item.warrantyPeriod ? `• ${item.warrantyPeriod}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-medium">
                        {item.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemField(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.rate}
                        onChange={(e) =>
                          updateItemField(item.id, 'rate', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount}
                        onChange={(e) =>
                          updateItemField(item.id, 'discount', parseFloat(e.target.value) || 0)
                        }
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-xs text-center"
                      />
                    </td>

                    {/* Dynamic Tax (%) Dropdown with Custom Input Support */}
                    <td className="py-2.5 px-2">
                      {applyGst ? (
                        <select
                          value={item.tax}
                          onChange={(e) =>
                            updateItemField(item.id, 'tax', parseFloat(e.target.value) || 0)
                          }
                          className="px-2 py-1 border border-slate-300 rounded text-xs font-medium focus:ring-1 focus:ring-[#c81e3a]"
                        >
                          <option value="28">28%</option>
                          <option value="18">18%</option>
                          <option value="12">12%</option>
                          <option value="5">5%</option>
                          <option value="0">0% (Nil)</option>
                          {![0, 5, 12, 18, 28].includes(item.tax) && (
                            <option value={item.tax}>{item.tax}% (Custom)</option>
                          )}
                        </select>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-semibold text-slate-500">
                          0% Exempt
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 font-mono font-bold text-slate-900">
                      {formatINR(item.amount)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                        title="Remove product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row 8: Two Column Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200">
          {/* Left Column: Bank Details, Notes, Terms */}
          <div className="lg:col-span-7 space-y-4">
            {/* Select Bank */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Bank
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium"
                >
                  <option value="">Select Bank</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber} ({b.branch})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(true)}
                  className="px-3.5 py-2 bg-[#c81e3a] hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  Add Bank
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter Notes"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium resize-y"
              />
            </div>

            {/* Terms and Conditions */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Terms and Conditions
              </label>
              <textarea
                rows={3}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Enter Terms and Conditions"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium resize-y font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Right Column: Financial Calculations & Signature */}
          <div className="lg:col-span-5 space-y-4">
            {/* Totals Summary Card with Dynamic Tax Rows */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Sub Amount</span>
                <span className="font-mono">{formatINR(subAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span className="font-mono">{formatINR(taxableAmount)}</span>
              </div>

              {/* Dynamic GST Breakdown based on user selection */}
              {applyGst ? (
                isInterState ? (
                  <div className="flex justify-between text-slate-700 font-semibold bg-blue-50/60 px-2 py-1 rounded">
                    <span>IGST (Inter-State)</span>
                    <span className="font-mono text-blue-900">{formatINR(igstAmount)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (Central Tax)</span>
                      <span className="font-mono">{formatINR(cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (State Tax)</span>
                      <span className="font-mono">{formatINR(sgstAmount)}</span>
                    </div>
                  </>
                )
              ) : (
                <div className="flex justify-between text-slate-500 italic bg-slate-100 px-2 py-1 rounded">
                  <span>GST Tax (Exempt / Nil)</span>
                  <span className="font-mono">₹0.00</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                <span>Total Amount</span>
                <span className="font-mono text-slate-950">{formatINR(totalAmount)}</span>
              </div>
            </div>

            {/* Signature Block */}
            <div className="space-y-3 p-3.5 bg-white border border-slate-200 rounded-xl">
              {/* Radio options: Manual Signature vs eSignature */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="signatureType"
                    checked={signatureType === 'manual'}
                    onChange={() => setSignatureType('manual')}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>Manual Signature</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="signatureType"
                    checked={signatureType === 'esignature'}
                    onChange={() => setSignatureType('esignature')}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>eSignature</span>
                </label>
              </div>

              {/* Select Signature Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Select Signature Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium"
                >
                  <option value="SM Autos Authorized Signatory">
                    SM Autos Authorized Signatory
                  </option>
                  <option value="Sardar Manjit Singh (Proprietor)">
                    Sardar Manjit Singh (Proprietor)
                  </option>
                  <option value="Store Manager - Batteries Division">
                    Store Manager - Batteries Division
                  </option>
                </select>
              </div>

              {/* Signature Image preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Signature Image
                </label>
                <div className="h-20 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center p-2 text-center text-xs text-slate-400">
                  <div className="space-y-0.5">
                    <span className="font-mono text-slate-600 font-bold italic block">
                      {signatureType === 'esignature'
                        ? '[ Verified Digital eSignature: SM AUTOS & BATTERIES ]'
                        : 'Authorized Signatory Stamp & Signature'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Auto-affixed on Tax Invoice print
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 9: Bottom Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-500 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || items.length === 0}
            onClick={() => handleSaveInvoice('save')}
            className="px-6 py-2 text-xs sm:text-sm font-bold text-white bg-[#c81e3a] hover:bg-red-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            disabled={submitting || items.length === 0}
            onClick={handleOpenPaymentNowModal}
            className="px-6 py-2 text-xs sm:text-sm font-bold text-white bg-[#c81e3a] hover:bg-red-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            Payment Now
          </button>
        </div>
      </div>

      {/* "Add Payment" Modal matching reference */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 sm:p-7 space-y-4 animate-in fade-in">
            {/* Header: Title + Close Icon */}
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xl font-bold text-slate-900">Add Payment</h2>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmPaymentAndSave} className="space-y-4 text-xs sm:text-sm">
              {/* Row 1: Invoice * | Invoice Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Invoice <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={invoiceNumber}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Invoice Amount
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={totalAmount.toFixed(2)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 2: Balance Amount * | Received Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Balance Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={totalAmount.toFixed(2)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 select-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Received Date
                  </label>
                  <input
                    type="text"
                    value={modalReceivedDate}
                    onChange={(e) => setModalReceivedDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] transition-all"
                  />
                </div>
              </div>

              {/* Row 3: Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <div className="relative">
                  <select
                    value={modalPaymentMethod}
                    onChange={(e) => setModalPaymentMethod(e.target.value as PaymentMode)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 appearance-none pr-10 focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] font-medium transition-all"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (GPay / PhonePe / QR)</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Credit">Credit</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Row 4: Amount * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={modalPaymentAmount}
                  onChange={(e) => setModalPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] transition-all"
                />
              </div>

              {/* Row 5: Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={modalPaymentNotes}
                  onChange={(e) => setModalPaymentNotes(e.target.value)}
                  placeholder="Enter Notes"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] resize-y transition-all"
                />
              </div>

              {/* Bottom Buttons: Cancel & Save */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-2 text-xs sm:text-sm font-semibold text-[#c81e3a] hover:bg-red-50 border border-[#c81e3a] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-7 py-2 text-xs sm:text-sm font-bold text-white bg-[#c81e3a] hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-600" />
                <span>Add Bank Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewBank} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="e.g. Kotak Mahindra Bank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={newBankAcc}
                  onChange={(e) => setNewBankAcc(e.target.value)}
                  placeholder="e.g. 987654321012"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={newBankIfsc}
                    onChange={(e) => setNewBankIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. KKBK0001234"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={newBankBranch}
                    onChange={(e) => setNewBankBranch(e.target.value)}
                    placeholder="e.g. Okhla Branch"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
