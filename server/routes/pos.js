const express = require('express');
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper to generate invoice number (e.g., INV-2026-0005)
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const lastInvoice = db.prepare(`
    SELECT invoice_number FROM sales_invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_id DESC LIMIT 1
  `).get(`INV-${year}-%`);

  let nextSeq = 1;
  if (lastInvoice && lastInvoice.invoice_number) {
    const parts = lastInvoice.invoice_number.split('-');
    const currentSeq = parseInt(parts[2], 10);
    if (!isNaN(currentSeq)) {
      nextSeq = currentSeq + 1;
    }
  }

  return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
}

// POST /api/pos/checkout
// Atomic transaction for POS billing with FEFO batch deduction, stock guard, and discount limits
router.post('/checkout', authenticateToken, (req, res) => {
  const {
    items, // Array of { medicine_id, sold_unit_type ('PIECE'|'STRIP'|'BOX'), qty_sold_in_unit, custom_price (optional) }
    customer_id,
    customer_data, // Optional quick customer registration: { name, phone, address }
    discount_type, // 'PERCENT' or 'FLAT'
    discount_value,
    vat_percent_custom,
    payment_method, // 'CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'SPLIT', 'DUE'
    payment_breakdown, // Object detailing amounts: { tendered, change, cash, card, mfs, mfs_provider, trx_id, due }
    prescription_url,
    notes
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add items to checkout.' });
  }

  // Load system settings for discount thresholds & VAT
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  const role = req.user.role;
  let maxDiscountAllowed = 10;
  if (role === 'ADMIN') {
    maxDiscountAllowed = parseFloat(settings.max_discount_admin || '100');
  } else if (role === 'INVENTORY_MANAGER') {
    maxDiscountAllowed = parseFloat(settings.max_discount_inventory_manager || '20');
  } else {
    maxDiscountAllowed = parseFloat(settings.max_discount_pharmacist || '10');
  }

  const vatPercent = vat_percent_custom !== undefined 
    ? parseFloat(vat_percent_custom) 
    : parseFloat(settings.vat_percent || '5');

  // Start atomic transaction
  try {
    db.exec('BEGIN IMMEDIATE');

    let resolvedCustomerId = customer_id ? parseInt(customer_id, 10) : null;

    // Quick register customer if new customer data provided
    if (!resolvedCustomerId && customer_data && customer_data.phone) {
      const existingCust = db.prepare('SELECT customer_id FROM customers WHERE phone = ?').get(customer_data.phone);
      if (existingCust) {
        resolvedCustomerId = existingCust.customer_id;
      } else {
        const createCustStmt = db.prepare(`
          INSERT INTO customers (name, phone, address, total_due)
          VALUES (?, ?, ?, 0.00)
        `);
        const custRes = createCustStmt.run(customer_data.name || 'Walk-in Customer', customer_data.phone, customer_data.address || '');
        resolvedCustomerId = custRes.lastInsertRowid;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    let subtotal = 0;
    const processedItems = []; // Array of sales_items to record

    // Verify stock availability, FEFO batches, unit conversions
    for (const item of items) {
      const medicine = db.prepare(`
        SELECT medicine_id, brand_name, dosage_form, strength, pieces_per_strip, strips_per_box, is_rx_required
        FROM medicines WHERE medicine_id = ?
      `).get(item.medicine_id);

      if (!medicine) {
        throw new Error(`Medicine with ID ${item.medicine_id} not found.`);
      }

      // Check unit multiplier
      const unitType = (item.sold_unit_type || 'PIECE').toUpperCase();
      let piecesPerUnit = 1;
      if (unitType === 'STRIP') {
        piecesPerUnit = medicine.pieces_per_strip;
      } else if (unitType === 'BOX') {
        piecesPerUnit = medicine.pieces_per_strip * medicine.strips_per_box;
      }

      const qtyInUnit = parseFloat(item.qty_sold_in_unit) || 1;
      const totalPiecesNeeded = Math.round(qtyInUnit * piecesPerUnit);

      if (totalPiecesNeeded <= 0) {
        throw new Error(`Invalid quantity for ${medicine.brand_name}`);
      }

      // Query active non-expired batches sorted by FEFO (earliest expiry first)
      const activeBatches = db.prepare(`
        SELECT batch_id, batch_number, expiry_date, selling_price_piece, purchase_price_piece, stock_qty_pieces
        FROM medicine_batches
        WHERE medicine_id = ? AND stock_qty_pieces > 0 AND expiry_date >= ?
        ORDER BY expiry_date ASC
      `).all(medicine.medicine_id, today);

      const totalAvailablePieces = activeBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);

      // STOCK OVER-SELL GUARD (SRS 2.2)
      if (totalPiecesNeeded > totalAvailablePieces) {
        throw new Error(
          `Stock guard alert: Insufficient active non-expired stock for "${medicine.brand_name}". ` +
          `Required: ${totalPiecesNeeded} pieces (${qtyInUnit} ${unitType}), Available: ${totalAvailablePieces} pieces.`
        );
      }

      // Deduct pieces across batches according to FEFO
      let piecesRemainingToDeduct = totalPiecesNeeded;

      for (const batch of activeBatches) {
        if (piecesRemainingToDeduct <= 0) break;

        const deductFromThisBatch = Math.min(batch.stock_qty_pieces, piecesRemainingToDeduct);
        const newBatchStock = batch.stock_qty_pieces - deductFromThisBatch;

        // Atomic update of medicine_batches
        db.prepare(`
          UPDATE medicine_batches SET stock_qty_pieces = ? WHERE batch_id = ?
        `).run(newBatchStock, batch.batch_id);

        // Price calculation: standard selling price per piece or custom line price
        const linePiecePrice = item.custom_price_piece !== undefined 
          ? parseFloat(item.custom_price_piece) 
          : batch.selling_price_piece;
        
        const lineSubtotal = +(deductFromThisBatch * linePiecePrice).toFixed(2);
        subtotal += lineSubtotal;

        // Calculate proportional unit price for display
        const displayUnitPrice = +(linePiecePrice * piecesPerUnit).toFixed(2);
        const proportionalUnitQty = +(deductFromThisBatch / piecesPerUnit).toFixed(2);

        processedItems.push({
          batch_id: batch.batch_id,
          batch_number: batch.batch_number,
          medicine_id: medicine.medicine_id,
          brand_name: medicine.brand_name,
          dosage_form: medicine.dosage_form,
          strength: medicine.strength,
          sold_unit_type: unitType,
          qty_sold_in_unit: proportionalUnitQty,
          total_pieces_deducted: deductFromThisBatch,
          unit_price: displayUnitPrice,
          subtotal: lineSubtotal
        });

        piecesRemainingToDeduct -= deductFromThisBatch;
      }
    }

    subtotal = +subtotal.toFixed(2);

    // Calculate Discount & Enforce Role Limits (SRS 2.1 #6 & 2.2 F8)
    let discountAmount = 0;
    const dVal = parseFloat(discount_value) || 0;
    const dType = (discount_type || 'PERCENT').toUpperCase();

    if (dVal > 0) {
      if (dType === 'PERCENT') {
        if (dVal > maxDiscountAllowed) {
          throw new Error(`Discount of ${dVal}% exceeds your role (${role}) maximum allowed discount limit of ${maxDiscountAllowed}%.`);
        }
        discountAmount = +((subtotal * dVal) / 100).toFixed(2);
      } else {
        // Flat discount
        const calculatedPercent = (dVal / subtotal) * 100;
        if (calculatedPercent > maxDiscountAllowed) {
          throw new Error(`Flat discount of ${dVal} is ${calculatedPercent.toFixed(1)}%, which exceeds your role (${role}) maximum allowed discount of ${maxDiscountAllowed}%.`);
        }
        discountAmount = Math.min(dVal, subtotal);
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const vatAmount = +((taxableAmount * vatPercent) / 100).toFixed(2);
    // Round net payable total (SRS 2.1 #6)
    const grandTotal = Math.round(taxableAmount + vatAmount);

    // Payment validation & Customer Due calculation
    const breakdown = payment_breakdown || {};
    let paidAmount = 0;
    let dueAmount = 0;

    const pm = (payment_method || 'CASH').toUpperCase();

    if (pm === 'CASH') {
      const tendered = parseFloat(breakdown.tendered) || grandTotal;
      paidAmount = Math.min(tendered, grandTotal);
      dueAmount = Math.max(0, grandTotal - paidAmount);
    } else if (pm === 'DUE') {
      paidAmount = 0;
      dueAmount = grandTotal;
    } else if (pm === 'SPLIT') {
      const splitCash = parseFloat(breakdown.cash) || 0;
      const splitCard = parseFloat(breakdown.card) || 0;
      const splitMfs = parseFloat(breakdown.mfs) || 0;
      paidAmount = splitCash + splitCard + splitMfs;
      dueAmount = Math.max(0, grandTotal - paidAmount);
    } else {
      // CARD or MFS (bKash, Nagad, Rocket)
      paidAmount = grandTotal;
      dueAmount = 0;
    }

    paidAmount = +paidAmount.toFixed(2);
    dueAmount = +dueAmount.toFixed(2);

    // Strict validation: if sale has due amount, customer MUST be registered (SRS 2.1 #5)
    if (dueAmount > 0 && !resolvedCustomerId) {
      throw new Error('Customer registration/selection is strictly REQUIRED for credit/due sales.');
    }

    // Update customer total_due if due balance exists
    if (dueAmount > 0 && resolvedCustomerId) {
      db.prepare(`
        UPDATE customers SET total_due = total_due + ? WHERE customer_id = ?
      `).run(dueAmount, resolvedCustomerId);
    }

    const invoiceNumber = generateInvoiceNumber();

    // Insert sales_invoices
    const insertInvoice = db.prepare(`
      INSERT INTO sales_invoices (
        invoice_number, customer_id, user_id, sale_date, subtotal,
        discount_amount, vat_amount, grand_total, paid_amount,
        due_amount, payment_method, payment_breakdown, prescription_url, notes
      ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const invResult = insertInvoice.run(
      invoiceNumber,
      resolvedCustomerId,
      req.user.user_id,
      subtotal,
      discountAmount,
      vatAmount,
      grandTotal,
      paidAmount,
      dueAmount,
      pm,
      JSON.stringify(breakdown),
      prescription_url || null,
      notes || null
    );

    const invoiceId = invResult.lastInsertRowid;

    // Insert sales_items
    const insertItem = db.prepare(`
      INSERT INTO sales_items (
        invoice_id, batch_id, sold_unit_type, qty_sold_in_unit,
        total_pieces_deducted, unit_price, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const pItem of processedItems) {
      insertItem.run(
        invoiceId,
        pItem.batch_id,
        pItem.sold_unit_type,
        pItem.qty_sold_in_unit,
        pItem.total_pieces_deducted,
        pItem.unit_price,
        pItem.subtotal
      );
    }

    db.exec('COMMIT');

    // Fetch customer info if any
    let customer = null;
    if (resolvedCustomerId) {
      customer = db.prepare('SELECT customer_id, name, phone, address, total_due FROM customers WHERE customer_id = ?').get(resolvedCustomerId);
    }

    // Return complete invoice payload for display and printing
    res.status(201).json({
      message: 'Transaction completed successfully',
      invoice: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        sale_date: new Date().toISOString(),
        cashier_name: req.user.full_name,
        customer,
        items: processedItems,
        subtotal,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_method: pm,
        payment_breakdown: breakdown,
        prescription_url
      }
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('POS Checkout error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pos/hold (Shortcut F4)
router.post('/hold', authenticateToken, (req, res) => {
  const { reference_note, cart_data, customer_id, discount_val, discount_type } = req.body;
  if (!cart_data || cart_data.length === 0) {
    return res.status(400).json({ error: 'Cannot hold an empty cart' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO held_bills (reference_note, cart_data, customer_id, discount_val, discount_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      reference_note || `Hold Bill #${Date.now().toString().slice(-4)}`,
      JSON.stringify(cart_data),
      customer_id || null,
      discount_val || 0,
      discount_type || 'PERCENT',
      req.user.user_id
    );

    res.json({ message: 'Cart held successfully', held_id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to hold bill: ' + err.message });
  }
});

// GET /api/pos/held (Shortcut F5)
router.get('/held', authenticateToken, (req, res) => {
  try {
    const list = db.prepare(`
      SELECT h.*, u.full_name as held_by, c.name as customer_name, c.phone as customer_phone
      FROM held_bills h
      JOIN users u ON h.user_id = u.user_id
      LEFT JOIN customers c ON h.customer_id = c.customer_id
      ORDER BY h.held_id DESC
    `).all();

    const formatted = list.map(item => ({
      ...item,
      cart_data: JSON.parse(item.cart_data)
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve held bills: ' + err.message });
  }
});

// DELETE /api/pos/held/:id
router.delete('/held/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    db.prepare('DELETE FROM held_bills WHERE held_id = ?').run(id);
    res.json({ message: 'Held bill cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete held bill' });
  }
});

// GET /api/pos/invoices/:search
// Lookup invoice for Returns or reprint by invoice number or customer phone (SRS 2.3)
router.get('/invoices/:search', authenticateToken, (req, res) => {
  const query = req.params.search.trim();

  try {
    const invoices = db.prepare(`
      SELECT i.*, u.full_name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM sales_invoices i
      JOIN users u ON i.user_id = u.user_id
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      WHERE i.invoice_number = ? OR c.phone = ?
      ORDER BY i.invoice_id DESC
      LIMIT 20
    `).all(query, query);

    if (invoices.length === 0) {
      return res.status(404).json({ error: `No transaction found matching "${query}"` });
    }

    const results = invoices.map(inv => {
      // Fetch items
      const items = db.prepare(`
        SELECT si.*, m.medicine_id, m.brand_name, m.dosage_form, m.strength, m.pieces_per_strip, m.strips_per_box,
               b.batch_number, b.expiry_date
        FROM sales_items si
        JOIN medicine_batches b ON si.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id
        WHERE si.invoice_id = ?
      `).all(inv.invoice_id);

      // Fetch any past returns on this invoice
      const pastReturns = db.prepare(`
        SELECT r.*, u.full_name as processed_by, b.batch_number
        FROM sales_returns r
        JOIN users u ON r.user_id = u.user_id
        JOIN medicine_batches b ON r.batch_id = b.batch_id
        WHERE r.invoice_id = ?
      `).all(inv.invoice_id);

      return {
        ...inv,
        items,
        past_returns: pastReturns
      };
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup invoice: ' + err.message });
  }
});

// POST /api/pos/return
// Process Sales Return & Refund (SRS 2.3)
router.post('/return', authenticateToken, (req, res) => {
  const {
    invoice_id,
    return_items, // Array of { sales_item_id, batch_id, returned_pieces, refund_amount }
    reason,
    refund_method // 'CASH', 'DUE_ADJUSTMENT', 'MFS'
  } = req.body;

  if (!invoice_id || !return_items || !Array.isArray(return_items) || return_items.length === 0) {
    return res.status(400).json({ error: 'Please specify items and quantities to return.' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Return reason is required for audit logs.' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');

    const invoice = db.prepare('SELECT * FROM sales_invoices WHERE invoice_id = ?').get(invoice_id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    let totalRefundCalculated = 0;

    for (const rItem of return_items) {
      const salesItem = db.prepare('SELECT * FROM sales_items WHERE sales_item_id = ? AND invoice_id = ?').get(rItem.sales_item_id, invoice_id);
      if (!salesItem) {
        throw new Error(`Sales item #${rItem.sales_item_id} not found in this invoice`);
      }

      const returnedPieces = parseInt(rItem.returned_pieces, 10);
      if (returnedPieces <= 0 || returnedPieces > salesItem.total_pieces_deducted) {
        throw new Error(`Invalid return quantity (${returnedPieces} pieces) for item #${rItem.sales_item_id}`);
      }

      // Calculate proportional refund considering original discounts
      // Price per piece paid = subtotal / total_pieces_deducted
      const effectivePiecePrice = salesItem.subtotal / salesItem.total_pieces_deducted;
      // Proportional discount factor
      const discountRatio = invoice.subtotal > 0 ? (invoice.discount_amount / invoice.subtotal) : 0;
      const refundedItemSubtotal = returnedPieces * effectivePiecePrice * (1 - discountRatio);
      const refundAmount = +(refundedItemSubtotal).toFixed(2);

      totalRefundCalculated += refundAmount;

      // 1. Credit returned pieces back to original batch (SRS 2.3)
      db.prepare(`
        UPDATE medicine_batches 
        SET stock_qty_pieces = stock_qty_pieces + ?
        WHERE batch_id = ?
      `).run(returnedPieces, salesItem.batch_id);

      // 2. Log audit entry in sales_returns (SRS 2.3)
      db.prepare(`
        INSERT INTO sales_returns (invoice_id, batch_id, user_id, returned_pieces, refund_amount, reason, return_date)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        invoice_id,
        salesItem.batch_id,
        req.user.user_id,
        returnedPieces,
        refundAmount,
        reason
      );
    }

    totalRefundCalculated = +totalRefundCalculated.toFixed(2);

    // If invoice had due and customer balance needs reduction
    if (invoice.customer_id && refund_method === 'DUE_ADJUSTMENT') {
      db.prepare(`
        UPDATE customers SET total_due = MAX(0, total_due - ?) WHERE customer_id = ?
      `).run(totalRefundCalculated, invoice.customer_id);
    }

    db.exec('COMMIT');

    res.json({
      message: 'Return processed and stock successfully restocked.',
      total_refund_amount: totalRefundCalculated,
      refund_method: refund_method || 'CASH'
    });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Return error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
