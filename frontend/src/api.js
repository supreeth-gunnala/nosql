const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const res = await fetch(url, config);
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errorMsg =
        (data && data.detail) ||
        (data && data.message) ||
        `Request failed with status ${res.status}`;
      const error = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    throw new Error(`Unable to connect to backend API: ${err.message}`);
  }
}

export const api = {
  // Health & System
  checkHealth: () => request('/api/health'),
  seedData: (force = false) => request(`/api/seed?force=${force}`, { method: 'POST' }),

  // Dashboard
  getDashboard: () => request('/api/dashboard'),

  // Products
  getProducts: (search = '', category = '', lowStock = null) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (lowStock !== null && lowStock !== undefined) params.append('low_stock', lowStock);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/products${q}`);
  },
  getProduct: (id) => request(`/api/products/${id}`),
  addProduct: (data) =>
    request('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id, data) =>
    request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id) =>
    request(`/api/products/${id}`, {
      method: 'DELETE',
    }),
  getProductHistory: (id) => request(`/api/products/${id}/history`),

  // Suppliers
  getSuppliers: () => request('/api/suppliers'),
  getSupplier: (id) => request(`/api/suppliers/${id}`),
  addSupplier: (data) =>
    request('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSupplier: (id, data) =>
    request(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSupplier: (id) =>
    request(`/api/suppliers/${id}`, {
      method: 'DELETE',
    }),

  // Transactions
  getTransactions: (productId = '', type = '', search = '', limit = 50) => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', productId);
    if (type) params.append('transaction_type', type);
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/transactions${q}`);
  },
  createTransaction: (data) =>
    request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Demand Forecasting
  getForecast: (productId, horizon = 7, model = 'moving_average') =>
    request(`/api/forecasts/${productId}?horizon_days=${horizon}&model=${model}`),
  saveForecast: (productId, data) =>
    request(`/api/forecasts/${productId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Replenishment Recommendations
  getRecommendations: () => request('/api/recommendations'),

  // Alerts
  getAlerts: () => request('/api/alerts'),

  // Reports
  getReports: () => request('/api/reports'),
  getExportUrl: (type) => `${API_BASE}/api/reports/export-csv?report_type=${type}`,
};
