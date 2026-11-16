const express = require('express');
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers
router.get('/', authenticateToken, (req, res) => {
  const q = (req.query.q || '').trim();
  let customers;
  if (q) {
    customers = db.prepare(`
      SELECT * FROM customers 
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name ASC
    `).all(`%${q}%`, `%${q}%`);
  } else {
    customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
  }
  res.json(customers);
});

// POST /api/customers
router.post('/', authenticateToken, (req, res) => {
  const { name, phone, address, total_due } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }

  try {
    const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone.trim());
    if (existing) {
      return res.status(400).json({ error: 'Customer with this phone number already exists.' });
    }

    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, address, total_due)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(name.trim(), phone.trim(), address || '', parseFloat(total_due) || 0.00);

    res.status(201).json({
      message: 'Customer registered successfully',
      customer_id: result.lastInsertRowid,
      name,
      phone,
      total_due: parseFloat(total_due) || 0.00
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, phone, address } = req.body;

  try {
    db.prepare(`
      UPDATE customers SET name = ?, phone = ?, address = ? WHERE customer_id = ?
    `).run(name, phone, address || '', id);
    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/customers/:id/ledger (Invoices and Payments History)
router.get('/:id/ledger', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const invoices = db.prepare(`
    SELECT invoice_id, invoice_number, sale_date, grand_total, paid_amount, due_amount, payment_method
    FROM sales_invoices WHERE customer_id = ? ORDER BY invoice_id DESC
  `).all(id);

  const payments = db.prepare(`
    SELECT p.*, u.full_name as received_by
    FROM customer_payments p
    JOIN users u ON p.user_id = u.user_id
    WHERE p.customer_id = ?
    ORDER BY p.payment_id DESC
  `).all(id);

  res.json({
    customer,
    invoices,
    payments
  });
});

// POST /api/customers/:id/payment (Receive Customer Credit Payment)
router.post('/:id/payment', authenticateToken, (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  const { amount, payment_method, notes } = req.body;
  const payAmount = parseFloat(amount);

  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than 0.' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');

    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    db.prepare(`
      INSERT INTO customer_payments (customer_id, user_id, amount, payment_method, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerId, req.user.user_id, payAmount, payment_method || 'CASH', notes || null);

    db.prepare(`
      UPDATE customers SET total_due = MAX(0, total_due - ?) WHERE customer_id = ?
    `).run(payAmount, customerId);

    db.exec('COMMIT');

    const updatedCustomer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customerId);

    res.json({
      message: 'Payment received successfully',
      paid_amount: payAmount,
      remaining_due: updatedCustomer.total_due
    });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
