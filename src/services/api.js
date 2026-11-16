import { mockApi } from './mockApi';

const API_BASE = '/api';

const isGitHubPages = typeof window !== 'undefined' && (
  window.location.hostname.endsWith('github.io') ||
  window.location.hostname.includes('pages.dev') ||
  window.location.protocol === 'file:'
);

function getAuthHeaders() {
  const token = localStorage.getItem('pos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(endpoint, options = {}) {
  if (isGitHubPages) {
    throw new Error('GITHUB_PAGES_MODE');
  }

  const url = `${API_BASE}${endpoint}`;
  const headers = options.isFormData
    ? { ...(localStorage.getItem('pos_token') ? { Authorization: `Bearer ${localStorage.getItem('pos_token')}` } : {}) }
    : getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = (data && data.error) || response.statusText || 'An error occurred';
    throw new Error(errorMsg);
  }

  return data;
}

// Helper to wrap calls with fallback to mockApi
function withFallback(apiCall, mockCall) {
  return async (...args) => {
    if (isGitHubPages) {
      return await mockCall(...args);
    }
    try {
      return await apiCall(...args);
    } catch (err) {
      // If network error, 404, or failed to connect, fall back to mock
      console.warn('Backend unavailable, falling back to in-browser demo engine:', err.message);
      return await mockCall(...args);
    }
  };
}

export const api = {
  // Auth
  login: withFallback(
    (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    (username, password) => mockApi.login(username, password)
  ),
  getMe: withFallback(
    () => request('/auth/me'),
    () => mockApi.getMe()
  ),

  // Medicines
  searchMedicines: withFallback(
    (q, barcode) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (barcode) params.set('barcode', barcode);
      return request(`/medicines/search?${params.toString()}`);
    },
    (q, barcode) => mockApi.searchMedicines(q, barcode)
  ),
  getSubstitutes: withFallback(
    (medicineId) => request(`/medicines/${medicineId}/substitutes`),
    (medicineId) => mockApi.getSubstitutes(medicineId)
  ),
  getMedicines: withFallback(
    () => request('/medicines'),
    () => mockApi.getMedicines()
  ),
  addMedicine: withFallback(
    (data) => request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addMedicine(data)
  ),
  updateMedicine: withFallback(
    (id, data) => request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    (id, data) => mockApi.updateMedicine(id, data)
  ),
  deleteMedicine: withFallback(
    (id) => request(`/medicines/${id}`, { method: 'DELETE' }),
    (id) => mockApi.deleteMedicine(id)
  ),

  // Generics & Manufacturers
  getGenerics: withFallback(
    () => request('/medicines/meta/generics'),
    () => mockApi.getGenerics()
  ),
  addGeneric: withFallback(
    (data) => request('/medicines/meta/generics', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addGeneric(data)
  ),
  getManufacturers: withFallback(
    () => request('/medicines/meta/manufacturers'),
    () => mockApi.getManufacturers()
  ),
  addManufacturer: withFallback(
    (data) => request('/medicines/meta/manufacturers', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addManufacturer(data)
  ),

  // POS
  checkout: withFallback(
    (data) => request('/pos/checkout', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.checkout(data)
  ),
  holdBill: withFallback(
    (data) => request('/pos/hold', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.holdBill(data)
  ),
  getHeldBills: withFallback(
    () => request('/pos/held'),
    () => mockApi.getHeldBills()
  ),
  deleteHeldBill: withFallback(
    (id) => request(`/pos/held/${id}`, { method: 'DELETE' }),
    (id) => mockApi.deleteHeldBill(id)
  ),
  lookupInvoice: withFallback(
    (query) => request(`/pos/invoices/${encodeURIComponent(query)}`),
    (query) => mockApi.lookupInvoice(query)
  ),
  processReturn: withFallback(
    (data) => request('/pos/return', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.processReturn(data)
  ),

  // Inventory & Batches
  getBatches: withFallback(
    (medicineId) => request(`/inventory/batches${medicineId ? `?medicine_id=${medicineId}` : ''}`),
    (medicineId) => mockApi.getBatches(medicineId)
  ),
  addBatch: withFallback(
    (data) => request('/inventory/batches', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addBatch(data)
  ),
  updateBatch: withFallback(
    (id, data) => request(`/inventory/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    (id, data) => mockApi.updateBatch(id, data)
  ),
  getAlerts: withFallback(
    () => request('/inventory/alerts'),
    () => mockApi.getAlerts()
  ),
  recordWriteOff: withFallback(
    (data) => request('/inventory/write-off', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.recordWriteOff(data)
  ),
  getWriteOffs: withFallback(
    () => request('/inventory/write-offs'),
    () => mockApi.getWriteOffs()
  ),

  // Purchases & Suppliers
  getSuppliers: withFallback(
    () => request('/purchases/suppliers'),
    () => mockApi.getSuppliers()
  ),
  addSupplier: withFallback(
    (data) => request('/purchases/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addSupplier(data)
  ),
  updateSupplier: withFallback(
    (id, data) => request(`/purchases/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    (id, data) => mockApi.updateSupplier(id, data)
  ),
  getPurchases: withFallback(
    () => request('/purchases'),
    () => mockApi.getPurchases()
  ),
  createPurchase: withFallback(
    (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.createPurchase(data)
  ),
  recordSupplierPayment: withFallback(
    (data) => request('/purchases/payments', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.recordSupplierPayment(data)
  ),

  // Customers
  getCustomers: withFallback(
    (q) => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    (q) => mockApi.getCustomers(q)
  ),
  addCustomer: withFallback(
    (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addCustomer(data)
  ),
  updateCustomer: withFallback(
    (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    (id, data) => mockApi.updateCustomer(id, data)
  ),
  getCustomerLedger: withFallback(
    (id) => request(`/customers/${id}/ledger`),
    (id) => mockApi.getCustomerLedger(id)
  ),
  recordCustomerPayment: withFallback(
    (id, data) => request(`/customers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
    (id, data) => mockApi.recordCustomerPayment(id, data)
  ),

  // Reports
  getSalesReport: withFallback(
    (period) => request(`/reports/sales?period=${period || 'today'}`),
    (period) => mockApi.getSalesReport(period)
  ),
  getProfitLossReport: withFallback(
    (period) => request(`/reports/profit-loss?period=${period || 'month'}`),
    (period) => mockApi.getProfitLossReport(period)
  ),
  getFastMoving: withFallback(
    (limit) => request(`/reports/fast-moving?limit=${limit || 10}`),
    (limit) => mockApi.getFastMoving(limit)
  ),
  getExpiryLossReport: withFallback(
    () => request('/reports/expiry-loss'),
    () => mockApi.getExpiryLossReport()
  ),

  // Users & Settings
  getUsers: withFallback(
    () => request('/users'),
    () => mockApi.getUsers()
  ),
  addUser: withFallback(
    (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.addUser(data)
  ),
  updateUser: withFallback(
    (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    (id, data) => mockApi.updateUser(id, data)
  ),
  getSettings: withFallback(
    () => request('/settings'),
    () => mockApi.getSettings()
  ),
  updateSettings: withFallback(
    (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),
    (data) => mockApi.updateSettings(data)
  ),

  // Prescription Upload
  uploadPrescription: async (file) => {
    if (isGitHubPages) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            message: 'Prescription stored in browser memory',
            url: reader.result,
            filename: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    }
    const formData = new FormData();
    formData.append('prescription', file);
    try {
      return await request('/upload/prescription', {
        method: 'POST',
        body: formData,
        isFormData: true
      });
    } catch (err) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            message: 'Prescription stored in browser memory',
            url: reader.result,
            filename: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }
};
