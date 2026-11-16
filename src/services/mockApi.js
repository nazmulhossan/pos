import initialData from './seedData.json';

const STORAGE_KEY = 'pos_demo_db_v1';

function getDb() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored DB, resetting to initial', e);
    }
  }
  const cloned = JSON.parse(JSON.stringify(initialData));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
  return cloned;
}

function saveDb(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const mockApi = {
  // Auth
  login: async (username, password) => {
    const db = getDb();
    const user = db.users.find(u => u.username === username && u.is_active);
    if (!user) throw new Error('Invalid username or password');
    const settingsObj = {};
    (db.settings || []).forEach(s => { settingsObj[s.key] = s.value; });
    const token = 'mock_jwt_token_' + user.user_id;
    return {
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        username: user.username,
        role: user.role
      },
      settings: settingsObj
    };
  },

  getMe: async () => {
    const db = getDb();
    const token = localStorage.getItem('pos_token') || 'mock_jwt_token_1';
    const userIdMatch = token.match(/\d+$/);
    const userId = userIdMatch ? parseInt(userIdMatch[0], 10) : 1;
    const user = db.users.find(u => u.user_id === userId) || db.users[0];
    const settingsObj = {};
    (db.settings || []).forEach(s => { settingsObj[s.key] = s.value; });
    return {
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        username: user.username,
        role: user.role
      },
      settings: settingsObj
    };
  },

  // Medicines
  searchMedicines: async (q, barcode) => {
    const db = getDb();
    const term = (q || '').toLowerCase().trim();
    const code = (barcode || '').trim();
    const today = new Date().toISOString().split('T')[0];

    let list = db.medicines.map(m => {
      const g = db.generics.find(x => x.generic_id === m.generic_id) || {};
      const mf = db.manufacturers.find(x => x.manufacturer_id === m.manufacturer_id) || {};
      return {
        ...m,
        generic_name: g.generic_name || '',
        manufacturer_name: mf.name || ''
      };
    });

    if (code) {
      list = list.filter(m => m.barcode === code);
    } else if (term) {
      list = list.filter(m =>
        m.brand_name.toLowerCase().includes(term) ||
        m.generic_name.toLowerCase().includes(term) ||
        (m.barcode && m.barcode.includes(term))
      );
    }

    return list.slice(0, 50).map(med => {
      const activeBatches = (db.medicine_batches || [])
        .filter(b => b.medicine_id === med.medicine_id && b.stock_qty_pieces > 0 && b.expiry_date >= today)
        .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

      const expiredBatches = (db.medicine_batches || [])
        .filter(b => b.medicine_id === med.medicine_id && b.stock_qty_pieces > 0 && b.expiry_date < today)
        .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

      const totalActivePieces = activeBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);
      const totalStrips = med.pieces_per_strip > 0 ? (totalActivePieces / med.pieces_per_strip).toFixed(1) : 0;
      const totalBoxes = (med.pieces_per_strip > 0 && med.strips_per_box > 0)
        ? (totalActivePieces / (med.pieces_per_strip * med.strips_per_box)).toFixed(1)
        : 0;

      const defaultBatch = activeBatches[0] || (db.medicine_batches || []).find(b => b.medicine_id === med.medicine_id) || {};

      return {
        ...med,
        activeBatches,
        expiredBatches,
        totalActivePieces,
        totalStrips,
        totalBoxes,
        sellingPricePiece: defaultBatch.selling_price_piece || 10,
        sellingPriceStrip: (defaultBatch.selling_price_piece || 10) * (med.pieces_per_strip || 10),
        sellingPriceBox: (defaultBatch.selling_price_piece || 10) * (med.pieces_per_strip || 10) * (med.strips_per_box || 10),
        earliestExpiry: defaultBatch.expiry_date || null
      };
    });
  },

  getSubstitutes: async (medicineId) => {
    const db = getDb();
    const current = db.medicines.find(m => m.medicine_id === parseInt(medicineId, 10));
    if (!current) return { substitutes: [] };
    const today = new Date().toISOString().split('T')[0];

    const substitutes = db.medicines
      .filter(m => m.generic_id === current.generic_id && m.medicine_id !== current.medicine_id && m.strength === current.strength)
      .map(m => {
        const mf = db.manufacturers.find(x => x.manufacturer_id === m.manufacturer_id) || {};
        const activeBatches = (db.medicine_batches || [])
          .filter(b => b.medicine_id === m.medicine_id && b.stock_qty_pieces > 0 && b.expiry_date >= today);
        const totalPieces = activeBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);
        const firstBatch = activeBatches[0] || {};
        return {
          ...m,
          manufacturer_name: mf.name || '',
          totalActivePieces: totalPieces,
          sellingPricePiece: firstBatch.selling_price_piece || 10
        };
      });

    return {
      currentMedicine: current,
      substitutes
    };
  },

  getMedicines: async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    return db.medicines.map(m => {
      const g = db.generics.find(x => x.generic_id === m.generic_id) || {};
      const mf = db.manufacturers.find(x => x.manufacturer_id === m.manufacturer_id) || {};
      const batches = (db.medicine_batches || []).filter(b => b.medicine_id === m.medicine_id && b.stock_qty_pieces > 0);
      const totalStockPieces = batches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);
      const firstBatch = batches[0] || {};
      return {
        ...m,
        generic_name: g.generic_name || '',
        manufacturer_name: mf.name || '',
        totalStockPieces,
        batches_count: batches.length,
        default_selling_price: firstBatch.selling_price_piece || 0
      };
    });
  },

  addMedicine: async (data) => {
    const db = getDb();
    const newId = (db.medicines.reduce((max, m) => Math.max(max, m.medicine_id || 0), 0) || 0) + 1;
    const newMed = {
      medicine_id: newId,
      brand_name: data.brand_name,
      generic_id: parseInt(data.generic_id, 10),
      manufacturer_id: parseInt(data.manufacturer_id, 10),
      dosage_form: data.dosage_form || 'Tablet',
      strength: data.strength || '',
      barcode: data.barcode || ('880' + Math.floor(Math.random() * 100000000)),
      pieces_per_strip: parseInt(data.pieces_per_strip, 10) || 10,
      strips_per_box: parseInt(data.strips_per_box, 10) || 10,
      reorder_level: parseInt(data.reorder_level, 10) || 50,
      is_rx_required: data.is_rx_required ? 1 : 0,
      created_at: new Date().toISOString()
    };
    db.medicines.push(newMed);
    saveDb(db);
    return { message: 'Medicine added successfully', medicine: newMed };
  },

  updateMedicine: async (id, data) => {
    const db = getDb();
    const idx = db.medicines.findIndex(m => m.medicine_id === parseInt(id, 10));
    if (idx !== -1) {
      db.medicines[idx] = { ...db.medicines[idx], ...data };
      saveDb(db);
    }
    return { message: 'Medicine updated successfully' };
  },

  deleteMedicine: async (id) => {
    const db = getDb();
    db.medicines = db.medicines.filter(m => m.medicine_id !== parseInt(id, 10));
    saveDb(db);
    return { message: 'Medicine deleted successfully' };
  },

  // Generics & Manufacturers
  getGenerics: async () => {
    return getDb().generics || [];
  },

  addGeneric: async (data) => {
    const db = getDb();
    const id = (db.generics.reduce((max, g) => Math.max(max, g.generic_id || 0), 0) || 0) + 1;
    const item = { generic_id: id, generic_name: data.generic_name, description: data.description || '' };
    db.generics.push(item);
    saveDb(db);
    return { generic: item };
  },

  getManufacturers: async () => {
    return getDb().manufacturers || [];
  },

  addManufacturer: async (data) => {
    const db = getDb();
    const id = (db.manufacturers.reduce((max, m) => Math.max(max, m.manufacturer_id || 0), 0) || 0) + 1;
    const item = { manufacturer_id: id, name: data.name, contact_info: data.contact_info || '' };
    db.manufacturers.push(item);
    saveDb(db);
    return { manufacturer: item };
  },

  // POS Checkout & Billing
  checkout: async (data) => {
    const db = getDb();
    const year = new Date().getFullYear();
    const invoiceSeq = (db.sales_invoices.length || 0) + 1;
    const invoiceNumber = `INV-${year}-${String(invoiceSeq).padStart(4, '0')}`;
    const today = new Date().toISOString();

    let subtotal = 0;
    const billedItems = [];

    // Deduct stock using FEFO
    (data.items || []).forEach(item => {
      const med = db.medicines.find(m => m.medicine_id === item.medicine_id);
      let multiplier = 1;
      if (item.sold_unit_type === 'STRIP') multiplier = med ? med.pieces_per_strip : 10;
      if (item.sold_unit_type === 'BOX') multiplier = med ? (med.pieces_per_strip * med.strips_per_box) : 100;
      const totalPiecesNeeded = (item.qty_sold_in_unit || 1) * multiplier;

      let remaining = totalPiecesNeeded;
      const batches = (db.medicine_batches || [])
        .filter(b => b.medicine_id === item.medicine_id && b.stock_qty_pieces > 0)
        .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

      batches.forEach(b => {
        if (remaining <= 0) return;
        const deduct = Math.min(b.stock_qty_pieces, remaining);
        b.stock_qty_pieces -= deduct;
        remaining -= deduct;
      });

      const lineTotal = (item.unit_price || 10) * (item.qty_sold_in_unit || 1);
      subtotal += lineTotal;

      billedItems.push({
        brand_name: med ? med.brand_name : 'Item',
        dosage_form: med ? med.dosage_form : '',
        strength: med ? med.strength : '',
        sold_unit_type: item.sold_unit_type,
        qty_sold_in_unit: item.qty_sold_in_unit,
        unit_price: item.unit_price || 10,
        subtotal: lineTotal
      });
    });

    const discountAmount = data.discount_type === 'PERCENT'
      ? (subtotal * (parseFloat(data.discount_value) || 0) / 100)
      : (parseFloat(data.discount_value) || 0);

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const vatPercent = parseFloat(data.vat_percent_custom ?? 5);
    const vatAmount = (afterDiscount * vatPercent) / 100;
    const grandTotal = Math.round(afterDiscount + vatAmount);

    const invoice = {
      invoice_id: invoiceSeq,
      invoice_number: invoiceNumber,
      customer_id: data.customer_id || null,
      subtotal_amount: subtotal,
      discount_amount: discountAmount,
      vat_amount: vatAmount,
      grand_total: grandTotal,
      paid_amount: data.payment_method === 'DUE' ? 0 : grandTotal,
      due_amount: data.payment_method === 'DUE' ? grandTotal : 0,
      payment_method: data.payment_method || 'CASH',
      created_at: today,
      status: 'PAID'
    };

    db.sales_invoices.unshift(invoice);

    // Customer loyalty & balance update
    let customer = null;
    if (data.customer_id) {
      customer = db.customers.find(c => c.customer_id === parseInt(data.customer_id, 10));
      if (customer) {
        customer.loyalty_points = (customer.loyalty_points || 0) + Math.floor(grandTotal / 100);
        customer.total_purchased = (customer.total_purchased || 0) + grandTotal;
        if (invoice.due_amount > 0) {
          customer.current_due_balance = (customer.current_due_balance || 0) + invoice.due_amount;
        }
      }
    }

    saveDb(db);

    const settingsObj = {};
    (db.settings || []).forEach(s => { settingsObj[s.key] = s.value; });

    return {
      message: 'Checkout completed successfully',
      invoice: {
        ...invoice,
        items: billedItems,
        customer,
        settings: settingsObj
      }
    };
  },

  holdBill: async (data) => {
    const db = getDb();
    if (!db.held_bills) db.held_bills = [];
    const holdId = db.held_bills.length + 1;
    const hold = {
      hold_id: holdId,
      hold_reference: data.hold_reference || `HOLD-${Date.now().toString().slice(-4)}`,
      customer_name: data.customer_name || 'Walk-in',
      cart_data_json: JSON.stringify(data.cart_data || []),
      created_at: new Date().toISOString()
    };
    db.held_bills.push(hold);
    saveDb(db);
    return { message: 'Bill held successfully', hold_reference: hold.hold_reference };
  },

  getHeldBills: async () => {
    return getDb().held_bills || [];
  },

  deleteHeldBill: async (id) => {
    const db = getDb();
    db.held_bills = (db.held_bills || []).filter(h => h.hold_id !== parseInt(id, 10));
    saveDb(db);
    return { message: 'Held bill removed' };
  },

  lookupInvoice: async (query) => {
    const db = getDb();
    const inv = (db.sales_invoices || []).find(i =>
      i.invoice_number.toLowerCase() === query.toLowerCase() ||
      i.invoice_id === parseInt(query, 10)
    );
    if (!inv) throw new Error('Invoice not found');
    const customer = (db.customers || []).find(c => c.customer_id === inv.customer_id);
    return {
      invoice: inv,
      items: inv.items || [],
      customer
    };
  },

  processReturn: async (data) => {
    const db = getDb();
    const today = new Date().toISOString();
    // Restock items
    (data.returned_items || []).forEach(item => {
      const batch = (db.medicine_batches || []).find(b => b.batch_id === item.batch_id);
      if (batch) {
        batch.stock_qty_pieces += (item.qty_returned_pieces || item.qty_returned || 1);
      }
    });
    saveDb(db);
    return {
      message: 'Return processed successfully',
      refund_amount: data.refund_amount || 0,
      return_number: `RET-${Date.now().toString().slice(-6)}`
    };
  },

  // Inventory & Batches
  getBatches: async (medicineId) => {
    const db = getDb();
    let list = (db.medicine_batches || []).map(b => {
      const med = (db.medicines || []).find(m => m.medicine_id === b.medicine_id) || {};
      return {
        ...b,
        brand_name: med.brand_name || '',
        dosage_form: med.dosage_form || '',
        strength: med.strength || '',
        pieces_per_strip: med.pieces_per_strip || 10,
        strips_per_box: med.strips_per_box || 10
      };
    });
    if (medicineId) {
      list = list.filter(b => b.medicine_id === parseInt(medicineId, 10));
    }
    return list;
  },

  addBatch: async (data) => {
    const db = getDb();
    const newId = (db.medicine_batches.reduce((max, b) => Math.max(max, b.batch_id || 0), 0) || 0) + 1;
    const batch = {
      batch_id: newId,
      medicine_id: parseInt(data.medicine_id, 10),
      batch_number: data.batch_number,
      expiry_date: data.expiry_date,
      purchase_price_piece: parseFloat(data.purchase_price_piece || 0),
      selling_price_piece: parseFloat(data.selling_price_piece || 0),
      stock_qty_pieces: parseInt(data.stock_qty_pieces, 10) || 0,
      mrp_piece: parseFloat(data.mrp_piece || data.selling_price_piece || 0),
      created_at: new Date().toISOString()
    };
    db.medicine_batches.push(batch);
    saveDb(db);
    return { message: 'Batch added successfully', batch };
  },

  updateBatch: async (id, data) => {
    const db = getDb();
    const idx = (db.medicine_batches || []).findIndex(b => b.batch_id === parseInt(id, 10));
    if (idx !== -1) {
      db.medicine_batches[idx] = { ...db.medicine_batches[idx], ...data };
      saveDb(db);
    }
    return { message: 'Batch updated successfully' };
  },

  getAlerts: async () => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const d60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    const d90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

    const batches = (db.medicine_batches || []).map(b => {
      const med = db.medicines.find(m => m.medicine_id === b.medicine_id) || {};
      return { ...b, brand_name: med.brand_name || '', reorder_level: med.reorder_level || 50 };
    });

    const expired = batches.filter(b => b.stock_qty_pieces > 0 && b.expiry_date < today);
    const expiring30 = batches.filter(b => b.stock_qty_pieces > 0 && b.expiry_date >= today && b.expiry_date <= d30);
    const expiring60 = batches.filter(b => b.stock_qty_pieces > 0 && b.expiry_date > d30 && b.expiry_date <= d60);
    const expiring90 = batches.filter(b => b.stock_qty_pieces > 0 && b.expiry_date > d60 && b.expiry_date <= d90);

    const lowStock = (db.medicines || []).filter(m => {
      const stock = (db.medicine_batches || [])
        .filter(b => b.medicine_id === m.medicine_id && b.expiry_date >= today)
        .reduce((sum, b) => sum + b.stock_qty_pieces, 0);
      return stock <= (m.reorder_level || 50);
    }).map(m => {
      const stock = (db.medicine_batches || [])
        .filter(b => b.medicine_id === m.medicine_id && b.expiry_date >= today)
        .reduce((sum, b) => sum + b.stock_qty_pieces, 0);
      return { ...m, totalStockPieces: stock };
    });

    return {
      counts: {
        expired_count: expired.length,
        expiring_30_count: expiring30.length,
        expiring_60_count: expiring60.length,
        expiring_90_count: expiring90.length,
        low_stock_count: lowStock.length
      },
      expired,
      expiring_30: expiring30,
      expiring_60: expiring60,
      expiring_90: expiring90,
      lowStock
    };
  },

  recordWriteOff: async (data) => {
    const db = getDb();
    if (!db.damage_write_offs) db.damage_write_offs = [];
    const batch = (db.medicine_batches || []).find(b => b.batch_id === parseInt(data.batch_id, 10));
    if (batch) {
      batch.stock_qty_pieces = Math.max(0, batch.stock_qty_pieces - parseInt(data.qty_pieces, 10));
    }
    const writeOff = {
      write_off_id: db.damage_write_offs.length + 1,
      batch_id: parseInt(data.batch_id, 10),
      qty_pieces: parseInt(data.qty_pieces, 10),
      reason: data.reason || 'EXPIRED',
      loss_amount: (batch ? batch.purchase_price_piece : 10) * parseInt(data.qty_pieces, 10),
      created_at: new Date().toISOString()
    };
    db.damage_write_offs.push(writeOff);
    saveDb(db);
    return { message: 'Stock write-off recorded', write_off: writeOff };
  },

  getWriteOffs: async () => {
    return getDb().damage_write_offs || [];
  },

  // Purchases & Suppliers
  getSuppliers: async () => {
    return getDb().suppliers || [];
  },

  addSupplier: async (data) => {
    const db = getDb();
    const id = (db.suppliers.reduce((max, s) => Math.max(max, s.supplier_id || 0), 0) || 0) + 1;
    const sup = { supplier_id: id, ...data, created_at: new Date().toISOString() };
    db.suppliers.push(sup);
    saveDb(db);
    return { supplier: sup };
  },

  updateSupplier: async (id, data) => {
    const db = getDb();
    const idx = (db.suppliers || []).findIndex(s => s.supplier_id === parseInt(id, 10));
    if (idx !== -1) {
      db.suppliers[idx] = { ...db.suppliers[idx], ...data };
      saveDb(db);
    }
    return { message: 'Supplier updated successfully' };
  },

  getPurchases: async () => {
    const db = getDb();
    return (db.purchases || []).map(p => {
      const sup = (db.suppliers || []).find(s => s.supplier_id === p.supplier_id) || {};
      return { ...p, supplier_name: sup.name || '' };
    });
  },

  createPurchase: async (data) => {
    const db = getDb();
    if (!db.purchases) db.purchases = [];
    const purchaseId = db.purchases.length + 1;
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    let total = 0;
    (data.items || []).forEach(item => {
      const sub = (parseFloat(item.purchase_price_piece) || 10) * (parseInt(item.received_qty_pieces, 10) || 100);
      total += sub;

      // Add or update batch
      const newBatchId = (db.medicine_batches.reduce((max, b) => Math.max(max, b.batch_id || 0), 0) || 0) + 1;
      db.medicine_batches.push({
        batch_id: newBatchId,
        medicine_id: parseInt(item.medicine_id, 10),
        batch_number: item.batch_number || `BATCH-${Date.now().toString().slice(-4)}`,
        expiry_date: item.expiry_date,
        purchase_price_piece: parseFloat(item.purchase_price_piece),
        selling_price_piece: parseFloat(item.selling_price_piece),
        stock_qty_pieces: parseInt(item.received_qty_pieces, 10),
        created_at: new Date().toISOString()
      });
    });

    const purchase = {
      purchase_id: purchaseId,
      po_number: poNumber,
      supplier_id: parseInt(data.supplier_id, 10),
      total_amount: total,
      paid_amount: parseFloat(data.paid_amount || total),
      status: 'RECEIVED',
      created_at: new Date().toISOString()
    };
    db.purchases.unshift(purchase);
    saveDb(db);
    return { message: 'Purchase received & stock updated', purchase };
  },

  recordSupplierPayment: async (data) => {
    const db = getDb();
    return { message: 'Payment recorded successfully' };
  },

  // Customers
  getCustomers: async (q) => {
    const db = getDb();
    const term = (q || '').toLowerCase().trim();
    if (!term) return db.customers || [];
    return (db.customers || []).filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  },

  addCustomer: async (data) => {
    const db = getDb();
    const id = (db.customers.reduce((max, c) => Math.max(max, c.customer_id || 0), 0) || 0) + 1;
    const cust = {
      customer_id: id,
      name: data.name,
      phone: data.phone || '',
      address: data.address || '',
      loyalty_points: 0,
      current_due_balance: 0,
      total_purchased: 0,
      created_at: new Date().toISOString()
    };
    db.customers.push(cust);
    saveDb(db);
    return { customer: cust };
  },

  updateCustomer: async (id, data) => {
    const db = getDb();
    const idx = (db.customers || []).findIndex(c => c.customer_id === parseInt(id, 10));
    if (idx !== -1) {
      db.customers[idx] = { ...db.customers[idx], ...data };
      saveDb(db);
    }
    return { message: 'Customer updated successfully' };
  },

  getCustomerLedger: async (id) => {
    const db = getDb();
    const cust = (db.customers || []).find(c => c.customer_id === parseInt(id, 10));
    const invoices = (db.sales_invoices || []).filter(i => i.customer_id === parseInt(id, 10));
    return {
      customer: cust,
      invoices,
      payments: []
    };
  },

  recordCustomerPayment: async (id, data) => {
    const db = getDb();
    const cust = (db.customers || []).find(c => c.customer_id === parseInt(id, 10));
    if (cust) {
      cust.current_due_balance = Math.max(0, (cust.current_due_balance || 0) - parseFloat(data.amount || 0));
      saveDb(db);
    }
    return { message: 'Customer payment recorded' };
  },

  // Reports
  getSalesReport: async (period) => {
    const db = getDb();
    const totalSales = (db.sales_invoices || []).reduce((acc, i) => acc + (i.grand_total || 0), 0);
    const totalVat = (db.sales_invoices || []).reduce((acc, i) => acc + (i.vat_amount || 0), 0);
    const totalDiscount = (db.sales_invoices || []).reduce((acc, i) => acc + (i.discount_amount || 0), 0);
    return {
      summary: {
        total_invoices: db.sales_invoices.length,
        total_revenue: totalSales,
        total_vat: totalVat,
        total_discount: totalDiscount,
        avg_basket_value: db.sales_invoices.length > 0 ? (totalSales / db.sales_invoices.length).toFixed(2) : 0
      },
      invoices: (db.sales_invoices || []).slice(0, 20)
    };
  },

  getProfitLossReport: async (period) => {
    const db = getDb();
    const totalRevenue = (db.sales_invoices || []).reduce((acc, i) => acc + (i.grand_total || 0), 0);
    const cogs = totalRevenue * 0.72; // Average 28% margin
    const grossProfit = totalRevenue - cogs;
    return {
      total_revenue: totalRevenue,
      cogs: Math.round(cogs),
      gross_profit: Math.round(grossProfit),
      margin_percent: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '28.0'
    };
  },

  getFastMoving: async (limit) => {
    const db = getDb();
    return (db.medicines || []).slice(0, limit || 10).map((m, idx) => ({
      medicine_id: m.medicine_id,
      brand_name: m.brand_name,
      strength: m.strength,
      total_pieces_sold: 1500 - (idx * 120),
      total_revenue: (1500 - (idx * 120)) * 10
    }));
  },

  getExpiryLossReport: async () => {
    const db = getDb();
    const writeOffs = db.damage_write_offs || [];
    const totalLoss = writeOffs.reduce((acc, w) => acc + (w.loss_amount || 0), 0);
    return {
      total_loss_amount: totalLoss,
      write_offs: writeOffs
    };
  },

  // Users & Settings
  getUsers: async () => {
    return (getDb().users || []).map(u => ({
      user_id: u.user_id,
      full_name: u.full_name,
      username: u.username,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at
    }));
  },

  addUser: async (data) => {
    const db = getDb();
    const id = (db.users.reduce((max, u) => Math.max(max, u.user_id || 0), 0) || 0) + 1;
    const user = {
      user_id: id,
      full_name: data.full_name,
      username: data.username,
      role: data.role,
      is_active: 1,
      created_at: new Date().toISOString()
    };
    db.users.push(user);
    saveDb(db);
    return { user };
  },

  updateUser: async (id, data) => {
    const db = getDb();
    const idx = (db.users || []).findIndex(u => u.user_id === parseInt(id, 10));
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...data };
      saveDb(db);
    }
    return { message: 'User updated' };
  },

  getSettings: async () => {
    const db = getDb();
    const settingsObj = {};
    (db.settings || []).forEach(s => { settingsObj[s.key] = s.value; });
    return settingsObj;
  },

  updateSettings: async (data) => {
    const db = getDb();
    Object.keys(data).forEach(k => {
      const idx = (db.settings || []).findIndex(s => s.key === k);
      if (idx !== -1) {
        db.settings[idx].value = String(data[k]);
      } else {
        db.settings.push({ key: k, value: String(data[k]) });
      }
    });
    saveDb(db);
    return { message: 'Settings updated' };
  }
};
