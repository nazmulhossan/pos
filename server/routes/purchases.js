const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/purchases/suppliers
router.get('/suppliers', authenticateToken, (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY company_name ASC').all();
  res.json(suppliers);
});

// POST /api/purchases/suppliers
router.post('/suppliers', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { company_name, contact_person, phone, total_due } = req.body;
  if (!company_name) {
    return res.status(400).json({ error: 'Company name is required.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO suppliers (company_name, contact_person, phone, total_due)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(company_name, contact_person || '', phone || '', parseFloat(total_due) || 0.00);
    res.status(201).json({ message: 'Supplier added', supplier_id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/purchases/suppliers/:id
router.put('/suppliers/:id', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { company_name, contact_person, phone } = req.body;

  try {
    db.prepare(`
      UPDATE suppliers SET company_name = ?, contact_person = ?, phone = ?
      WHERE supplier_id = ?
    `).run(company_name, contact_person || '', phone || '', id);
    res.json({ message: 'Supplier updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/purchases (History of incoming supplier stock invoices)
router.get('/', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT p.*, s.company_name as supplier_name, s.phone as supplier_phone, u.full_name as received_by
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.supplier_id
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.purchase_id DESC
    `).all();

    const formatted = purchases.map(p => {
      const items = db.prepare(`
        SELECT pi.*, b.batch_number, b.expiry_date, m.brand_name, m.dosage_form, m.strength
        FROM purchase_items pi
        JOIN medicine_batches b ON pi.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id
        WHERE pi.purchase_id = ?
      `).all(p.purchase_id);

      return {
        ...p,
        items
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve purchases: ' + err.message });
  }
});

// POST /api/purchases (Create Purchase Invoice & Receive Stock into Batches)
router.post('/', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const {
    supplier_id,
    invoice_number,
    purchase_date,
    items, // Array of { medicine_id, batch_number, expiry_date, unit_type ('PIECE'|'STRIP'|'BOX'), quantity_received, unit_cost_piece, selling_price_piece }
    paid_amount,
    notes
  } = req.body;

  if (!supplier_id || !invoice_number || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Required fields: supplier_id, invoice_number, items array.' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');

    let totalAmount = 0;
    const processedItems = [];

    // Calculate total and prepare batches
    for (const item of items) {
      const medicine = db.prepare('SELECT * FROM medicines WHERE medicine_id = ?').get(item.medicine_id);
      if (!medicine) {
        throw new Error(`Medicine #${item.medicine_id} not found.`);
      }

      const unitType = (item.unit_type || 'PIECE').toUpperCase();
      let factor = 1;
      if (unitType === 'STRIP') factor = medicine.pieces_per_strip;
      else if (unitType === 'BOX') factor = medicine.pieces_per_strip * medicine.strips_per_box;

      const qtyPieces = Math.round(parseFloat(item.quantity_received) * factor);
      const unitCostPiece = parseFloat(item.unit_cost_piece);
      const sellPricePiece = parseFloat(item.selling_price_piece);

      if (qtyPieces <= 0 || isNaN(unitCostPiece) || isNaN(sellPricePiece)) {
        throw new Error(`Invalid quantity or pricing for medicine ${medicine.brand_name}`);
      }

      const lineTotal = +(qtyPieces * unitCostPiece).toFixed(2);
      totalAmount += lineTotal;

      // Check if batch number already exists for this medicine
      let batch = db.prepare(`
        SELECT * FROM medicine_batches WHERE medicine_id = ? AND batch_number = ?
      `).get(medicine.medicine_id, item.batch_number.trim());

      let batchId;
      if (batch) {
        // Increment stock and update prices & expiry
        db.prepare(`
          UPDATE medicine_batches SET
            stock_qty_pieces = stock_qty_pieces + ?,
            purchase_price_piece = ?,
            selling_price_piece = ?,
            expiry_date = ?
          WHERE batch_id = ?
        `).run(qtyPieces, unitCostPiece, sellPricePiece, item.expiry_date, batch.batch_id);
        batchId = batch.batch_id;
      } else {
        // Create new batch record
        const insertBatch = db.prepare(`
          INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const bResult = insertBatch.run(medicine.medicine_id, item.batch_number.trim(), item.expiry_date, unitCostPiece, sellPricePiece, qtyPieces);
        batchId = bResult.lastInsertRowid;
      }

      processedItems.push({
        batch_id: batchId,
        quantity_pieces: qtyPieces,
        unit_cost: unitCostPiece,
        subtotal: lineTotal
      });
    }

    totalAmount = +totalAmount.toFixed(2);
    const paid = parseFloat(paid_amount) || 0.00;
    const due = Math.max(0, +(totalAmount - paid).toFixed(2));

    // Insert purchase header
    const insertPurchase = db.prepare(`
      INSERT INTO purchases (supplier_id, user_id, invoice_number, purchase_date, total_amount, paid_amount, due_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const pResult = insertPurchase.run(
      supplier_id,
      req.user.user_id,
      invoice_number.trim(),
      purchase_date || new Date().toISOString().split('T')[0],
      totalAmount,
      paid,
      due,
      notes || null
    );

    const purchaseId = pResult.lastInsertRowid;

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO purchase_items (purchase_id, batch_id, quantity_pieces, unit_cost, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const pItem of processedItems) {
      insertItem.run(purchaseId, pItem.batch_id, pItem.quantity_pieces, pItem.unit_cost, pItem.subtotal);
    }

    // Update supplier running due balance
    if (due > 0) {
      db.prepare('UPDATE suppliers SET total_due = total_due + ? WHERE supplier_id = ?').run(due, supplier_id);
    }

    db.exec('COMMIT');

    res.status(201).json({
      message: 'Purchase invoice recorded and stock successfully added to inventory batches.',
      purchase_id: purchaseId,
      total_amount: totalAmount,
      paid_amount: paid,
      due_amount: due
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// POST /api/purchases/payments (Supplier Payment Voucher)
router.post('/payments', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { supplier_id, amount, payment_method, notes } = req.body;
  const payAmount = parseFloat(amount);

  if (!supplier_id || !payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Valid supplier ID and positive payment amount are required.' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');

    db.prepare(`
      INSERT INTO supplier_payments (supplier_id, user_id, amount, payment_method, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(supplier_id, req.user.user_id, payAmount, payment_method || 'CASH', notes || null);

    db.prepare(`
      UPDATE suppliers SET total_due = MAX(0, total_due - ?) WHERE supplier_id = ?
    `).run(payAmount, supplier_id);

    db.exec('COMMIT');

    res.json({ message: 'Supplier payment recorded successfully', amount: payAmount });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
