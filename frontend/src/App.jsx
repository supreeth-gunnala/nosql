import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Download,
  Boxes,
  DollarSign,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  Save,
  HelpCircle,
  Database
} from 'lucide-react';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [dbName, setDbName] = useState('inventory_management');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Core Data
  const [dashboardData, setDashboardData] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [reportsData, setReportsData] = useState(null);

  // Search & Filter States
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('');

  // Forecasting State
  const [forecastProductId, setForecastProductId] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState(7);
  const [forecastModel, setForecastModel] = useState('moving_average');
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // History Modal State
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // Form Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    unit_price: 0,
    cost_price: 0,
    current_stock: 0,
    minimum_stock: 5,
    supplier_id: '',
  });

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    supplier_id: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    lead_time_days: 7,
  });

  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({
    product_id: '',
    transaction_type: 'purchase',
    quantity: 10,
    unit_price: '',
    notes: '',
  });

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id, title }
  const [seedConfirm, setSeedConfirm] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const checkConnection = useCallback(async () => {
    try {
      const res = await api.checkHealth();
      setDbStatus('connected');
      if (res.database) setDbName(res.database);
    } catch {
      setDbStatus('disconnected');
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async (search = productSearch, category = productCategory, lowStock = lowStockFilter) => {
    try {
      setLoading(true);
      const data = await api.getProducts(search, category, lowStock ? true : null);
      setProducts(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [productSearch, productCategory, lowStockFilter]);

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (type = txnTypeFilter, search = txnSearch) => {
    try {
      setLoading(true);
      const data = await api.getTransactions('', type, search);
      setTransactions(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [txnTypeFilter, txnSearch]);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getRecommendations();
      setRecommendationsData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAlerts();
      setAlertsData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReports();
      setReportsData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch forecast for selected product
  const runForecast = useCallback(async (prodId = forecastProductId, horizon = forecastHorizon, model = forecastModel) => {
    if (!prodId) return;
    try {
      setForecastLoading(true);
      const data = await api.getForecast(prodId, horizon, model);
      setForecastData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setForecastLoading(false);
    }
  }, [forecastProductId, forecastHorizon, forecastModel]);

  // Initial connection check
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Route tab change loader
  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'products') {
      fetchProducts();
      fetchSuppliers();
    }
    if (activeTab === 'suppliers') fetchSuppliers();
    if (activeTab === 'transactions') {
      fetchTransactions();
      fetchProducts();
    }
    if (activeTab === 'forecasting') {
      api.getProducts().then((res) => {
        setProducts(res);
        if (res.length > 0 && !forecastProductId) {
          setForecastProductId(res[0].id);
          runForecast(res[0].id, forecastHorizon, forecastModel);
        }
      });
    }
    if (activeTab === 'recommendations') fetchRecommendations();
    if (activeTab === 'alerts') fetchAlerts();
    if (activeTab === 'reports') {
      fetchReports();
      fetchDashboard();
    }
  }, [activeTab, fetchDashboard, fetchProducts, fetchSuppliers, fetchTransactions, fetchRecommendations, fetchAlerts, fetchReports, forecastHorizon, forecastModel, forecastProductId, runForecast]);

  // Seed handler
  const handleSeedData = async () => {
    try {
      setLoading(true);
      const res = await api.seedData(true);
      showToast(res.message || 'Synthetic inventory data loaded successfully');
      setSeedConfirm(false);
      fetchDashboard();
      fetchProducts();
      fetchSuppliers();
    } catch (err) {
      showToast(err.message, 'error');
      setSeedConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  // Product Handlers
  const handleOpenProductModal = (prod = null) => {
    if (prod) {
      setEditingProduct(prod);
      setProductForm({
        name: prod.name,
        sku: prod.sku,
        category: prod.category,
        description: prod.description || '',
        unit_price: prod.unit_price,
        cost_price: prod.cost_price,
        current_stock: prod.current_stock,
        minimum_stock: prod.minimum_stock,
        supplier_id: prod.supplier_id || '',
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        sku: '',
        category: 'Electronics',
        description: '',
        unit_price: 19.99,
        cost_price: 10.00,
        current_stock: 20,
        minimum_stock: 5,
        supplier_id: suppliers.length > 0 ? suppliers[0].supplier_id : '',
      });
    }
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productForm);
        showToast('Product updated successfully');
      } else {
        await api.addProduct(productForm);
        showToast('Product added successfully');
      }
      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'product') return;
    try {
      await api.deleteProduct(deleteConfirm.id);
      showToast('Product deleted successfully');
      setDeleteConfirm(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteConfirm(null);
    }
  };

  const handleViewHistory = async (prod) => {
    setHistoryProduct(prod);
    try {
      const data = await api.getProductHistory(prod.id);
      setHistoryData(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Supplier Handlers
  const handleOpenSupplierModal = (sup = null) => {
    if (sup) {
      setEditingSupplier(sup);
      setSupplierForm({
        supplier_id: sup.supplier_id,
        name: sup.name,
        contact_person: sup.contact_person || '',
        email: sup.email,
        phone: sup.phone || '',
        lead_time_days: sup.lead_time_days || 7,
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm({
        supplier_id: `SUP-${Math.floor(100 + Math.random() * 900)}`,
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        lead_time_days: 7,
      });
    }
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, supplierForm);
        showToast('Supplier updated successfully');
      } else {
        await api.addSupplier(supplierForm);
        showToast('Supplier registered successfully');
      }
      setIsSupplierModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'supplier') return;
    try {
      await api.deleteSupplier(deleteConfirm.id);
      showToast('Supplier deleted successfully');
      setDeleteConfirm(null);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteConfirm(null);
    }
  };

  // Transaction Handlers
  const handleOpenTxnModal = (type = 'purchase', prodId = '') => {
    const selectedProd = products.find((p) => p.id === prodId) || products[0];
    setTxnForm({
      product_id: selectedProd ? selectedProd.id : '',
      transaction_type: type,
      quantity: 10,
      unit_price: selectedProd
        ? type === 'sale'
          ? selectedProd.unit_price
          : selectedProd.cost_price
        : '',
      notes: '',
    });
    setIsTxnModalOpen(true);
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...txnForm,
        quantity: parseInt(txnForm.quantity, 10),
        unit_price: txnForm.unit_price ? parseFloat(txnForm.unit_price) : undefined,
      };
      await api.createTransaction(payload);
      showToast(`Transaction (${txnForm.transaction_type.toUpperCase()}) recorded successfully`);
      setIsTxnModalOpen(false);
      fetchTransactions();
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveForecastSnapshot = async () => {
    if (!forecastData || !forecastProductId) return;
    try {
      await api.saveForecast(forecastProductId, {
        product_id: forecastProductId,
        horizon_days: forecastHorizon,
        model: forecastModel,
      });
      showToast('Forecast snapshot saved to MongoDB successfully');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Categories helper
  const uniqueCategories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">SI</div>
          <div>
            <h1 className="sidebar-title">SmartInventory</h1>
            <p className="sidebar-subtitle">Intelligence & Demand</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dashboard');
              setIsSidebarOpen(false);
            }}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('products');
              setIsSidebarOpen(false);
            }}
          >
            <Package size={18} />
            Products & Stock
          </button>
          <button
            className={`nav-item ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('suppliers');
              setIsSidebarOpen(false);
            }}
          >
            <Truck size={18} />
            Suppliers
          </button>
          <button
            className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('transactions');
              setIsSidebarOpen(false);
            }}
          >
            <ArrowLeftRight size={18} />
            Transactions
          </button>
          <button
            className={`nav-item ${activeTab === 'forecasting' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('forecasting');
              setIsSidebarOpen(false);
            }}
          >
            <TrendingUp size={18} />
            Demand Forecasting
          </button>
          <button
            className={`nav-item ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('recommendations');
              setIsSidebarOpen(false);
            }}
          >
            <ShoppingCart size={18} />
            Replenishment
          </button>
          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('alerts');
              setIsSidebarOpen(false);
            }}
          >
            <AlertTriangle size={18} />
            Inventory Alerts
          </button>
          <button
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('reports');
              setIsSidebarOpen(false);
            }}
          >
            <FileText size={18} />
            Reports & Export
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="db-badge">
            <span
              className={`db-dot ${dbStatus === 'connected' ? '' : 'disconnected'}`}
            />
            <span>
              {dbStatus === 'connected'
                ? `Atlas: ${dbName}`
                : 'MongoDB Atlas'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <LayoutDashboard size={20} />
            </button>
            <h2 className="page-heading">
              {activeTab === 'dashboard' && 'Inventory Analytics & Intelligence'}
              {activeTab === 'products' && 'Product Catalog & Stock Management'}
              {activeTab === 'suppliers' && 'Supplier Directory & Lead Times'}
              {activeTab === 'transactions' && 'Inventory Transactions (Purchase / Sale / Adjustment)'}
              {activeTab === 'forecasting' && 'Statistical Demand Forecasting'}
              {activeTab === 'recommendations' && 'Automated Replenishment Recommendations'}
              {activeTab === 'alerts' && 'Proactive Inventory Alerts & Exceptions'}
              {activeTab === 'reports' && 'Valuation Reports & Data Export'}
            </h2>
          </div>

          <div className="topbar-right">
            <span className="academic-tag">MongoDB NoSQL Case Study</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                checkConnection();
                if (activeTab === 'dashboard') fetchDashboard();
                if (activeTab === 'products') fetchProducts();
                if (activeTab === 'suppliers') fetchSuppliers();
                if (activeTab === 'transactions') fetchTransactions();
                if (activeTab === 'forecasting') runForecast();
                if (activeTab === 'recommendations') fetchRecommendations();
                if (activeTab === 'alerts') fetchAlerts();
                if (activeTab === 'reports') fetchReports();
              }}
              title="Refresh Current View"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        <main className="content-body">
          {/* ===================== 1. DASHBOARD VIEW ===================== */}
          {activeTab === 'dashboard' && (
            <div>
              {loading && !dashboardData ? (
                <div className="loading-container">
                  <div className="spinner" />
                  <p>Aggregating real-time MongoDB inventory statistics...</p>
                </div>
              ) : (
                <>
                  {/* Top Action Banner when database is empty */}
                  {dashboardData && dashboardData.total_products === 0 && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '1rem 1.5rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <strong>Demo Inventory Database is Ready</strong>
                        <p style={{ fontSize: '0.84rem', color: '#1e40af' }}>
                          Load 20 realistic products, 4 suppliers, and 75 days of synthetic sales transactions to test forecasting and replenishment.
                        </p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSeedConfirm(true)}
                      >
                        <Database size={14} /> Load Synthetic Demo Data
                      </button>
                    </div>
                  )}

                  {/* KPI Cards Grid */}
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-info">
                        <span className="metric-title">Catalog Products</span>
                        <span className="metric-value">{dashboardData?.total_products || 0}</span>
                        <span className="metric-sub">Active SKU items</span>
                      </div>
                      <div className="metric-icon-wrap">
                        <Package size={22} />
                      </div>
                    </div>

                    <div className="metric-card emerald">
                      <div className="metric-info">
                        <span className="metric-title">Total Units in Stock</span>
                        <span className="metric-value">{dashboardData?.total_units_in_stock?.toLocaleString() || 0}</span>
                        <span className="metric-sub">Physical quantity on hand</span>
                      </div>
                      <div className="metric-icon-wrap emerald">
                        <Boxes size={22} />
                      </div>
                    </div>

                    <div className="metric-card purple">
                      <div className="metric-info">
                        <span className="metric-title">Cost Valuation</span>
                        <span className="metric-value">
                          ${dashboardData?.total_inventory_valuation?.toLocaleString() || '0.00'}
                        </span>
                        <span className="metric-sub">
                          Retail: ${dashboardData?.total_potential_retail_value?.toLocaleString() || '0.00'}
                        </span>
                      </div>
                      <div className="metric-icon-wrap purple">
                        <DollarSign size={22} />
                      </div>
                    </div>

                    <div className="metric-card amber">
                      <div className="metric-info">
                        <span className="metric-title">Low Stock Warning</span>
                        <span className="metric-value">{dashboardData?.low_stock_count || 0}</span>
                        <span className="metric-sub">At or below safety minimum</span>
                      </div>
                      <div className="metric-icon-wrap amber">
                        <AlertTriangle size={22} />
                      </div>
                    </div>

                    <div className="metric-card rose">
                      <div className="metric-info">
                        <span className="metric-title">Out of Stock</span>
                        <span className="metric-value">{dashboardData?.out_of_stock_count || 0}</span>
                        <span className="metric-sub">Immediate stockout</span>
                      </div>
                      <div className="metric-icon-wrap rose">
                        <Clock size={22} />
                      </div>
                    </div>
                  </div>

                  {/* 14-Day Sales Velocity & Revenue Chart (SVG) */}
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3 className="card-title">14-Day Sales Velocity Trend</h3>
                        <p className="card-desc">Daily units sold across the catalog (computed via MongoDB $group pipeline)</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <span className="badge badge-info" style={{ gap: '0.5rem' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                          Daily Units Sold
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      {dashboardData?.sales_trend_14_days && dashboardData.sales_trend_14_days.length > 0 ? (
                        <div className="chart-container">
                          {(() => {
                            const trend = dashboardData.sales_trend_14_days;
                            const maxUnits = Math.max(...trend.map((d) => d.units_sold), 10);
                            const width = 800;
                            const height = 180;
                            const padding = 35;
                            const points = trend.map((d, idx) => {
                              const x = padding + (idx / (trend.length - 1)) * (width - 2 * padding);
                              const y = height - padding - (d.units_sold / maxUnits) * (height - 2 * padding);
                              return `${x},${y}`;
                            }).join(' ');

                            return (
                              <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                                {/* Grid Lines */}
                                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
                                <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
                                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />

                                {/* Area Fill */}
                                <polygon
                                  points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
                                  fill="rgba(37, 99, 235, 0.08)"
                                />

                                {/* Polyline */}
                                <polyline
                                  fill="none"
                                  stroke="#2563eb"
                                  strokeWidth="2.5"
                                  points={points}
                                />

                                {/* Data Points & Labels */}
                                {trend.map((d, idx) => {
                                  const x = padding + (idx / (trend.length - 1)) * (width - 2 * padding);
                                  const y = height - padding - (d.units_sold / maxUnits) * (height - 2 * padding);
                                  return (
                                    <g key={idx}>
                                      <circle cx={x} cy={y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                                      <text x={x} y={y - 8} fontSize="9" textAnchor="middle" fill="#1e293b" fontWeight="600">
                                        {d.units_sold}
                                      </text>
                                      <text x={x} y={height - 15} fontSize="9" textAnchor="middle" fill="#64748b">
                                        {d.date.slice(5)}
                                      </text>
                                    </g>
                                  );
                                })}
                              </svg>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <p>No recent sales transactions recorded.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Category Breakdown */}
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <h3 className="card-title">Category Valuation Distribution</h3>
                          <p className="card-desc">Portfolio allocation by inventory cost</p>
                        </div>
                      </div>
                      <div className="card-body">
                        {dashboardData?.categories && dashboardData.categories.length > 0 ? (
                          <div className="progress-list">
                            {dashboardData.categories.map((c, idx) => {
                              const totalVal = dashboardData.total_inventory_valuation || 1;
                              const pct = Math.round((c.valuation / totalVal) * 100);
                              return (
                                <div key={idx} className="progress-item">
                                  <div className="progress-labels">
                                    <strong>{c.category}</strong>
                                    <span>
                                      ${c.valuation.toLocaleString()} ({c.total_stock} units, {pct}%)
                                    </span>
                                  </div>
                                  <div className="progress-track">
                                    <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="empty-state">
                            <p>No categories available.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top Selling Products */}
                    <div className="card">
                      <div className="card-header">
                        <div>
                          <h3 className="card-title">Top Selling Products</h3>
                          <p className="card-desc">Highest volume items over past 30 days</p>
                        </div>
                      </div>
                      <div className="card-body" style={{ padding: 0 }}>
                        {dashboardData?.top_selling_products && dashboardData.top_selling_products.length > 0 ? (
                          <div className="table-responsive">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Rank</th>
                                  <th>Product</th>
                                  <th>Units Sold</th>
                                  <th style={{ textAlign: 'right' }}>Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dashboardData.top_selling_products.map((p, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <strong style={{ color: 'var(--accent)' }}>#{idx + 1}</strong>
                                    </td>
                                    <td>
                                      <strong>{p.name}</strong>
                                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                        SKU: {p.sku}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="badge badge-info">{p.units_sold} units</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                      ${p.revenue.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="empty-state">
                            <p>No sales history recorded yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions Table */}
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3 className="card-title">Recent Inventory Transactions</h3>
                        <p className="card-desc">Real-time log of stock receipts, customer sales, and physical audits</p>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('transactions')}>
                        View All <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      {dashboardData?.recent_transactions && dashboardData.recent_transactions.length > 0 ? (
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Transaction ID</th>
                                <th>Type</th>
                                <th>Product & SKU</th>
                                <th>Quantity</th>
                                <th>Total Value</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardData.recent_transactions.map((t) => (
                                <tr key={t.id}>
                                  <td>
                                    <code>{t.transaction_id}</code>
                                  </td>
                                  <td>
                                    <span
                                      className={`badge ${
                                        t.transaction_type === 'purchase'
                                          ? 'badge-success'
                                          : t.transaction_type === 'sale'
                                          ? 'badge-warning'
                                          : 'badge-secondary'
                                      }`}
                                    >
                                      {t.transaction_type.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>
                                    <strong>{t.product_name}</strong>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                                      ({t.sku})
                                    </span>
                                  </td>
                                  <td>
                                    <strong>
                                      {t.transaction_type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}
                                    </strong>
                                  </td>
                                  <td>${t.total_value.toFixed(2)}</td>
                                  <td>{new Date(t.transaction_date).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <p>No transactions found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===================== 2. PRODUCTS VIEW ===================== */}
          {activeTab === 'products' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Product Catalog & Inventory</h3>
                  <p className="card-desc">Maintain SKUs, pricing, stock levels, safety thresholds, and suppliers</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => handleOpenProductModal()}>
                    <Plus size={16} /> Add Product
                  </button>
                </div>
              </div>

              <div className="card-body">
                <div className="toolbar">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box">
                      <Search size={16} color="var(--text-light)" />
                      <input
                        type="text"
                        placeholder="Search product name, SKU, or ID..."
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          fetchProducts(e.target.value, productCategory, lowStockFilter);
                        }}
                      />
                    </div>

                    <select
                      className="form-select"
                      style={{ width: '170px' }}
                      value={productCategory}
                      onChange={(e) => {
                        setProductCategory(e.target.value);
                        fetchProducts(productSearch, e.target.value, lowStockFilter);
                      }}
                    >
                      <option value="">All Categories</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={lowStockFilter}
                        onChange={(e) => {
                          setLowStockFilter(e.target.checked);
                          fetchProducts(productSearch, productCategory, e.target.checked);
                        }}
                      />
                      <span>Low Stock Only</span>
                    </label>
                  </div>

                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Showing {products.length} Products
                  </span>
                </div>

                {loading ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading products from MongoDB...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="empty-state">
                    <Package className="empty-state-icon" />
                    <h4 className="empty-state-title">No products found</h4>
                    <p className="empty-state-desc">
                      Add a new product or click below to populate the database with demonstration data.
                    </p>
                    <button className="btn btn-primary" onClick={() => handleOpenProductModal()}>
                      <Plus size={16} /> Add First Product
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product Name & SKU</th>
                          <th>Category</th>
                          <th>Unit Price / Cost</th>
                          <th>Stock / Min</th>
                          <th>Valuation</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => {
                          const margin =
                            p.unit_price > 0
                              ? Math.round(((p.unit_price - p.cost_price) / p.unit_price) * 100)
                              : 0;

                          return (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.name}</strong>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  SKU: <code>{p.sku}</code> | ID: {p.product_id}
                                </div>
                              </td>
                              <td>
                                <span className="badge badge-info">{p.category}</span>
                              </td>
                              <td>
                                <div>
                                  ${p.unit_price.toFixed(2)}{' '}
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    (Cost: ${p.cost_price.toFixed(2)})
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>
                                  {margin}% margin
                                </span>
                              </td>
                              <td>
                                <strong>{p.current_stock}</strong>{' '}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  / Min: {p.minimum_stock}
                                </span>
                              </td>
                              <td>${p.total_valuation.toLocaleString()}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    p.status === 'OUT_OF_STOCK'
                                      ? 'status-stockout'
                                      : p.status === 'LOW_STOCK'
                                      ? 'status-low'
                                      : p.status === 'POTENTIAL_OVERSTOCK'
                                      ? 'status-overstock'
                                      : 'status-optimal'
                                  }`}
                                >
                                  {p.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td>
                                <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleViewHistory(p)}
                                    title="View Stock History"
                                  >
                                    <Clock size={14} /> History
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenProductModal(p)}
                                    title="Edit Product"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ color: 'var(--danger)' }}
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: 'product',
                                        id: p.id,
                                        title: `${p.name} (${p.sku})`,
                                      })
                                    }
                                    title="Delete Product"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 3. SUPPLIERS VIEW ===================== */}
          {activeTab === 'suppliers' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Supplier Directory</h3>
                  <p className="card-desc">Manage vendors, procurement contacts, and delivery lead times</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenSupplierModal()}>
                  <Plus size={16} /> Add Supplier
                </button>
              </div>

              <div className="card-body">
                {loading ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading suppliers from MongoDB...</p>
                  </div>
                ) : suppliers.length === 0 ? (
                  <div className="empty-state">
                    <Truck className="empty-state-icon" />
                    <h4 className="empty-state-title">No suppliers configured</h4>
                    <p className="empty-state-desc">Register a vendor to assign replenishment lead times.</p>
                    <button className="btn btn-primary" onClick={() => handleOpenSupplierModal()}>
                      <Plus size={16} /> Register First Supplier
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Supplier ID</th>
                          <th>Company Name</th>
                          <th>Contact Person</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Lead Time</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <strong style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                                {s.supplier_id}
                              </strong>
                            </td>
                            <td>
                              <strong>{s.name}</strong>
                            </td>
                            <td>{s.contact_person || '-'}</td>
                            <td>{s.email}</td>
                            <td>{s.phone || '-'}</td>
                            <td>
                              <span className="badge badge-info">{s.lead_time_days} days lead time</span>
                            </td>
                            <td>
                              <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleOpenSupplierModal(s)}
                                  title="Edit Supplier"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'supplier',
                                      id: s.id,
                                      title: s.name,
                                    })
                                  }
                                  title="Delete Supplier"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 4. TRANSACTIONS VIEW ===================== */}
          {activeTab === 'transactions' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Inventory Transactions Ledger</h3>
                  <p className="card-desc">Record purchases, customer sales, and cycle-count stock adjustments</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => handleOpenTxnModal('purchase')}>
                    <Plus size={16} /> Purchase (Restock)
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleOpenTxnModal('sale')}>
                    <ShoppingCart size={16} /> Record Sale
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleOpenTxnModal('adjustment')}>
                    <Layers size={16} /> Stock Adjustment
                  </button>
                </div>
              </div>

              <div className="card-body">
                <div className="toolbar">
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="search-box">
                      <Search size={16} color="var(--text-light)" />
                      <input
                        type="text"
                        placeholder="Search product, SKU, TXN ID..."
                        value={txnSearch}
                        onChange={(e) => {
                          setTxnSearch(e.target.value);
                          fetchTransactions(txnTypeFilter, e.target.value);
                        }}
                      />
                    </div>

                    <select
                      className="form-select"
                      style={{ width: '160px' }}
                      value={txnTypeFilter}
                      onChange={(e) => {
                        setTxnTypeFilter(e.target.value);
                        fetchTransactions(e.target.value, txnSearch);
                      }}
                    >
                      <option value="">All Types</option>
                      <option value="purchase">Purchase (Inflow)</option>
                      <option value="sale">Sale (Outflow)</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>

                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Total Ledger Entries: {transactions.length}
                  </span>
                </div>

                {loading ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Loading transactions ledger from MongoDB...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="empty-state">
                    <ArrowLeftRight className="empty-state-icon" />
                    <h4 className="empty-state-title">No transactions recorded</h4>
                    <p className="empty-state-desc">Record a purchase or sale to start populating stock movements.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>TXN ID</th>
                          <th>Type</th>
                          <th>Product Name & SKU</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total Value</th>
                          <th>Notes</th>
                          <th>Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <code>{t.transaction_id}</code>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  t.transaction_type === 'purchase'
                                    ? 'badge-success'
                                    : t.transaction_type === 'sale'
                                    ? 'badge-warning'
                                    : 'badge-secondary'
                                }`}
                              >
                                {t.transaction_type.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              <strong>{t.product_name}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                SKU: {t.sku}
                              </div>
                            </td>
                            <td>
                              <strong
                                style={{
                                  color:
                                    t.transaction_type === 'sale'
                                      ? 'var(--danger)'
                                      : t.transaction_type === 'purchase'
                                      ? 'var(--success)'
                                      : 'var(--text-main)',
                                }}
                              >
                                {t.transaction_type === 'sale' ? `-${t.quantity}` : `+${t.quantity}`}
                              </strong>
                            </td>
                            <td>${t.unit_price.toFixed(2)}</td>
                            <td>${t.total_value.toFixed(2)}</td>
                            <td>{t.notes || '-'}</td>
                            <td>{new Date(t.transaction_date).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 5. DEMAND FORECASTING VIEW ===================== */}
          {activeTab === 'forecasting' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Statistical Demand Forecasting Engine</h3>
                    <p className="card-desc">
                      Transparent statistical models (Moving Average & Exponential Smoothing) evaluated against historical sales
                    </p>
                  </div>
                </div>

                <div className="card-body">
                  <div className="form-grid" style={{ marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                    <div className="form-group">
                      <label className="form-label">Select Target Product *</label>
                      <select
                        className="form-select"
                        value={forecastProductId}
                        onChange={(e) => {
                          setForecastProductId(e.target.value);
                          runForecast(e.target.value, forecastHorizon, forecastModel);
                        }}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (SKU: {p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Forecast Horizon *</label>
                      <select
                        className="form-select"
                        value={forecastHorizon}
                        onChange={(e) => {
                          const h = parseInt(e.target.value, 10);
                          setForecastHorizon(h);
                          runForecast(forecastProductId, h, forecastModel);
                        }}
                      >
                        <option value="7">7 Days Ahead (Weekly)</option>
                        <option value="14">14 Days Ahead (Fortnightly)</option>
                        <option value="30">30 Days Ahead (Monthly)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Forecasting Model *</label>
                      <select
                        className="form-select"
                        value={forecastModel}
                        onChange={(e) => {
                          setForecastModel(e.target.value);
                          runForecast(forecastProductId, forecastHorizon, e.target.value);
                        }}
                      >
                        <option value="moving_average">Rolling Moving Average (w=7)</option>
                        <option value="exponential_smoothing">Simple Exponential Smoothing (alpha=0.25)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <button
                        className="btn btn-secondary"
                        onClick={handleSaveForecastSnapshot}
                        disabled={!forecastData}
                      >
                        <Save size={14} /> Save Snapshot
                      </button>
                    </div>
                  </div>

                  {forecastLoading ? (
                    <div className="loading-container">
                      <div className="spinner" />
                      <p>Calculating statistical demand projections from MongoDB ledger...</p>
                    </div>
                  ) : forecastData ? (
                    <>
                      {/* Metric Summary Cards */}
                      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="metric-card">
                          <div className="metric-info">
                            <span className="metric-title">Daily Forecast Rate</span>
                            <span className="metric-value">{forecastData.daily_forecast_rate}</span>
                            <span className="metric-sub">Units / day projected</span>
                          </div>
                          <div className="metric-icon-wrap">
                            <TrendingUp size={22} />
                          </div>
                        </div>

                        <div className="metric-card emerald">
                          <div className="metric-info">
                            <span className="metric-title">Total Demand ({forecastData.horizon_days}d)</span>
                            <span className="metric-value">{forecastData.total_predicted_demand}</span>
                            <span className="metric-sub">Cumulative predicted units</span>
                          </div>
                          <div className="metric-icon-wrap emerald">
                            <Package size={22} />
                          </div>
                        </div>

                        <div className="metric-card purple">
                          <div className="metric-info">
                            <span className="metric-title">Model Accuracy (MAE)</span>
                            <span className="metric-value">
                              {forecastData.mae !== null ? forecastData.mae : 'N/A'}
                            </span>
                            <span className="metric-sub">
                              RMSE: {forecastData.rmse !== null ? forecastData.rmse : 'N/A'}
                            </span>
                          </div>
                          <div className="metric-icon-wrap purple">
                            <CheckCircle2 size={22} />
                          </div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-info">
                            <span className="metric-title">Model Confidence</span>
                            <span className="metric-value" style={{ fontSize: '1.4rem' }}>
                              <span
                                className={`badge ${
                                  forecastData.confidence === 'HIGH'
                                    ? 'badge-success'
                                    : forecastData.confidence === 'MODERATE'
                                    ? 'badge-warning'
                                    : 'badge-secondary'
                                }`}
                              >
                                {forecastData.confidence}
                              </span>
                            </span>
                            <span className="metric-sub">
                              {forecastData.active_sales_days} sales days recorded
                            </span>
                          </div>
                          <div className="metric-icon-wrap">
                            <Info size={22} />
                          </div>
                        </div>
                      </div>

                      {/* Forecast Chart: Historical Actual vs Projected */}
                      <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                          <div>
                            <h4 className="card-title">
                              Historical Sales vs. {forecastData.horizon_days}-Day Forecast
                            </h4>
                            <p className="card-desc">{forecastData.model_name}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, background: '#64748b', borderRadius: 2 }} />
                              Historical Actual Sales
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, background: '#2563eb', borderRadius: 2 }} />
                              Statistical Forecast
                            </span>
                          </div>
                        </div>
                        <div className="card-body">
                          {(() => {
                            const hist = forecastData.historical_series || [];
                            const pred = forecastData.forecast_series || [];
                            const allPoints = [
                              ...hist.map((h) => ({ date: h.date, val: h.actual_sales, type: 'actual' })),
                              ...pred.map((p) => ({ date: p.date, val: p.predicted_demand, type: 'forecast' })),
                            ];

                            const maxVal = Math.max(...allPoints.map((p) => p.val), 5);
                            const width = 840;
                            const height = 220;
                            const padding = 35;

                            return (
                              <div className="chart-container">
                                <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
                                  {/* Grid Lines */}
                                  <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />

                                  {/* Historical Bars */}
                                  {hist.map((h, i) => {
                                    const totalSlots = allPoints.length;
                                    const barW = Math.max(4, (width - 2 * padding) / totalSlots - 3);
                                    const x = padding + i * ((width - 2 * padding) / totalSlots);
                                    const barH = (h.actual_sales / maxVal) * (height - 2 * padding);
                                    const y = height - padding - barH;

                                    return (
                                      <g key={`h-${i}`}>
                                        <rect x={x} y={y} width={barW} height={barH} fill="#94a3b8" rx="2" />
                                        {i % 3 === 0 && (
                                          <text x={x + barW / 2} y={height - 12} fontSize="8" textAnchor="middle" fill="#64748b">
                                            {h.date.slice(5)}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })}

                                  {/* Forecast Bars (Highlighted Accent) */}
                                  {pred.map((p, i) => {
                                    const totalSlots = allPoints.length;
                                    const slotIdx = hist.length + i;
                                    const barW = Math.max(4, (width - 2 * padding) / totalSlots - 3);
                                    const x = padding + slotIdx * ((width - 2 * padding) / totalSlots);
                                    const barH = (p.predicted_demand / maxVal) * (height - 2 * padding);
                                    const y = height - padding - barH;

                                    return (
                                      <g key={`p-${i}`}>
                                        <rect x={x} y={y} width={barW} height={barH} fill="#2563eb" rx="2" />
                                        <text x={x + barW / 2} y={y - 5} fontSize="8" textAnchor="middle" fill="#2563eb" fontWeight="600">
                                          {p.predicted_demand}
                                        </text>
                                        <text x={x + barW / 2} y={height - 12} fontSize="8" textAnchor="middle" fill="#2563eb" fontWeight="600">
                                          {p.date.slice(5)}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Methodology Rationale & Statistical Disclaimer */}
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '1.25rem',
                          borderRadius: 'var(--radius)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                          <HelpCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <strong>Forecasting Methodology & Transparency</strong>
                            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              {forecastData.rationale}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '0.4rem', fontWeight: 500 }}>
                              Disclaimer: {forecastData.disclaimer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>Select a product to generate demand forecast.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== 6. REPLENISHMENT RECOMMENDATIONS ===================== */}
          {activeTab === 'recommendations' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Automated Replenishment Recommendations</h3>
                  <p className="card-desc">
                    Lead-time demand analysis, Reorder Point (ROP) calculation, and suggested order quantities
                  </p>
                </div>
                <a
                  href={api.getExportUrl('recommendations')}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={14} /> Download Recommendations CSV
                </a>
              </div>

              <div className="card-body">
                {/* Metric Summary */}
                <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="metric-card amber">
                    <div className="metric-info">
                      <span className="metric-title">Reorders Needed</span>
                      <span className="metric-value">
                        {recommendationsData?.reorder_needed_count || 0}
                      </span>
                      <span className="metric-sub">Products requiring restock</span>
                    </div>
                    <div className="metric-icon-wrap amber">
                      <ShoppingCart size={22} />
                    </div>
                  </div>

                  <div className="metric-card purple">
                    <div className="metric-info">
                      <span className="metric-title">Estimated Restock Investment</span>
                      <span className="metric-value">
                        ${recommendationsData?.total_estimated_restock_cost?.toLocaleString() || '0.00'}
                      </span>
                      <span className="metric-sub">Capital required for target stock</span>
                    </div>
                    <div className="metric-icon-wrap purple">
                      <DollarSign size={22} />
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-info">
                      <span className="metric-title">Catalog Coverage</span>
                      <span className="metric-value">
                        {recommendationsData?.total_analyzed || 0}
                      </span>
                      <span className="metric-sub">Total products evaluated</span>
                    </div>
                    <div className="metric-icon-wrap">
                      <Package size={22} />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Computing replenishment formulas (ROP = d * L + SS)...</p>
                  </div>
                ) : !recommendationsData || recommendationsData.recommendations.length === 0 ? (
                  <div className="empty-state">
                    <ShoppingCart className="empty-state-icon" />
                    <h4 className="empty-state-title">No recommendations available</h4>
                    <p className="empty-state-desc">Products and sales history are required to compute ROP.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product Name & SKU</th>
                          <th>Lead Time</th>
                          <th>Daily Sales (d)</th>
                          <th>Safety Stock (SS)</th>
                          <th>Reorder Point (ROP)</th>
                          <th>Current Stock</th>
                          <th>Suggested Order</th>
                          <th>Est. Cost</th>
                          <th>Urgency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommendationsData.recommendations.map((r) => (
                          <tr key={r.product_id}>
                            <td>
                              <strong>{r.product_name}</strong>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                SKU: {r.sku} | Vendor: {r.supplier_name}
                              </div>
                            </td>
                            <td>{r.lead_time_days} days</td>
                            <td>{r.avg_daily_demand} units/day</td>
                            <td>{r.safety_stock}</td>
                            <td>
                              <strong>{r.reorder_point}</strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: r.current_stock <= r.reorder_point ? 'var(--danger)' : 'var(--text-main)',
                                }}
                              >
                                {r.current_stock}
                              </span>
                            </td>
                            <td>
                              {r.suggested_order_quantity > 0 ? (
                                <strong style={{ color: 'var(--accent)', fontSize: '1rem' }}>
                                  +{r.suggested_order_quantity}
                                </strong>
                              ) : (
                                <span style={{ color: 'var(--text-light)' }}>0 (Adequate)</span>
                              )}
                            </td>
                            <td>${r.estimated_cost.toFixed(2)}</td>
                            <td>
                              <span
                                className={`badge ${
                                  r.urgency === 'URGENT'
                                    ? 'badge-danger'
                                    : r.urgency === 'HIGH'
                                    ? 'badge-warning'
                                    : r.urgency === 'MEDIUM'
                                    ? 'badge-info'
                                    : 'badge-secondary'
                                }`}
                              >
                                {r.urgency}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 7. INVENTORY ALERTS VIEW ===================== */}
          {activeTab === 'alerts' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Inventory Health Exceptions & Alerts</h3>
                  <p className="card-desc">Automated detection of stockouts, runout hazards, and demand anomalies</p>
                </div>
              </div>

              <div className="card-body">
                {/* Alert Severity Counts */}
                <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="metric-card rose">
                    <div className="metric-info">
                      <span className="metric-title">Critical Stockouts</span>
                      <span className="metric-value">{alertsData?.critical_count || 0}</span>
                      <span className="metric-sub">Zero stock on hand</span>
                    </div>
                    <div className="metric-icon-wrap rose">
                      <AlertTriangle size={22} />
                    </div>
                  </div>

                  <div className="metric-card amber">
                    <div className="metric-info">
                      <span className="metric-title">High Priority Hazards</span>
                      <span className="metric-value">{alertsData?.high_count || 0}</span>
                      <span className="metric-sub">Below min or lead-time runout</span>
                    </div>
                    <div className="metric-icon-wrap amber">
                      <Clock size={22} />
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-info">
                      <span className="metric-title">Medium & Demand Surges</span>
                      <span className="metric-value">{alertsData?.medium_count || 0}</span>
                      <span className="metric-sub">Spike in velocity</span>
                    </div>
                    <div className="metric-icon-wrap">
                      <TrendingUp size={22} />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="loading-container">
                    <div className="spinner" />
                    <p>Evaluating inventory conditions against thresholds...</p>
                  </div>
                ) : !alertsData || alertsData.alerts.length === 0 ? (
                  <div className="empty-state">
                    <CheckCircle2 size={42} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
                    <h4 className="empty-state-title">All Systems Healthy</h4>
                    <p className="empty-state-desc">No active stockouts, runout risks, or inventory discrepancies detected.</p>
                  </div>
                ) : (
                  <div>
                    {alertsData.alerts.map((a, idx) => (
                      <div key={idx} className={`alert-card-item ${a.severity}`}>
                        <div className={`alert-icon-box ${a.severity}`}>
                          <AlertTriangle size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.96rem' }}>{a.title}</strong>
                            <span
                              className={`badge ${
                                a.severity === 'CRITICAL'
                                  ? 'badge-danger'
                                  : a.severity === 'HIGH'
                                  ? 'badge-warning'
                                  : 'badge-info'
                              }`}
                            >
                              {a.severity}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.86rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                            <strong>{a.product_name}</strong> (SKU: <code>{a.sku}</code>) — {a.message}
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            <strong>Recommended Action:</strong> {a.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== 8. REPORTS & EXPORTS VIEW ===================== */}
          {activeTab === 'reports' && (
            <div>
              {/* CSV Export Quick Cards */}
              <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                <div className="metric-card">
                  <div className="metric-info">
                    <span className="metric-title">Inventory Valuation</span>
                    <span className="metric-value" style={{ fontSize: '1.25rem' }}>
                      CSV Export
                    </span>
                    <span className="metric-sub">Complete catalog valuation</span>
                  </div>
                  <a
                    href={api.getExportUrl('inventory')}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 8 }}
                  >
                    <Download size={14} /> Download CSV
                  </a>
                </div>

                <div className="metric-card emerald">
                  <div className="metric-info">
                    <span className="metric-title">Sales History</span>
                    <span className="metric-value" style={{ fontSize: '1.25rem' }}>
                      CSV Export
                    </span>
                    <span className="metric-sub">Transaction audit ledger</span>
                  </div>
                  <a
                    href={api.getExportUrl('sales')}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                  >
                    <Download size={14} /> Download CSV
                  </a>
                </div>

                <div className="metric-card purple">
                  <div className="metric-info">
                    <span className="metric-title">Replenishment Plan</span>
                    <span className="metric-value" style={{ fontSize: '1.25rem' }}>
                      CSV Export
                    </span>
                    <span className="metric-sub">Lead time & ROP quantities</span>
                  </div>
                  <a
                    href={api.getExportUrl('recommendations')}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 8 }}
                  >
                    <Download size={14} /> Download CSV
                  </a>
                </div>
              </div>

              {/* Supplier Performance Matrix */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Supplier Fulfillment & Stock Matrix</h3>
                    <p className="card-desc">Vendor product assignments and delivery lead times</p>
                  </div>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {reportsData?.supplier_metrics && reportsData.supplier_metrics.length > 0 ? (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Supplier ID</th>
                            <th>Company Name</th>
                            <th>Lead Time</th>
                            <th>Products Supplied</th>
                            <th>Total Units Maintained</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportsData.supplier_metrics.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <code>{s.supplier_id}</code>
                              </td>
                              <td>
                                <strong>{s.name}</strong>
                              </td>
                              <td>{s.lead_time_days} days</td>
                              <td>{s.product_count} products</td>
                              <td>
                                <strong>{s.total_stock} units</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No supplier performance data available.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Critical Stock Attention List */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Critical Inventory Attention List</h3>
                    <p className="card-desc">Products requiring immediate procurement review</p>
                  </div>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {reportsData?.critical_stock_products && reportsData.critical_stock_products.length > 0 ? (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>SKU</th>
                            <th>Category</th>
                            <th>Current Stock</th>
                            <th>Min Stock Threshold</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportsData.critical_stock_products.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.name}</strong>
                              </td>
                              <td>
                                <code>{p.sku}</code>
                              </td>
                              <td>{p.category}</td>
                              <td>
                                <strong style={{ color: p.current_stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                                  {p.current_stock}
                                </strong>
                              </td>
                              <td>{p.minimum_stock}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    p.current_stock === 0 ? 'status-stockout' : 'status-low'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>All products are currently above minimum safety thresholds.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingProduct ? 'Edit Product Details' : 'Add New Inventory Product'}
              </h3>
              <button className="modal-close" onClick={() => setIsProductModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Wireless Mechanical Keyboard"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Keeping Unit (SKU) *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. ELEC-WKB-01"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Electronics, Office Supplies"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Retail Unit Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-input"
                    value={productForm.unit_price}
                    onChange={(e) => setProductForm({ ...productForm, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cost Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.00"
                    required
                    className="form-input"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Current Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-input"
                    value={productForm.current_stock}
                    onChange={(e) => setProductForm({ ...productForm, current_stock: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Safety Threshold *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-input"
                    value={productForm.minimum_stock}
                    onChange={(e) => setProductForm({ ...productForm, minimum_stock: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Primary Supplier</label>
                  <select
                    className="form-select"
                    value={productForm.supplier_id}
                    onChange={(e) => setProductForm({ ...productForm, supplier_id: e.target.value })}
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.supplier_id}>
                        {s.name} ({s.supplier_id} - {s.lead_time_days}d lead)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Product Description</label>
                  <textarea
                    rows="2"
                    className="form-textarea"
                    placeholder="Short product overview and specifications..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add / Edit Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingSupplier ? 'Edit Supplier Record' : 'Register New Supplier'}
              </h3>
              <button className="modal-close" onClick={() => setIsSupplierModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Supplier ID / Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingSupplier}
                    className="form-input"
                    value={supplierForm.supplier_id}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplier_id: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Company / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Apex Electronics Corp"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sarah Chen"
                    value={supplierForm.contact_person}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="vendor@company.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+1 555-0142"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lead Time (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    required
                    className="form-input"
                    value={supplierForm.lead_time_days}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, lead_time_days: parseInt(e.target.value, 10) || 7 })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSupplierModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Transaction Modal */}
      {isTxnModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Record Inventory Transaction</h3>
              <button className="modal-close" onClick={() => setIsTxnModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTransaction}>
              <div className="modal-body form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Transaction Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {['purchase', 'sale', 'adjustment'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`btn ${txnForm.transaction_type === type ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => {
                          const selProd = products.find((p) => p.id === txnForm.product_id);
                          setTxnForm({
                            ...txnForm,
                            transaction_type: type,
                            unit_price: selProd
                              ? type === 'sale'
                                ? selProd.unit_price
                                : selProd.cost_price
                              : '',
                          });
                        }}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Select Product *</label>
                  <select
                    required
                    className="form-select"
                    value={txnForm.product_id}
                    onChange={(e) => {
                      const selProd = products.find((p) => p.id === e.target.value);
                      setTxnForm({
                        ...txnForm,
                        product_id: e.target.value,
                        unit_price: selProd
                          ? txnForm.transaction_type === 'sale'
                            ? selProd.unit_price
                            : selProd.cost_price
                          : '',
                      });
                    }}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku}) — Stock: {p.current_stock}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Quantity {txnForm.transaction_type === 'adjustment' ? '(+/- adjustment)' : '*'}
                  </label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={txnForm.quantity}
                    onChange={(e) => setTxnForm({ ...txnForm, quantity: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={txnForm.unit_price}
                    onChange={(e) => setTxnForm({ ...txnForm, unit_price: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Transaction Notes / Audit Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Purchase order PO-8812 / Customer order #1042 / Physical audit"
                    value={txnForm.notes}
                    onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
                  />
                </div>

                {/* Stock Preview */}
                {(() => {
                  const p = products.find((pr) => pr.id === txnForm.product_id);
                  if (!p) return null;
                  const qtyNum = parseInt(txnForm.quantity, 10) || 0;
                  const resultingStock =
                    txnForm.transaction_type === 'sale'
                      ? p.current_stock - qtyNum
                      : p.current_stock + qtyNum;

                  return (
                    <div
                      className="form-group full-width"
                      style={{
                        background: '#f8fafc',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.84rem',
                      }}
                    >
                      <span>
                        Current Stock: <strong>{p.current_stock}</strong> | Projected Result:{' '}
                        <strong style={{ color: resultingStock < 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {resultingStock} units
                        </strong>
                      </span>
                      {resultingStock < 0 && (
                        <p style={{ color: 'var(--danger)', fontSize: '0.76rem', marginTop: 2 }}>
                          Warning: Cannot execute sale that exceeds current available inventory.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTxnModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Product Stock History Modal */}
      {historyProduct && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Stock History: {historyProduct.name}</h3>
                <p className="card-desc">SKU: {historyProduct.sku} | Current Stock: {historyProduct.current_stock}</p>
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setHistoryProduct(null);
                  setHistoryData(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {!historyData ? (
                <div className="loading-container">
                  <div className="spinner" />
                  <p>Loading transaction timeline...</p>
                </div>
              ) : historyData.history.length === 0 ? (
                <div className="empty-state">
                  <p>No transactions recorded for this item yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Value</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.transaction_date).toLocaleDateString()}</td>
                          <td>
                            <span
                              className={`badge ${
                                h.transaction_type === 'purchase'
                                  ? 'badge-success'
                                  : h.transaction_type === 'sale'
                                  ? 'badge-warning'
                                  : 'badge-secondary'
                              }`}
                            >
                              {h.transaction_type}
                            </span>
                          </td>
                          <td>
                            <strong>
                              {h.transaction_type === 'sale' ? `-${h.quantity}` : `+${h.quantity}`}
                            </strong>
                          </td>
                          <td>${h.total_value.toFixed(2)}</td>
                          <td>{h.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setHistoryProduct(null);
                  setHistoryData(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="var(--danger)" /> Confirm Deletion
              </h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteConfirm.title}</strong>?
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {deleteConfirm.type === 'product'
                  ? 'Products with existing transaction history cannot be deleted to preserve audit trails.'
                  : 'Suppliers linked to active catalog products cannot be deleted.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={deleteConfirm.type === 'product' ? handleDeleteProduct : handleDeleteSupplier}
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Seed Demo Data Confirmation Modal */}
      {seedConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={20} color="var(--accent)" /> Load Synthetic Demo Data
              </h3>
              <button className="modal-close" onClick={() => setSeedConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                This will initialize the database with <strong>20 products</strong>, <strong>4 suppliers</strong>, and{' '}
                <strong>75 days of realistic sales ledger entries</strong>.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Synthetic data allows full demonstration of demand forecasting models, MAE/RMSE evaluation, and replenishment recommendations.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSeedConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSeedData}>
                Confirm Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
