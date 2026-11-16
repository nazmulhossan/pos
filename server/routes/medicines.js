const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/medicines/search
// Fast sub-second search by barcode, brand_name, or generic_name
router.get('/search', authenticateToken, (req, res) => {
  const q = (req.query.q || '').trim();
  const barcode = (req.query.barcode || '').trim();

  try {
    let medicines = [];

    if (barcode) {
      medicines = db.prepare(`
        SELECT m.*, g.generic_name, mf.name as manufacturer_name
        FROM medicines m
        JOIN generics g ON m.generic_id = g.generic_id
        JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
        WHERE m.barcode = ?
      `).all(barcode);
    } else if (q) {
      const searchTerm = `%${q}%`;
      medicines = db.prepare(`
        SELECT m.*, g.generic_name, mf.name as manufacturer_name
        FROM medicines m
        JOIN generics g ON m.generic_id = g.generic_id
        JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
        WHERE m.brand_name LIKE ? OR g.generic_name LIKE ? OR m.barcode LIKE ?
        ORDER BY 
          CASE WHEN m.brand_name LIKE ? THEN 1
               WHEN g.generic_name LIKE ? THEN 2
               ELSE 3 END,
          m.brand_name ASC
        LIMIT 50
      `).all(searchTerm, searchTerm, searchTerm, `${q}%`, `${q}%`);
    } else {
      medicines = db.prepare(`
        SELECT m.*, g.generic_name, mf.name as manufacturer_name
        FROM medicines m
        JOIN generics g ON m.generic_id = g.generic_id
        JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
        ORDER BY m.brand_name ASC
        LIMIT 50
      `).all();
    }

    const today = new Date().toISOString().split('T')[0];

    // Hydrate each medicine with active FEFO batches and stock
    const results = medicines.map(med => {
      // FEFO batches: valid non-expired, stock > 0, earliest expiry first
      const activeBatches = db.prepare(`
        SELECT batch_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces
        FROM medicine_batches
        WHERE medicine_id = ? AND stock_qty_pieces > 0 AND expiry_date >= ?
        ORDER BY expiry_date ASC
      `).all(med.medicine_id, today);

      // Expired batches (for warning / guard visibility)
      const expiredBatches = db.prepare(`
        SELECT batch_id, batch_number, expiry_date, stock_qty_pieces
        FROM medicine_batches
        WHERE medicine_id = ? AND stock_qty_pieces > 0 AND expiry_date < ?
        ORDER BY expiry_date ASC
      `).all(med.medicine_id, today);

      const totalActivePieces = activeBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);
      const totalExpiredPieces = expiredBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);

      // Default selling price per piece from the active FEFO batch, or latest batch
      let currentSellingPricePiece = 0;
      let currentPurchasePricePiece = 0;

      if (activeBatches.length > 0) {
        currentSellingPricePiece = activeBatches[0].selling_price_piece;
        currentPurchasePricePiece = activeBatches[0].purchase_price_piece;
      } else {
        const latestBatch = db.prepare(`
          SELECT selling_price_piece, purchase_price_piece FROM medicine_batches
          WHERE medicine_id = ? ORDER BY batch_id DESC LIMIT 1
        `).get(med.medicine_id);
        if (latestBatch) {
          currentSellingPricePiece = latestBatch.selling_price_piece;
          currentPurchasePricePiece = latestBatch.purchase_price_piece;
        }
      }

      // Unit prices
      const piecePrice = currentSellingPricePiece;
      const stripPrice = +(piecePrice * med.pieces_per_strip).toFixed(2);
      const boxPrice = +(stripPrice * med.strips_per_box).toFixed(2);

      // Mask purchase price if user is Pharmacist
      const isPharmacist = req.user.role === 'PHARMACIST';

      const sanitizedBatches = activeBatches.map(b => ({
        batch_id: b.batch_id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        selling_price_piece: b.selling_price_piece,
        purchase_price_piece: isPharmacist ? null : b.purchase_price_piece,
        stock_qty_pieces: b.stock_qty_pieces
      }));

      return {
        ...med,
        available_pieces: totalActivePieces,
        expired_pieces: totalExpiredPieces,
        is_low_stock: totalActivePieces <= med.reorder_level,
        prices: {
          PIECE: piecePrice,
          STRIP: stripPrice,
          BOX: boxPrice
        },
        fe_fo_batch: sanitizedBatches[0] || null,
        active_batches: sanitizedBatches,
        has_expired_stock: expiredBatches.length > 0
      };
    });

    res.json(results);
  } catch (err) {
    console.error('Error searching medicines:', err);
    res.status(500).json({ error: 'Failed to search medicines: ' + err.message });
  }
});

