const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('pos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(endpoint, options = {}) {
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

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/auth/me'),

  // Medicines
  searchMedicines: (q, barcode) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (barcode) params.set('barcode', barcode);
    return request(`/medicines/search?${params.toString()}`);
  },
  getSubstitutes: (medicineId) => request(`/medicines/${medicineId}/substitutes`),
  getMedicines: () => request('/medicines'),
  addMedicine: (data) => request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
  updateMedicine: (id, data) => request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMedicine: (id) => request(`/medicines/${id}`, { method: 'DELETE' }),

  // Generics & Manufacturers
  getGenerics: () => request('/medicines/meta/generics'),
  addGeneric: (data) => request('/medicines/meta/generics', { method: 'POST', body: JSON.stringify(data) }),
  getManufacturers: () => request('/medicines/meta/manufacturers'),
  addManufacturer: (data) => request('/medicines/meta/manufacturers', { method: 'POST', body: JSON.stringify(data) }),

  // POS
  checkout: (data) => request('/pos/checkout', { method: 'POST', body: JSON.stringify(data) }),
  holdBill: (data) => request('/pos/hold', { method: 'POST', body: JSON.stringify(data) }),
  getHeldBills: () => request('/pos/held'),
  deleteHeldBill: (id) => request(`/pos/held/${id}`, { method: 'DELETE' }),
  lookupInvoice: (query) => request(`/pos/invoices/${encodeURIComponent(query)}`),
  processReturn: (data) => request('/pos/return', { method: 'POST', body: JSON.stringify(data) }),

  // Inventory & Batches
  getBatches: (medicineId) => request(`/inventory/batches${medicineId ? `?medicine_id=${medicineId}` : ''}`),
  addBatch: (data) => request('/inventory/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id, data) => request(`/inventory/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAlerts: () => request('/inventory/alerts'),
  recordWriteOff: (data) => request('/inventory/write-off', { method: 'POST', body: JSON.stringify(data) }),
  getWriteOffs: () => request('/inventory/write-offs'),

  // Purchases & Suppliers
  getSuppliers: () => request('/purchases/suppliers'),
  addSupplier: (data) => request('/purchases/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id, data) => request(`/purchases/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getPurchases: () => request('/purchases'),
  createPurchase: (data) => request('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  recordSupplierPayment: (data) => request('/purchases/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Customers
  getCustomers: (q) => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  addCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCustomerLedger: (id) => request(`/customers/${id}/ledger`),
  recordCustomerPayment: (id, data) => request(`/customers/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getSalesReport: (period) => request(`/reports/sales?period=${period || 'today'}`),
  getProfitLossReport: (period) => request(`/reports/profit-loss?period=${period || 'month'}`),
  getFastMoving: (limit) => request(`/reports/fast-moving?limit=${limit || 10}`),
  getExpiryLossReport: () => request('/reports/expiry-loss'),

  // Users & Settings
  getUsers: () => request('/users'),
  addUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Prescription Upload
  uploadPrescription: async (file) => {
    const formData = new FormData();
    formData.append('prescription', file);
    return request('/upload/prescription', {
      method: 'POST',
      body: formData,
      isFormData: true
    });
  }
};
