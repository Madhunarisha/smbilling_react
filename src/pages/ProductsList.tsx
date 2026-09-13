import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Boxes,
  AlertTriangle,
  Package,
  RefreshCw,
  TrendingUp,
  Tag,
  Barcode,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, Category, Supplier } from '../types/index.js';
import { formatINR } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { ProductModal } from '../components/ProductModal.js';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

interface ProductsListProps {
  onOpenStockAdjustment: (product?: Product) => void;
}

export function ProductsList({ onOpenStockAdjustment }: ProductsListProps) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatus, setStockStatus] = useState('all');

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats, sups] = await Promise.all([
        api.getProducts({
          q: searchQuery,
          category: selectedCategory === 'All' ? undefined : selectedCategory,
          stockStatus: stockStatus === 'all' ? undefined : stockStatus,
        }),
        api.getCategories(),
        api.getSuppliers(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err: any) {
      showToast(err.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, stockStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (editingProduct) {
      const updated = await api.updateProduct(editingProduct.id, productData);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(`Product "${updated.name}" updated successfully!`, 'success');
    } else {
      const created = await api.createProduct(productData);
      setProducts((prev) => [created, ...prev]);
      showToast(`Product "${created.name}" added to catalog!`, 'success');
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await api.deleteProduct(productToDelete.id);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      showToast(`Product "${productToDelete.name}" deleted`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete product', 'error');
    } finally {
      setProductToDelete(null);
    }
  };

  // Inventory value summary
  const totalItemsCount = products.reduce((acc, p) => acc + p.currentStock, 0);
  const totalValuation = products.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const lowStockCount = products.filter((p) => p.currentStock <= p.minStockLevel && p.currentStock > 0).length;
  const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Products &amp; Inventory Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automotive Batteries, Genuine Spare Parts, Lubricants &amp; Accessories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md shadow-red-950/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Unique SKUs
          </span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1">{products.length}</div>
          <span className="text-[11px] text-slate-500">{totalItemsCount} units in godown</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Inventory Valuation
          </span>
          <div className="text-xl font-black font-mono text-blue-700 mt-1">
            {formatINR(totalValuation)}
          </div>
          <span className="text-[11px] text-slate-500">At purchase cost</span>
        </div>

        <div
          onClick={() => setStockStatus('low')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-red-400 cursor-pointer transition-colors"
        >
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wider block">
            Low Stock Alerts
          </span>
          <div className="text-xl font-black font-mono text-red-600 mt-1">{lowStockCount}</div>
          <span className="text-[11px] text-red-700 font-medium">Reorder required</span>
        </div>

        <div
          onClick={() => setStockStatus('out')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-red-500 cursor-pointer transition-colors"
        >
          <span className="text-xs font-semibold text-red-800 uppercase tracking-wider block">
            Out of Stock
          </span>
          <div className="text-xl font-black font-mono text-red-700 mt-1">{outOfStockCount}</div>
          <span className="text-[11px] text-red-600 font-medium">Zero quantity</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by part name, SKU, brand, model or barcode..."
              className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Stock Status Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Stock' },
              { id: 'in', label: 'In Stock' },
              { id: 'low', label: 'Low Alert' },
              { id: 'out', label: 'Out of Stock' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStockStatus(st.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  stockStatus === st.id
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {['All', ...categories.map((c) => c.name)].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">SKU &amp; Barcode</th>
                <th className="p-3">Product Name &amp; Model</th>
                <th className="p-3">Category</th>
                <th className="p-3">Brand</th>
                <th className="p-3 text-right">Cost (₹)</th>
                <th className="p-3 text-right">Selling (₹)</th>
                <th className="p-3 text-right">Margin</th>
                <th className="p-3 text-center">GST %</th>
                <th className="p-3 text-center">Stock Level</th>
                <th className="p-3 text-center">Warranty</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Loading inventory catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No matching products found in catalog.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.currentStock <= p.minStockLevel && p.currentStock > 0;
                  const isOut = p.currentStock <= 0;
                  const marginAmount = p.sellingPrice - p.purchasePrice;
                  const marginPercent =
                    p.purchasePrice > 0 ? ((marginAmount / p.purchasePrice) * 100).toFixed(0) : '0';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold font-mono text-slate-900">{p.sku}</div>
                        {p.barcode && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Barcode className="w-3 h-3" />
                            <span>{p.barcode}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{p.name}</div>
                        {p.modelNumber && (
                          <div className="text-[11px] text-slate-500">Model: {p.modelNumber}</div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {p.category}
                        </span>
                      </td>

                      <td className="p-3 font-semibold text-slate-800">{p.brand}</td>

                      <td className="p-3 text-right font-mono text-slate-600">
                        {p.purchasePrice.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {p.sellingPrice.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                        +{marginPercent}%
                      </td>

                      <td className="p-3 text-center font-mono font-medium text-slate-700">
                        {p.gstRate}%
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${
                            isOut
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.warrantyPeriod || 'N/A'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Stock Refill */}
                          <button
                            type="button"
                            onClick={() => onOpenStockAdjustment(p)}
                            title="Adjust / Refill Stock"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>

                          {/* Edit Product */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsProductModalOpen(true);
                            }}
                            title="Edit Product"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Product (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setProductToDelete(p)}
                              title="Delete Product"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
        suppliers={suppliers}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        title="Delete Product from Inventory?"
        message={`Are you sure you want to permanently delete "${productToDelete?.name}" (${productToDelete?.sku}) from the catalog?`}
        confirmText="Yes, Delete"
        isDangerous={true}
        onConfirm={handleDeleteProduct}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
