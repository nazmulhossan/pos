const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-super-secure-secret-key-2026';

function generateToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = decoded;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole
};
