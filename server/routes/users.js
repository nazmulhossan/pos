const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users (Admin only)
router.get('/', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const users = db.prepare('SELECT user_id, full_name, username, role, is_active, created_at FROM users ORDER BY user_id ASC').all();
  res.json(users);
});

// POST /api/users (Admin only)
router.post('/', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const { full_name, username, password, role } = req.body;
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: 'All fields are required: full_name, username, password, role.' });
  }

  if (!['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be ADMIN, PHARMACIST, or INVENTORY_MANAGER.' });
  }

  try {
    const existing = db.prepare('SELECT user_id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    const result = stmt.run(full_name.trim(), username.trim(), password_hash, role);

    res.status(201).json({ message: 'User created successfully', user_id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:id (Admin only)
router.put('/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { full_name, role, is_active, new_password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let password_hash = user.password_hash;
    if (new_password && new_password.trim().length >= 4) {
      const salt = bcrypt.genSaltSync(10);
      password_hash = bcrypt.hashSync(new_password.trim(), salt);
    }

    db.prepare(`
      UPDATE users SET
        full_name = ?,
        role = ?,
        is_active = ?,
        password_hash = ?
      WHERE user_id = ?
    `).run(
      full_name || user.full_name,
      role || user.role,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
      password_hash,
      id
    );

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
