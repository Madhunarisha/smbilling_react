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
  RefreshCw,
  Lock,
  Unlock,
  Hash,
  Truck,
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

  // Next Invoice Number: Keep both Auto-generated and Dynamic options
  const [invoiceNumberMode, setInvoiceNumberMode] = useState<'auto' | 'dynamic'>('auto');
  const [autoInvoiceNumber, setAutoInvoiceNumber] = useState('SMA000226');
  const [dynamicInvoiceNumber, setDynamicInvoiceNumber] = useState('');
  const [dynamicPattern, setDynamicPattern] = useState<'date' | 'fiscal' | 'timestamp' | 'random' | 'custom'>('date');
  const [allowAutoEdit, setAllowAutoEdit] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('SMA000226');
  const [editingCustomTaxId, setEditingCustomTaxId] = useState<string | null>(null);

  // Customer details
  const [mobileNumber, setMobileNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [dispatchedThrough, setDispatchedThrough] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Dynamic GST Field (Non-mandatory / Optional)
  const [customerGstin, setCustomerGstin] = useState('');
  const [applyGst, setApplyGst] = useState(true);
  const [gstType, setGstType] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [isInterState, setIsInterState] = useState(false);
  const [globalGstRate, setGlobalGstRate] = useState<string>('item-wise');
  const [customGstRate, setCustomGstRate] = useState<number>(18);
  const [showCustomGstInput, setShowCustomGstInput] = useState(false);

  // Invoice & Payment details
  const todayStr = new Date().toISOString().split('T')[0];
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>('Cash');

  // Barcode & Product Selection
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [priceMode, setPriceMode] = useState<'wholesale' | 'retail'>('wholesale');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Close product search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Warranty Dates
  const [warrantyStartDate, setWarrantyStartDate] = useState(todayStr);
  const [warrantyEndDate, setWarrantyEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Table Items
  const [items, setItems] = useState<InvoiceRowItem[]>([]);

  // Auto-calculate warranty end date based on items and start date
  useEffect(() => {
    // Fetch banks
    const fetchBanks = async () => {
      try {
        const token = localStorage.getItem('smautos_token');
        const res = await fetch('/api/banks', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBanks(data);
          if (data.length > 0) setSelectedBankId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch banks', err);
      }
    };
    fetchBanks();

    let maxMonths = 0;
    items.forEach((item) => {
      if (item.warrantyPeriod) {
        let m = 0;
        const matchMonths = item.warrantyPeriod.match(/(\d+)\s*month/i);
        const matchYears = item.warrantyPeriod.match(/(\d+)\s*year/i);
        if (matchMonths) m = parseInt(matchMonths[1], 10);
        else if (matchYears) m = parseInt(matchYears[1], 10) * 12;
        if (m > maxMonths) maxMonths = m;
      }
    });

    if (maxMonths > 0 && warrantyStartDate) {
      const endD = new Date(warrantyStartDate);
      endD.setMonth(endD.getMonth() + maxMonths);
      setWarrantyEndDate(endD.toISOString().split('T')[0]);
    }
  }, [items, warrantyStartDate]);

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
          const num = settings.nextInvoiceNumber || 1;
          const nextAuto = String(num);
          setAutoInvoiceNumber(nextAuto);
          setInvoiceNumber(nextAuto);
        }
      } catch (err) {
        showToast('Error loading invoice initialization data', 'error');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Generate Dynamic Invoice Number based on chosen pattern
  const generateDynamicNumber = (
    pattern: 'date' | 'fiscal' | 'timestamp' | 'random' | 'custom' = dynamicPattern
  ) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const yy = String(yyyy).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand4 = Math.floor(1000 + Math.random() * 9000);
    const randAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Fiscal year e.g. 26-27
    const currentMonth = now.getMonth() + 1;
    const startYear = currentMonth >= 4 ? yy : String(parseInt(yy, 10) - 1).padStart(2, '0');
    const endYear = currentMonth >= 4 ? String(parseInt(yy, 10) + 1).padStart(2, '0') : yy;
    const fyStr = `${startYear}-${endYear}`;

    let result = '';
    switch (pattern) {
      case 'date':
        result = `${yyyy}${mm}${rand4}`;
        break;
      case 'fiscal':
        result = `${startYear}${endYear}${rand4}`;
        break;
      case 'timestamp':
        result = `${Date.now()}`;
        break;
      case 'random':
        result = `${Math.floor(100000 + Math.random() * 900000)}`;
        break;
      case 'custom':
      default:
        result = `${rand4}`;
        break;
    }
    setDynamicInvoiceNumber(result);
    setInvoiceNumber(result);
    return result;
  };

  // Switch between Auto-generated and Dynamic invoice number
  const handleSwitchInvoiceMode = (mode: 'auto' | 'dynamic') => {
    setInvoiceNumberMode(mode);
    if (mode === 'auto') {
      setInvoiceNumber(autoInvoiceNumber);
      showToast('Switched to Auto-generated sequential invoice number', 'info');
    } else {
      let num = dynamicInvoiceNumber;
      if (!num) {
        num = generateDynamicNumber(dynamicPattern);
      } else {
        setInvoiceNumber(num);
      }
      showToast('Switched to Dynamic invoice number generator', 'info');
    }
  };

  // Sync latest sequence from backend settings
  const handleSyncNextInvoiceNumber = async () => {
    try {
      const settings = await api.getSettings();
      if (settings) {
        const num = settings.nextInvoiceNumber || 1;
        const nextAuto = String(num);
        setAutoInvoiceNumber(nextAuto);
        if (invoiceNumberMode === 'auto') {
          setInvoiceNumber(nextAuto);
        }
        showToast(`Synced latest sequence number: ${nextAuto}`, 'info');
      }
    } catch {
      showToast('Could not sync latest sequence number', 'error');
    }
  };

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
      // Restore default GST rates: 18% (Batteries & Spares), 5% (Specialized Parts)
      setItems((prev) =>
        prev.map((item) => {
          const origProduct = products.find((p) => p.id === item.productId);
          let restoredTax = 18;
          if (globalGstRate === 'custom') {
            restoredTax = customGstRate;
          } else if (globalGstRate === '5') {
            restoredTax = 5;
          } else if (globalGstRate === '18') {
            restoredTax = 18;
          } else {
            // item-wise: specialized parts are 5%, all batteries and spares are 18%
            if (
              origProduct?.gstRate === 5 ||
              origProduct?.category?.toLowerCase().includes('specialized')
            ) {
              restoredTax = 5;
            } else if (origProduct?.gstRate && origProduct.gstRate !== 28 && origProduct.gstRate !== 12) {
              restoredTax = origProduct.gstRate;
            } else {
              restoredTax = 18;
            }
          }

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
      targetTaxRate = parseFloat(rateKey) || 18;
    }

    setItems((prev) =>
      prev.map((item) => {
        const origProduct = products.find((p) => p.id === item.productId);
        let appliedTax = 18;
        if (targetTaxRate !== null) {
          appliedTax = targetTaxRate;
        } else {
          // item-wise default
          if (
            origProduct?.gstRate === 5 ||
            origProduct?.category?.toLowerCase().includes('specialized')
          ) {
            appliedTax = 5;
          } else if (origProduct?.gstRate && origProduct.gstRate !== 28 && origProduct.gstRate !== 12) {
            appliedTax = origProduct.gstRate;
          } else {
            appliedTax = 18;
          }
        }

        const qty = item.quantity;
        const rate = item.rate;
        const gross = qty * rate;
        const disc = (gross * item.discount) / 100;
        let taxable = 0;
        let taxAmt = 0;

        if (applyGst) {
          if (gstType === 'inclusive') {
            const finalInclusive = gross - disc;
            taxable = finalInclusive / (1 + appliedTax / 100);
            taxAmt = finalInclusive - taxable;
          } else {
            taxable = gross - disc;
            taxAmt = (taxable * appliedTax) / 100;
          }
        } else {
          taxable = gross - disc;
        }

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
        const gross = qty * rate;
        const disc = (gross * item.discount) / 100;

        let taxable = 0;
        let taxAmt = 0;
        if (gstType === 'inclusive') {
          const finalInclusive = gross - disc;
          taxable = finalInclusive / (1 + val / 100);
          taxAmt = finalInclusive - taxable;
        } else {
          taxable = gross - disc;
          taxAmt = (taxable * val) / 100;
        }

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

  // Handle Wholesale vs Retail Price Mode change
  const handlePriceModeChange = (newMode: 'wholesale' | 'retail') => {
    setPriceMode(newMode);
    setItems((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const newRate =
          newMode === 'retail'
            ? prod.retailPrice !== undefined && prod.retailPrice > 0
              ? prod.retailPrice
              : prod.mrp || prod.sellingPrice
            : prod.wholesalePrice !== undefined && prod.wholesalePrice > 0
            ? prod.wholesalePrice
            : prod.sellingPrice;

        const qty = item.quantity;
        const gross = qty * newRate;
        const discountAmount = (gross * item.discount) / 100;
        let taxable = gross - discountAmount;
        let taxAmount = 0;

        if (applyGst) {
          if (gstType === 'inclusive') {
            const finalInclusive = gross - discountAmount;
            taxable = finalInclusive / (1 + item.tax / 100);
            taxAmount = finalInclusive - taxable;
          } else {
            taxable = gross - discountAmount;
            taxAmount = (taxable * item.tax) / 100;
          }
        }
        return {
          ...item,
          rate: newRate,
          amount: Math.round((taxable + taxAmount) * 100) / 100,
        };
      })
    );
    showToast(`Switched pricing mode to ${newMode === 'wholesale' ? 'Wholesale Price' : 'Retail Price'}`, 'info');
  };

  // Add Product to Table
  const addProductToTable = (product: Product) => {
    // Determine GST tax rate dynamically (Batteries & spares: 18%, Specialized parts: 5%, or Custom)
    let initialTax = 0;
    if (applyGst) {
      if (globalGstRate === 'custom') {
        initialTax = customGstRate;
      } else if (globalGstRate === '5') {
        initialTax = 5;
      } else if (globalGstRate === '18') {
        initialTax = 18;
      } else {
        if (
          product.gstRate === 5 ||
          product.category?.toLowerCase().includes('specialized')
        ) {
          initialTax = 5;
        } else if (product.gstRate && product.gstRate !== 28 && product.gstRate !== 12) {
          initialTax = product.gstRate;
        } else {
          initialTax = 18;
        }
      }
    }

    const defaultRate =
      priceMode === 'retail'
        ? product.retailPrice !== undefined && product.retailPrice > 0
          ? product.retailPrice
          : product.mrp || product.sellingPrice
        : product.wholesalePrice !== undefined && product.wholesalePrice > 0
        ? product.wholesalePrice
        : product.sellingPrice;

    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        const gross = newQty * item.rate;
        const discountAmount = (gross * item.discount) / 100;
        let taxable = gross - discountAmount;
        let taxAmount = 0;

        if (applyGst) {
          if (gstType === 'inclusive') {
            const finalInclusive = gross - discountAmount;
            taxable = finalInclusive / (1 + item.tax / 100);
            taxAmount = finalInclusive - taxable;
          } else {
            taxable = gross - discountAmount;
            taxAmount = (taxable * item.tax) / 100;
          }
        }
        item.quantity = newQty;
        item.amount = Math.round((taxable + taxAmount) * 100) / 100;
        return updated;
      }

      const gross = 1 * defaultRate;
      const discountAmount = (gross * (product.discountPercent || 0)) / 100;
      let taxable = gross - discountAmount;
      let taxAmount = 0;

      if (applyGst) {
        if (gstType === 'inclusive') {
          const finalInclusive = gross - discountAmount;
          taxable = finalInclusive / (1 + initialTax / 100);
          taxAmount = finalInclusive - taxable;
        } else {
          taxable = gross - discountAmount;
          taxAmount = (taxable * initialTax) / 100;
        }
      }
      const amount = Math.round((taxable + taxAmount) * 100) / 100;

      const newItem: InvoiceRowItem = {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit || 'Nos',
        quantity: 1,
        rate: defaultRate,
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

  // Filtered products list for searchable select
  const filteredProductsForSelect = products.filter((p) => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.modelNumber && p.modelNumber.toLowerCase().includes(q)) ||
      p.brand.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });

  const handleSelectProduct = (product: Product) => {
    addProductToTable(product);
    setProductSearchQuery('');
    setSelectedProductId('');
    setIsProductDropdownOpen(false);
  };

  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsProductDropdownOpen(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredProductsForSelect.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isProductDropdownOpen && filteredProductsForSelect.length > 0) {
        const selected = filteredProductsForSelect[highlightedIndex] || filteredProductsForSelect[0];
        if (selected) {
          handleSelectProduct(selected);
        }
      }
    } else if (e.key === 'Escape') {
      setIsProductDropdownOpen(false);
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
        let taxable = gross - discAmount;
        let taxAmount = 0;

        if (applyGst) {
          if (gstType === 'inclusive') {
            const finalInclusive = gross - discAmount;
            taxable = finalInclusive / (1 + taxPct / 100);
            taxAmount = finalInclusive - taxable;
          } else {
            taxable = gross - discAmount;
            taxAmount = (taxable * taxPct) / 100;
          }
        }
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
    if (applyGst && gstType === 'inclusive') {
      const finalInclusive = gross - disc;
      return acc + (finalInclusive / (1 + item.tax / 100));
    }
    return acc + (gross - disc);
  }, 0);

  const totalGstAmount = applyGst
    ? items.reduce((acc, item) => {
      const gross = item.quantity * item.rate;
      const disc = (gross * item.discount) / 100;
      if (gstType === 'inclusive') {
        const finalInclusive = gross - disc;
        const taxb = finalInclusive / (1 + item.tax / 100);
        return acc + (finalInclusive - taxb);
      } else {
        const taxable = gross - disc;
        return acc + (taxable * item.tax) / 100;
      }
    }, 0)
    : 0;

  // Division of GST for Intra-state (CGST + SGST) vs Inter-state (IGST)
  const cgstAmount = !isInterState && applyGst ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
  const sgstAmount = !isInterState && applyGst ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
  const igstAmount = isInterState && applyGst ? Math.round(totalGstAmount * 100) / 100 : 0;
  const totalAmount = Math.round((taxableAmount + totalGstAmount) * 100) / 100;

  // Add Bank
  const handleAddNewBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBankAcc.trim()) {
      showToast('Please enter bank name and account number', 'error');
      return;
    }
    try {
      const token = localStorage.getItem('smautos_token');
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bankName: newBankName.trim(),
          accountNumber: newBankAcc.trim(),
          ifsc: newBankIfsc.trim(),
          branch: newBankBranch.trim()
        })
      });
      if (res.ok) {
        const newB = await res.json();
        setBanks((prev) => [...prev, newB]);
        setSelectedBankId(newB.id);
        setShowAddBankModal(false);
        setNewBankName('');
        setNewBankAcc('');
        setNewBankIfsc('');
        setNewBankBranch('');
        showToast('Bank account added successfully', 'success');
      } else {
        showToast('Failed to add bank', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
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
        invoiceNumber: invoiceNumber.trim() || undefined,
        customerName: customerName.trim(),
        customerPhone: mobileNumber.trim(),
        customerId: selectedCustomerId || undefined,
        customerGstin: customerGstin.trim() || undefined,
        billingAddress: address.trim() || undefined,
        shippingAddress: address.trim() || undefined,
        isInterState: Boolean(isInterState),
        gstType: applyGst ? gstType : 'exclusive',
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
        modeOfPayment: modalPaymentMethod,
        dispatchedThrough: dispatchedThrough.trim() || undefined,
        notes: `${modalPaymentNotes ? modalPaymentNotes + '\n' : ''}${notes ? notes + '\n' : ''}${!applyGst ? '[Tax Status: Non-GST / Exempted Sale]\n' : ''
          }Warranty: ${warrantyStartDate} to ${warrantyEndDate}${signatureName ? ` | Signatory: ${signatureName}` : ''
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
  const handleSaveInvoice = async (action: 'view' | 'print' | 'whatsapp') => {
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
        invoiceNumber: invoiceNumber.trim() || undefined,
        customerName: customerName.trim(),
        customerPhone: mobileNumber.trim(),
        customerId: selectedCustomerId || undefined,
        customerGstin: customerGstin.trim() || undefined,
        billingAddress: address.trim() || undefined,
        shippingAddress: address.trim() || undefined,
        isInterState: Boolean(isInterState),
        gstType: applyGst ? gstType : 'exclusive',
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
        modeOfPayment: paymentMethod,
        dispatchedThrough: dispatchedThrough.trim() || undefined,
        notes: `${notes ? notes + '\n' : ''}${!applyGst ? '[Tax Status: Non-GST / Exempted Sale]\n' : ''
          }Warranty: ${warrantyStartDate} to ${warrantyEndDate}${signatureName ? ` | Signatory: ${signatureName}` : ''
          }`,
      };

      const createdInvoice = await api.createInvoice(invoicePayload);
      showToast(
        `Invoice ${createdInvoice.invoiceNumber} saved as pending!`,
        'success'
      );

      onInvoiceCreated(createdInvoice, action);
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
    setDispatchedThrough('');
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
        {/* Row 1: Invoice Date, Invoice Number, Mobile Number, Customer Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Invoice Date */}
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

          {/* Invoice Number: Auto-generated Options */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>Invoice Number</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={invoiceNumber}
                  readOnly={invoiceNumberMode === 'auto' && !allowAutoEdit}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setInvoiceNumber(val);
                    if (invoiceNumberMode === 'dynamic') {
                      setDynamicInvoiceNumber(val);
                    }
                  }}
                  placeholder={
                    invoiceNumberMode === 'auto' ? 'Auto Sequence' : 'Enter or Roll Dynamic #'
                  }
                  className={`w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold rounded-lg border transition-all ${invoiceNumberMode === 'auto' && !allowAutoEdit
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-white border-purple-400 focus:ring-2 focus:ring-purple-500 text-purple-950'
                    } pr-16`}
                />

                {/* Auto Mode Controls */}
                {invoiceNumberMode === 'auto' && (
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAllowAutoEdit(!allowAutoEdit)}
                      title={allowAutoEdit ? 'Lock Auto Sequence' : 'Unlock to edit sequence'}
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      {allowAutoEdit ? (
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncNextInvoiceNumber}
                      title="Sync next sequence from settings"
                      className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

              </div>
            </div>
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

          {/* Row 2: Address, Dynamic GSTIN Field & Dispatched Through */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Address */}
            <div className="md:col-span-5">
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
            <div className="md:col-span-4 flex flex-col justify-between">
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
                        className={`inline-block w-2 h-2 rounded-full ${gstinState.isLocal ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                      ></span>
                      <span className="font-semibold text-slate-800">
                        {gstinState.name} (Code {gstinState.code})
                      </span>
                      <span className="text-slate-400">•</span>
                      <span
                        className={`font-bold ${gstinState.isLocal ? 'text-emerald-700' : 'text-blue-700'
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

            {/* Dispatched Through Field */}
            <div className="md:col-span-3 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Dispatched Through</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dispatchedThrough}
                    onChange={(e) => setDispatchedThrough(e.target.value)}
                    placeholder="e.g. Saran / Courier / Driver"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium transition-all"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Prints on invoice under dispatch details
              </p>
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
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${applyGst
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                  }`}
              >
                {applyGst ? 'GST Active' : '0% Exempt / Non-GST'}
              </span>

              {applyGst && (
                <select
                  value={gstType}
                  onChange={(e) => {
                    setGstType(e.target.value as 'exclusive' | 'inclusive');
                    showToast(`GST calculation switched to ${e.target.value}`, 'info');
                  }}
                  className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border-none outline-none cursor-pointer"
                >
                  <option value="exclusive">Exclusive</option>
                  <option value="inclusive">Inclusive</option>
                </select>
              )}
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
                    <option value="18">18% (All Batteries &amp; Spares)</option>
                    <option value="5">5% (Specialized Parts)</option>
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

          {/* Pricing Mode Control Bar (Wholesale vs Retail) */}
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Invoice Pricing Rate Mode:</span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({priceMode === 'wholesale' ? 'Applying Wholesale Trade Price' : 'Applying Retail / Consumer Price'})
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => handlePriceModeChange('wholesale')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  priceMode === 'wholesale'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Wholesale Price
              </button>
              <button
                type="button"
                onClick={() => handlePriceModeChange('retail')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  priceMode === 'retail'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Retail Price
              </button>
            </div>
          </div>

          {/* Row 3: Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Row 5: Searchable Product Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Search &amp; Select Product <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-slate-500 font-normal">
                Search by Name, SKU, Model or Brand
              </span>
            </label>
            <div ref={productSearchRef} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setIsProductDropdownOpen(true);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleProductSearchKeyDown}
                  placeholder="Type product name, SKU, model number, brand or barcode to search..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#c81e3a] focus:border-[#c81e3a] text-slate-900 font-medium placeholder:text-slate-400"
                />
                {productSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearchQuery('');
                      setIsProductDropdownOpen(false);
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {isProductDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                  {filteredProductsForSelect.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching products found for "{productSearchQuery}"
                    </div>
                  ) : (
                    filteredProductsForSelect.map((p, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const displayPrice = priceMode === 'retail'
                        ? (p.retailPrice !== undefined && p.retailPrice > 0 ? p.retailPrice : (p.mrp || p.sellingPrice))
                        : (p.wholesalePrice !== undefined && p.wholesalePrice > 0 ? p.wholesalePrice : p.sellingPrice);

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                            isHighlighted ? 'bg-red-50/80 border-l-4 border-[#c81e3a]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                {p.sku}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Brand: {p.brand}</span>
                              {p.modelNumber && <span>• Model: {p.modelNumber}</span>}
                              <span>• Category: {p.category}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-black font-mono text-slate-900">
                              {formatINR(displayPrice)}
                              <span className="text-[10px] font-semibold text-slate-500 ml-1">
                                ({priceMode === 'wholesale' ? 'WS' : 'Retail'})
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold mt-0.5">
                              <span className={p.currentStock <= 0 ? 'text-red-600 font-bold' : 'text-emerald-700'}>
                                {p.currentStock <= 0 ? 'Out of stock' : `${p.currentStock} ${p.unit} in stock`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
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
                          editingCustomTaxId === item.id || ![18, 5].includes(item.tax) ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={item.tax}
                                onChange={(e) =>
                                  updateItemField(item.id, 'tax', parseFloat(e.target.value) || 0)
                                }
                                className="w-14 px-1.5 py-1 border border-amber-400 bg-amber-50/70 rounded text-xs font-bold text-center text-slate-900"
                                placeholder="Rate"
                                autoFocus
                              />
                              <span className="text-[11px] font-bold text-slate-600">%</span>
                              <button
                                type="button"
                                onClick={() => {
                                  updateItemField(item.id, 'tax', 18);
                                  setEditingCustomTaxId(null);
                                }}
                                title="Reset to 18% (Batteries & Spares)"
                                className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer"
                              >
                                18%
                              </button>
                            </div>
                          ) : (
                            <select
                              value={item.tax}
                              onChange={(e) => {
                                if (e.target.value === 'custom') {
                                  setEditingCustomTaxId(item.id);
                                } else {
                                  updateItemField(item.id, 'tax', parseFloat(e.target.value) || 0);
                                }
                              }}
                              className="px-2 py-1 border border-slate-300 rounded text-xs font-medium focus:ring-1 focus:ring-[#c81e3a] bg-white cursor-pointer"
                            >
                              <option value="18">18% (Batteries &amp; Spares)</option>
                              <option value="5">5% (Specialized Parts)</option>
                              <option value="custom">Custom Dynamic Rate...</option>
                            </select>
                          )
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
            {/* Left Column: Bank Details, Notes */}
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

            </div>

            {/* Right Column: Financial Calculations & Signature */}
            <div className="lg:col-span-5 space-y-4">
              {/* Totals Summary Card with Dynamic Tax Rows */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <span className="text-right font-medium">Sub Amount</span>
                  <span className="font-mono text-right">{formatINR(subAmount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <span className="text-right font-medium">Taxable Amount</span>
                  <span className="font-mono text-right">{formatINR(taxableAmount)}</span>
                </div>

                {/* Dynamic GST Breakdown based on user selection */}
                {applyGst ? (
                  isInterState ? (
                    <div className="grid grid-cols-2 gap-4 text-slate-700 font-semibold bg-blue-50/60 px-2 py-1.5 rounded">
                      <span className="text-right">IGST (Inter-State)</span>
                      <span className="font-mono text-right text-blue-900">{formatINR(igstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-slate-600">
                        <span className="text-right font-medium">CGST (Central Tax)</span>
                        <span className="font-mono text-right">{formatINR(cgstAmount)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-slate-600">
                        <span className="text-right font-medium">SGST (State Tax)</span>
                        <span className="font-mono text-right">{formatINR(sgstAmount)}</span>
                      </div>
                    </>
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-slate-500 italic bg-slate-100 px-2 py-1.5 rounded">
                    <span className="text-right">GST Tax (Exempt / Nil)</span>
                    <span className="font-mono text-right">₹0.00</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-base font-black text-slate-900 pt-3 border-t border-slate-300">
                  <span className="text-right">Total Amount</span>
                  <span className="font-mono text-right">{formatINR(totalAmount)}</span>
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
                    <option value="Hariharan S (Proprietor)">
                      Hariharan S (Proprietor)
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
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 flex-wrap">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-500 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex-1"></div>

            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={() => handleSaveInvoice('view')}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Only'}
            </button>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={() => handleSaveInvoice('whatsapp')}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
              Save & WhatsApp
            </button>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={() => handleSaveInvoice('print')}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Save & Print
            </button>
            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={handleOpenPaymentNowModal}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#c81e3a] hover:bg-red-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
