const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/batches
// List all batches with medicine details, expiry status, and stock
router.get('/batches', authenticateToken, (req, res) => {
  const isPharmacist = req.user.role === 'PHARMACIST';
  const medicineId = req.query.medicine_id ? parseInt(req.query.medicine_id, 10) : null;

  try {
    let sql = `
      SELECT b.*, m.brand_name, m.dosage_form, m.strength, m.barcode,
             m.pieces_per_strip, m.strips_per_box, m.reorder_level,
             g.generic_name, mf.name as manufacturer_name
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      JOIN generics g ON m.generic_id = g.generic_id
      JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
    `;
    const params = [];

    if (medicineId) {
      sql += ' WHERE b.medicine_id = ?';
      params.push(medicineId);
    }

    sql += ' ORDER BY b.expiry_date ASC, m.brand_name ASC';

    const batches = db.prepare(sql).all(...params);
    const today = new Date();

    const formatted = batches.map(b => {
      const expDate = new Date(b.expiry_date);
      const diffTime = expDate - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let expiryStatus = 'VALID';
      if (daysUntilExpiry < 0) {
        expiryStatus = 'EXPIRED';
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = 'EXPIRING_30_DAYS';
      } else if (daysUntilExpiry <= 60) {
        expiryStatus = 'EXPIRING_60_DAYS';
      } else if (daysUntilExpiry <= 90) {
        expiryStatus = 'EXPIRING_90_DAYS';
      }

      // Convert pieces to strips & boxes for human readability
      const strips = Math.floor(b.stock_qty_pieces / b.pieces_per_strip);
      const remainingPieces = b.stock_qty_pieces % b.pieces_per_strip;

      return {
        ...b,
        purchase_price_piece: isPharmacist ? null : b.purchase_price_piece,
        days_until_expiry: daysUntilExpiry,
        expiry_status: expiryStatus,
        stock_summary: `${strips} Strips, ${remainingPieces} Pcs (${b.stock_qty_pieces} total pieces)`
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve batches: ' + err.message });
  }
});

// GET /api/inventory/alerts
// Automated alerts for low-stock and 30, 60, 90 days early expiry (SRS 3.2)
router.get('/alerts', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Low stock alerts (sum of active non-expired stock <= reorder_level)
    const lowStockMedicines = db.prepare(`
      SELECT m.medicine_id, m.brand_name, m.dosage_form, m.strength, m.barcode,
             m.pieces_per_strip, m.strips_per_box, m.reorder_level,
             g.generic_name, mf.name as manufacturer_name,
             COALESCE(SUM(b.stock_qty_pieces), 0) as current_stock_pieces
      FROM medicines m
      JOIN generics g ON m.generic_id = g.generic_id
      JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
      LEFT JOIN medicine_batches b ON m.medicine_id = b.medicine_id AND b.expiry_date >= ?
      GROUP BY m.medicine_id
      HAVING current_stock_pieces <= m.reorder_level
      ORDER BY current_stock_pieces ASC
    `).all(today);

    // 2. Expiry alerts: expired, <= 30d, <= 60d, <= 90d
    const allBatches = db.prepare(`
      SELECT b.batch_id, b.batch_number, b.expiry_date, b.stock_qty_pieces,
             b.purchase_price_piece, b.selling_price_piece,
             m.medicine_id, m.brand_name, m.dosage_form, m.strength,
             g.generic_name, mf.name as manufacturer_name
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      JOIN generics g ON m.generic_id = g.generic_id
      JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
      WHERE b.stock_qty_pieces > 0
      ORDER BY b.expiry_date ASC
    `).all();

    const isPharmacist = req.user.role === 'PHARMACIST';
    const now = new Date();

    const expired = [];
    const expiring30 = [];
    const expiring60 = [];
    const expiring90 = [];

    for (const b of allBatches) {
      const expDate = new Date(b.expiry_date);
      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

      const item = {
        ...b,
        purchase_price_piece: isPharmacist ? null : b.purchase_price_piece,
        potential_loss: isPharmacist ? null : +(b.stock_qty_pieces * b.purchase_price_piece).toFixed(2),
        days_until_expiry: diffDays
      };

      if (diffDays < 0) {
        expired.push(item);
      } else if (diffDays <= 30) {
        expiring30.push(item);
      } else if (diffDays <= 60) {
        expiring60.push(item);
      } else if (diffDays <= 90) {
        expiring90.push(item);
      }
    }

    res.json({
      low_stock: lowStockMedicines,
      expiry_alerts: {
        expired,
        expiring_30_days: expiring30,
        expiring_60_days: expiring60,
        expiring_90_days: expiring90
      },
      counts: {
        low_stock_count: lowStockMedicines.length,
        expired_count: expired.length,
        expiring_30_count: expiring30.length,
        expiring_60_count: expiring60.length,
        expiring_90_count: expiring90.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory alerts: ' + err.message });
  }
});

// POST /api/inventory/batches
// Create new batch (Admin & Inventory Manager)
router.post('/batches', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { medicine_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces } = req.body;

  if (!medicine_id || !batch_number || !expiry_date || purchase_price_piece === undefined || selling_price_piece === undefined) {
    return res.status(400).json({ error: 'Required fields: medicine_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      medicine_id,
      batch_number,
      expiry_date,
      parseFloat(purchase_price_piece),
      parseFloat(selling_price_piece),
      parseInt(stock_qty_pieces, 10) || 0
    );

    res.status(201).json({ message: 'Batch created successfully', batch_id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create batch: ' + err.message });
  }
});

// PUT /api/inventory/batches/:id
// Update batch details
router.put('/batches/:id', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  const { batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces } = req.body;

  try {
    db.prepare(`
      UPDATE medicine_batches SET
        batch_number = ?, expiry_date = ?, purchase_price_piece = ?, selling_price_piece = ?, stock_qty_pieces = ?
      WHERE batch_id = ?
    `).run(batch_number, expiry_date, parseFloat(purchase_price_piece), parseFloat(selling_price_piece), parseInt(stock_qty_pieces, 10), batchId);

    res.json({ message: 'Batch updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update batch: ' + err.message });
  }
});

// POST /api/inventory/write-off
// Expiry, damage, and breakage write-offs (SRS 3.1 & 3.3)
router.post('/write-off', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { batch_id, quantity_pieces, reason, notes } = req.body;

  if (!batch_id || !quantity_pieces || !reason) {
    return res.status(400).json({ error: 'Required fields: batch_id, quantity_pieces, reason.' });
  }

  const pieces = parseInt(quantity_pieces, 10);
  if (pieces <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0.' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');

    const batch = db.prepare('SELECT * FROM medicine_batches WHERE batch_id = ?').get(batch_id);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (pieces > batch.stock_qty_pieces) {
      throw new Error(`Write-off quantity (${pieces}) exceeds available batch stock (${batch.stock_qty_pieces} pieces)`);
    }

    const lossAmount = +(pieces * batch.purchase_price_piece).toFixed(2);

    // Deduct stock from batch
    db.prepare('UPDATE medicine_batches SET stock_qty_pieces = stock_qty_pieces - ? WHERE batch_id = ?')
      .run(pieces, batch_id);

    // Record audit write-off
    const stmt = db.prepare(`
      INSERT INTO damage_write_offs (batch_id, user_id, quantity_pieces, reason, loss_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(batch_id, req.user.user_id, pieces, reason, lossAmount, notes || null);

    db.exec('COMMIT');

    res.status(201).json({
      message: 'Write-off recorded successfully',
      write_off_id: result.lastInsertRowid,
      loss_amount: lossAmount
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// GET /api/inventory/write-offs
// History of damage and expiry write-offs
router.get('/write-offs', authenticateToken, (req, res) => {
  const isPharmacist = req.user.role === 'PHARMACIST';
  try {
    const list = db.prepare(`
      SELECT w.*, b.batch_number, b.expiry_date, m.brand_name, m.dosage_form, m.strength, u.full_name as recorded_by
      FROM damage_write_offs w
      JOIN medicine_batches b ON w.batch_id = b.batch_id
      JOIN medicines m ON b.medicine_id = m.medicine_id
      JOIN users u ON w.user_id = u.user_id
      ORDER BY w.write_off_id DESC
    `).all();

    const formatted = list.map(item => ({
      ...item,
      loss_amount: isPharmacist ? null : item.loss_amount
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve write-offs: ' + err.message });
  }
});

module.exports = router;
