const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');

// Initialize database schema and seeds
require('./db/database');
require('./db/seed');

const authRoutes = require('./routes/auth');
const medicinesRoutes = require('./routes/medicines');
const posRoutes = require('./routes/pos');
const inventoryRoutes = require('./routes/inventory');
const purchasesRoutes = require('./routes/purchases');
const customersRoutes = require('./routes/customers');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;

// Upload directory for prescriptions
const uploadDir = path.resolve(__dirname, '../uploads/prescriptions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'rx-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded prescription files
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Prescription Upload Route
app.post('/api/upload/prescription', authenticateToken, upload.single('prescription'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No prescription file provided.' });
  }
  const fileUrl = `/uploads/prescriptions/${req.file.filename}`;
  res.json({
    message: 'Prescription uploaded successfully',
    url: fileUrl,
    filename: req.file.filename
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Pharmacy Billing & Inventory Management API'
  });
});

// Serve frontend build if dist exists (Production mode)
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pharmacy POS Backend Server running on port ${PORT}`);
});

module.exports = { app, server };
