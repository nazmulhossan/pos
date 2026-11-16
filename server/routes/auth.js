const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Your account is deactivated. Contact an administrator.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = generateToken(user);

  // Fetch settings relevant to the frontend session
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  // Determine max discount allowed for this role
  let maxDiscount = 10;
  if (user.role === 'ADMIN') {
    maxDiscount = parseFloat(settings.max_discount_admin || '100');
  } else if (user.role === 'INVENTORY_MANAGER') {
    maxDiscount = parseFloat(settings.max_discount_inventory_manager || '20');
  } else {
    maxDiscount = parseFloat(settings.max_discount_pharmacist || '10');
  }

  res.json({
    message: 'Login successful',
    token,
    user: {
      user_id: user.user_id,
      full_name: user.full_name,
      username: user.username,
      role: user.role
    },
    settings: {
      pharmacy_name: settings.pharmacy_name,
      pharmacy_tagline: settings.pharmacy_tagline,
      address: settings.address,
      phone: settings.phone,
      vat_percent: parseFloat(settings.vat_percent || '5'),
      currency_symbol: settings.currency_symbol || '৳',
      max_discount: maxDiscount,
      default_receipt_type: settings.default_receipt_type || '80mm'
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT user_id, full_name, username, role, is_active FROM users WHERE user_id = ?').get(req.user.user_id);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User no longer active or found.' });
  }

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  let maxDiscount = 10;
  if (user.role === 'ADMIN') {
    maxDiscount = parseFloat(settings.max_discount_admin || '100');
  } else if (user.role === 'INVENTORY_MANAGER') {
    maxDiscount = parseFloat(settings.max_discount_inventory_manager || '20');
  } else {
    maxDiscount = parseFloat(settings.max_discount_pharmacist || '10');
  }

  res.json({
    user,
    settings: {
      pharmacy_name: settings.pharmacy_name,
      pharmacy_tagline: settings.pharmacy_tagline,
      address: settings.address,
      phone: settings.phone,
      vat_percent: parseFloat(settings.vat_percent || '5'),
      currency_symbol: settings.currency_symbol || '৳',
      max_discount: maxDiscount,
      default_receipt_type: settings.default_receipt_type || '80mm'
    }
  });
});

module.exports = router;
