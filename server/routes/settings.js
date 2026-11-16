const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// POST /api/settings (Admin only)
router.post('/', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  try {
    db.exec('BEGIN IMMEDIATE');
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(updates)) {
      stmt.run(k, String(v));
    }
    db.exec('COMMIT');
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

module.exports = router;