// GET /api/medicines/:id/substitutes
// Shortcut F2: Lists available in-stock alternatives with exact same generic_id and strength
router.get('/:id/substitutes', authenticateToken, (req, res) => {
  const medicineId = parseInt(req.params.id, 10);
  const target = db.prepare('SELECT medicine_id, generic_id, strength, brand_name FROM medicines WHERE medicine_id = ?').get(medicineId);
  if (!target) {
    return res.status(404).json({ error: 'Target medicine not found' });
  }

  const today = new Date().toISOString().split('T')[0];

  const substitutes = db.prepare(`
    SELECT m.*, g.generic_name, mf.name as manufacturer_name
    FROM medicines m
    JOIN generics g ON m.generic_id = g.generic_id
    JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
    WHERE m.generic_id = ? AND m.strength = ? AND m.medicine_id != ?
    ORDER BY m.brand_name ASC
  `).all(target.generic_id, target.strength, medicineId);

  const results = substitutes.map(med => {
    const activeBatches = db.prepare(`
      SELECT batch_id, batch_number, expiry_date, selling_price_piece, stock_qty_pieces
      FROM medicine_batches
      WHERE medicine_id = ? AND stock_qty_pieces > 0 AND expiry_date >= ?
      ORDER BY expiry_date ASC
    `).all(med.medicine_id, today);

    const totalActivePieces = activeBatches.reduce((acc, b) => acc + b.stock_qty_pieces, 0);
    const piecePrice = activeBatches.length > 0 ? activeBatches[0].selling_price_piece : 0;
    const stripPrice = +(piecePrice * med.pieces_per_strip).toFixed(2);
    const boxPrice = +(stripPrice * med.strips_per_box).toFixed(2);

    return {
      ...med,
      available_pieces: totalActivePieces,
      prices: {
        PIECE: piecePrice,
        STRIP: stripPrice,
        BOX: boxPrice
      },
      fe_fo_batch: activeBatches[0] || null,
      active_batches: activeBatches
    };
  }).filter(m => m.available_pieces > 0); // Only in-stock alternatives as per SRS 2.2

  res.json({
    original_medicine: target.brand_name,
    strength: target.strength,
    count: results.length,
    substitutes: results
  });
});

// GET /api/medicines (full catalog)
router.get('/', authenticateToken, (req, res) => {
  const medicines = db.prepare(`
    SELECT m.*, g.generic_name, mf.name as manufacturer_name,
      COALESCE((
        SELECT SUM(stock_qty_pieces) 
        FROM medicine_batches b 
        WHERE b.medicine_id = m.medicine_id AND b.expiry_date >= date('now')
      ), 0) as total_stock_pieces,
      COALESCE((
        SELECT SUM(stock_qty_pieces) 
        FROM medicine_batches b 
        WHERE b.medicine_id = m.medicine_id AND b.expiry_date < date('now')
      ), 0) as expired_stock_pieces
    FROM medicines m
    JOIN generics g ON m.generic_id = g.generic_id
    JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
    ORDER BY m.brand_name ASC
  `).all();

  res.json(medicines);
});

// POST /api/medicines
router.post('/', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const {
    brand_name, generic_id, manufacturer_id, dosage_form,
    strength, barcode, pieces_per_strip, strips_per_box,
    reorder_level, is_rx_required
  } = req.body;

  if (!brand_name || !generic_id || !manufacturer_id || !dosage_form || !strength) {
    return res.status(400).json({ error: 'Required fields: brand_name, generic_id, manufacturer_id, dosage_form, strength.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO medicines (brand_name, generic_id, manufacturer_id, dosage_form, strength, barcode, pieces_per_strip, strips_per_box, reorder_level, is_rx_required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      brand_name,
      generic_id,
      manufacturer_id,
      dosage_form,
      strength,
      barcode || null,
      pieces_per_strip || 10,
      strips_per_box || 10,
      reorder_level || 50,
      is_rx_required ? 1 : 0
    );

    res.status(201).json({ message: 'Medicine added successfully', medicine_id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add medicine: ' + err.message });
  }
});

// PUT /api/medicines/:id
router.put('/:id', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const {
    brand_name, generic_id, manufacturer_id, dosage_form,
    strength, barcode, pieces_per_strip, strips_per_box,
    reorder_level, is_rx_required
  } = req.body;

  try {
    db.prepare(`
      UPDATE medicines SET
        brand_name = ?, generic_id = ?, manufacturer_id = ?, dosage_form = ?,
        strength = ?, barcode = ?, pieces_per_strip = ?, strips_per_box = ?,
        reorder_level = ?, is_rx_required = ?
      WHERE medicine_id = ?
    `).run(
      brand_name, generic_id, manufacturer_id, dosage_form,
      strength, barcode || null, pieces_per_strip, strips_per_box,
      reorder_level, is_rx_required ? 1 : 0, id
    );

    res.json({ message: 'Medicine updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update medicine: ' + err.message });
  }
});

// DELETE /api/medicines/:id (Admin only)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const hasSales = db.prepare('SELECT COUNT(*) as count FROM sales_items si JOIN medicine_batches b ON si.batch_id = b.batch_id WHERE b.medicine_id = ?').get(id).count;
    if (hasSales > 0) {
      return res.status(400).json({ error: 'Cannot delete medicine with recorded sales history.' });
    }

    db.prepare('DELETE FROM medicines WHERE medicine_id = ?').run(id);
    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete medicine: ' + err.message });
  }
});

// Generics
router.get('/meta/generics', authenticateToken, (req, res) => {
  const list = db.prepare('SELECT * FROM generics ORDER BY generic_name ASC').all();
  res.json(list);
});

router.post('/meta/generics', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { generic_name, description } = req.body;
  if (!generic_name) return res.status(400).json({ error: 'Generic name is required' });
  try {
    const stmt = db.prepare('INSERT INTO generics (generic_name, description) VALUES (?, ?)');
    const result = stmt.run(generic_name, description || null);
    res.status(201).json({ generic_id: result.lastInsertRowid, generic_name, description });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manufacturers
router.get('/meta/manufacturers', authenticateToken, (req, res) => {
  const list = db.prepare('SELECT * FROM manufacturers ORDER BY name ASC').all();
  res.json(list);
});

router.post('/meta/manufacturers', authenticateToken, requireRole('ADMIN', 'INVENTORY_MANAGER'), (req, res) => {
  const { name, contact_info } = req.body;
  if (!name) return res.status(400).json({ error: 'Manufacturer name is required' });
  try {
    const stmt = db.prepare('INSERT INTO manufacturers (name, contact_info) VALUES (?, ?)');
    const result = stmt.run(name, contact_info || null);
    res.status(201).json({ manufacturer_id: result.lastInsertRowid, name, contact_info });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
