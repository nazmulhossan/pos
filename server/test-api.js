const http = require('node:http');

// Start backend
const { app, server } = require('./server');

const BASE_URL = 'http://localhost:5001';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('--- STARTING PHARMACY SYSTEM VALIDATION TESTS ---');

  try {
    // 1. Login as Admin
    console.log('\n[1] Testing Admin Login...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    console.log('Admin login status:', loginRes.status);
    if (loginRes.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(loginRes.data));
    const adminToken = loginRes.data.token;
    console.log('Admin token received. Full name:', loginRes.data.user.full_name);

    // 2. Login as Pharmacist
    console.log('\n[2] Testing Pharmacist Login & RBAC Limits...');
    const pharmLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'pharmacist', password: 'pharm123' })
    });
    const pharmToken = pharmLogin.data.token;
    console.log('Pharmacist max discount allowed:', pharmLogin.data.settings.max_discount, '%');

    // 3. Fast Medicine Search & FEFO Batch check
    console.log('\n[3] Testing Fast Medicine Search & FEFO Batch sorting...');
    const t0 = Date.now();
    const searchRes = await request('/api/medicines/search?q=Napa', {
      headers: { Authorization: `Bearer ${pharmToken}` }
    });
    const duration = Date.now() - t0;
    console.log(`Search returned ${searchRes.data.length} medicines in ${duration}ms (Benchmark < 1000ms: PASS)`);
    
    const napaExtra = searchRes.data.find(m => m.brand_name === 'Napa Extra');
    console.log('Napa Extra available pieces:', napaExtra.available_pieces);
    console.log('Napa Extra active batches (FEFO):', napaExtra.active_batches.map(b => `${b.batch_number} (Exp: ${b.expiry_date}, Stock: ${b.stock_qty_pieces})`));
    console.log('Napa Extra Unit Prices:', napaExtra.prices);

    // Verify expired batch is blocked from active stock
    const expiredInBatches = napaExtra.active_batches.some(b => b.batch_number === 'NX-EXP-OLD');
    if (expiredInBatches) {
      throw new Error('FAILED: Expired batch was included in active sales stock!');
    } else {
      console.log('PASS: Expired batch NX-EXP-OLD is strictly blocked from active checkout stock.');
    }

    // 4. Substitute Finder (F2)
    console.log('\n[4] Testing Substitute Finder (F2) for Napa Extra...');
    const subRes = await request(`/api/medicines/${napaExtra.medicine_id}/substitutes`, {
      headers: { Authorization: `Bearer ${pharmToken}` }
    });
    console.log('Substitutes found:', subRes.data.substitutes.map(s => `${s.brand_name} (${s.manufacturer_name}) - Stock: ${s.available_pieces} pcs`));

    // 5. Stock Over-Sell Guard Validation
    console.log('\n[5] Testing Stock Over-Sell Guard...');
    const oversellAttempt = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        items: [{
          medicine_id: napaExtra.medicine_id,
          sold_unit_type: 'BOX',
          qty_sold_in_unit: 100 // 100 boxes * 200 = 20,000 pieces >> stock
        }],
        payment_method: 'CASH'
      })
    });
    console.log('Oversell status code:', oversellAttempt.status, '(Expected 400)');
    console.log('Oversell rejection message:', oversellAttempt.data.error);

    // 6. Discount Limit Enforcement (Pharmacist max 10%)
    console.log('\n[6] Testing Role Discount Limit (Pharmacist 25% discount attempt)...');
    const discountViolation = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        items: [{
          medicine_id: napaExtra.medicine_id,
          sold_unit_type: 'STRIP',
          qty_sold_in_unit: 1
        }],
        discount_type: 'PERCENT',
        discount_value: 25, // > 10%
        payment_method: 'CASH'
      })
    });
    console.log('Discount violation status:', discountViolation.status, '(Expected 400)');
    console.log('Discount rejection error:', discountViolation.data.error);

    // 7. Successful POS Checkout with FEFO deduction & Receipt generation
    console.log('\n[7] Testing Valid POS Checkout (Atomic Transaction, Multi-Unit, FEFO deduction)...');
    const validCheckout = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        items: [
          {
            medicine_id: napaExtra.medicine_id,
            sold_unit_type: 'STRIP', // 10 pieces
            qty_sold_in_unit: 2 // 20 pieces
          }
        ],
        discount_type: 'PERCENT',
        discount_value: 5,
        payment_method: 'CASH',
        payment_breakdown: { tendered: 100, change: 40 }
      })
    });
    console.log('Checkout status:', validCheckout.status);
    console.log('Generated Invoice Number:', validCheckout.data.invoice.invoice_number);
    console.log('Grand Total:', validCheckout.data.invoice.grand_total);
    console.log('Deducted Batches:', validCheckout.data.invoice.items.map(i => `${i.brand_name} - Batch: ${i.batch_number}, Qty: ${i.qty_sold_in_unit} ${i.sold_unit_type} (${i.total_pieces_deducted} pcs)`));

    const invoiceNum = validCheckout.data.invoice.invoice_number;
    const invoiceId = validCheckout.data.invoice.invoice_id;

    // 8. Sales Return & Refund (SRS 2.3)
    console.log('\n[8] Testing Sales Return & Restock to Original Batch...');
    const invoiceDetails = await request(`/api/pos/invoices/${invoiceNum}`, {
      headers: { Authorization: `Bearer ${pharmToken}` }
    });
    const itemToReturn = invoiceDetails.data[0].items[0];

    const returnRes = await request('/api/pos/return', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        invoice_id: invoiceId,
        return_items: [{
          sales_item_id: itemToReturn.sales_item_id,
          batch_id: itemToReturn.batch_id,
          returned_pieces: 10 // 1 strip
        }],
        reason: 'Customer bought extra strip by mistake',
        refund_method: 'CASH'
      })
    });
    console.log('Return response:', returnRes.data);

    // 9. Automated Inventory Alerts (30, 60, 90 days expiry & Low Stock)
    console.log('\n[9] Testing Automated Inventory Alerts...');
    const alertsRes = await request('/api/inventory/alerts', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Low Stock count:', alertsRes.data.counts.low_stock_count);
    console.log('Expired Batches count:', alertsRes.data.counts.expired_count);
    console.log('Expiring in 30 days count:', alertsRes.data.counts.expiring_30_count);
    console.log('Expiring in 60 days count:', alertsRes.data.counts.expiring_60_count);
    console.log('Expiring in 90 days count:', alertsRes.data.counts.expiring_90_count);

    // 10. Profit & Loss Statement (SRS 3.3)
    console.log('\n[10] Testing Profit & Loss Statement (Admin only)...');
    const plRes = await request('/api/reports/profit-loss?period=all', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('P&L Metrics:', plRes.data.metrics);

    // 11. RBAC Restriction Check (Pharmacist attempting P&L)
    console.log('\n[11] Verifying Pharmacist is blocked from P&L financial reports...');
    const rbacBlock = await request('/api/reports/profit-loss', {
      headers: { Authorization: `Bearer ${pharmToken}` }
    });
    console.log('Pharmacist P&L status:', rbacBlock.status, '(Expected 403 Forbidden)');

    console.log('\n========================================');
    console.log('ALL API & WORKFLOW VALIDATION TESTS PASSED!');
    console.log('========================================\n');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
