const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.resolve(__dirname, 'pharmacy.db');
const db = new DatabaseSync(dbPath);

// Enable Foreign Keys & WAL mode for high concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generics (
      generic_id INTEGER PRIMARY KEY AUTOINCREMENT,
      generic_name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS manufacturers (
      manufacturer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      contact_info TEXT
    );

    CREATE TABLE IF NOT EXISTS medicines (
      medicine_id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL,
      generic_id INTEGER NOT NULL REFERENCES generics(generic_id) ON DELETE RESTRICT,
      manufacturer_id INTEGER NOT NULL REFERENCES manufacturers(manufacturer_id) ON DELETE RESTRICT,
      dosage_form TEXT NOT NULL,
      strength TEXT NOT NULL,
      barcode TEXT UNIQUE,
      pieces_per_strip INTEGER NOT NULL DEFAULT 10,
      strips_per_box INTEGER NOT NULL DEFAULT 10,
      reorder_level INTEGER NOT NULL DEFAULT 50,
      is_rx_required INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicine_batches (
      batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(medicine_id) ON DELETE CASCADE,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      purchase_price_piece REAL NOT NULL,
      selling_price_piece REAL NOT NULL,
      stock_qty_pieces INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      total_due REAL DEFAULT 0.00,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      invoice_number TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      due_amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      purchase_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
      batch_id INTEGER NOT NULL REFERENCES medicine_batches(batch_id) ON DELETE RESTRICT,
      quantity_pieces INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      address TEXT,
      total_due REAL DEFAULT 0.00,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
      invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(customer_id),
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      sale_date TEXT DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0.00,
      vat_amount REAL DEFAULT 0.00,
      grand_total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      due_amount REAL DEFAULT 0.00,
      payment_method TEXT NOT NULL,
      payment_breakdown TEXT,
      prescription_url TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sales_items (
      sales_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES sales_invoices(invoice_id) ON DELETE CASCADE,
      batch_id INTEGER NOT NULL REFERENCES medicine_batches(batch_id),
      sold_unit_type TEXT NOT NULL CHECK(sold_unit_type IN ('PIECE', 'STRIP', 'BOX')),
      qty_sold_in_unit REAL NOT NULL,
      total_pieces_deducted INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_returns (
      return_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES sales_invoices(invoice_id),
      batch_id INTEGER NOT NULL REFERENCES medicine_batches(batch_id),
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      returned_pieces INTEGER NOT NULL,
      refund_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      return_date TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS damage_write_offs (
      write_off_id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES medicine_batches(batch_id),
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      quantity_pieces INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('EXPIRED', 'DAMAGED', 'BROKEN', 'LOST', 'OTHER')),
      loss_amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS held_bills (
      held_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_note TEXT,
      cart_data TEXT NOT NULL,
      customer_id INTEGER,
      discount_val REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'PERCENT',
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indices for fast lookups & sub-second response
    CREATE INDEX IF NOT EXISTS idx_batches_fefo ON medicine_batches(medicine_id, expiry_date, stock_qty_pieces);
    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
    CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_id);
    CREATE INDEX IF NOT EXISTS idx_medicines_brand ON medicines(brand_name);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON sales_invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON sales_invoices(sale_date);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);
}

initSchema();

module.exports = { db, initSchema };
