const bcrypt = require('bcryptjs');
const { db } = require('./database');

function seedDatabase() {
  console.log('Seeding Pharmacy Database...');

  // 1. Settings
  const settings = [
    ['pharmacy_name', 'MediCare Central Pharmacy & Healthcare'],
    ['pharmacy_tagline', 'Your Trusted Health & Wellness Partner'],
    ['address', 'House #42, Road #11, Banani, Dhaka-1213'],
    ['phone', '+880 1711-000000'],
    ['email', 'contact@medicare-central.com'],
    ['vat_percent', '5'],
    ['currency_symbol', '৳'],
    ['max_discount_pharmacist', '10'],
    ['max_discount_inventory_manager', '20'],
    ['max_discount_admin', '100'],
    ['default_receipt_type', '80mm'], // 80mm, 58mm, a4
    ['invoice_prefix', 'INV-'],
  ];

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of settings) {
    insertSetting.run(k, v);
  }

  // 2. Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const pharmHash = bcrypt.hashSync('pharm123', salt);
    const mgrHash = bcrypt.hashSync('mgr123', salt);

    const insertUser = db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('System Administrator', 'admin', adminHash, 'ADMIN', 1);
    insertUser.run('Tanvir Ahmed', 'pharmacist', pharmHash, 'PHARMACIST', 1);
    insertUser.run('Shirin Akter', 'manager', mgrHash, 'INVENTORY_MANAGER', 1);
    console.log('Production users ready: admin, pharmacist, manager');
  }

  // 3. Generics
  const genericCount = db.prepare('SELECT COUNT(*) as count FROM generics').get().count;
  if (genericCount === 0) {
    const genericsList = [
      ['Paracetamol', 'Analgesic and antipyretic medication used to treat fever and mild to moderate pain.'],
      ['Paracetamol + Caffeine', 'Combination analgesic formulation offering enhanced pain relief.'],
      ['Esomeprazole', 'Proton pump inhibitor (PPI) that reduces stomach acid production.'],
      ['Omeprazole', 'Proton pump inhibitor used to treat gastric and duodenal ulcers and GERD.'],
      ['Montelukast Sodium', 'Leukotriene receptor antagonist for the maintenance treatment of asthma and allergic rhinitis.'],
      ['Azithromycin', 'Macrolide antibiotic used for bacterial infections of the respiratory tract and skin.'],
      ['Cefixime', 'Third-generation cephalosporin antibiotic effective against a broad spectrum of bacteria.'],
      ['Metformin HCl', 'First-line biguanide medication for the treatment of type 2 diabetes.'],
      ['Amlodipine', 'Calcium channel blocker used to treat high blood pressure and coronary artery disease.'],
      ['Losartan Potassium', 'Angiotensin II receptor antagonist used mainly to treat high blood pressure.'],
      ['Fexofenadine HCl', 'Second-generation antihistamine used in the treatment of allergy symptoms.'],
      ['Rosuvastatin', 'Statin lipid-lowering medication used to prevent cardiovascular disease.'],
      ['Pantoprazole', 'Proton pump inhibitor for gastroesophageal reflux disease and acid peptic disorders.'],
      ['Ciprofloxacin', 'Fluoroquinolone antibiotic for urinary tract, gastrointestinal, and respiratory infections.'],
      ['Cetirizine HCl', 'Antihistamine medication used to treat hay fever, allergies, and angioedema.']
    ];

    const insertGeneric = db.prepare('INSERT INTO generics (generic_name, description) VALUES (?, ?)');
    for (const [name, desc] of genericsList) {
      insertGeneric.run(name, desc);
    }
  }

  // 4. Manufacturers
  const mfrCount = db.prepare('SELECT COUNT(*) as count FROM manufacturers').get().count;
  if (mfrCount === 0) {
    const manufacturersList = [
      ['Square Pharmaceuticals Ltd.', 'Square Centre, 48 Mohakhali C/A, Dhaka-1212. Phone: +880-2-8833047'],
      ['Beximco Pharmaceuticals Ltd.', '19 Dhanmondi R/A, Road #7, Dhaka-1205. Phone: +880-2-58611001'],
      ['Incepta Pharmaceuticals Ltd.', '40 Shahid Tajuddin Ahmed Sarani, Tejgaon I/A, Dhaka-1208.'],
      ['Renata Limited', 'Plot #1, Milk Vita Road, Section-7, Mirpur, Dhaka-1216.'],
      ['Opsonin Pharma Limited', 'Opsonin Building, 30 New Eskaton Road, Dhaka-1000.'],
      ['Eskayef Pharmaceuticals Ltd.', 'Gulshan Tower, Plot-31, Road-53, Gulshan North C/A, Dhaka.'],
      ['The ACME Laboratories Ltd.', 'Court de la ACME, 1/4 Kallayanpur, Mirpur Road, Dhaka-1207.']
    ];

    const insertMfr = db.prepare('INSERT INTO manufacturers (name, contact_info) VALUES (?, ?)');
    for (const [name, contact] of manufacturersList) {
      insertMfr.run(name, contact);
    }
  }

  // 5. Medicines
  const medCount = db.prepare('SELECT COUNT(*) as count FROM medicines').get().count;
  if (medCount === 0) {
    // Helper to get ID by name
    const getGenId = (name) => db.prepare('SELECT generic_id FROM generics WHERE generic_name = ?').get(name)?.generic_id;
    const getMfrId = (name) => db.prepare('SELECT manufacturer_id FROM manufacturers WHERE name = ?').get(name)?.manufacturer_id;

    const medicinesList = [
      // Paracetamol & Combinations
      {
        brand: 'Napa 500mg',
        generic: 'Paracetamol',
        mfr: 'Beximco Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234001',
        pieces_per_strip: 10,
        strips_per_box: 50,
        reorder_level: 100,
        is_rx: 0
      },
      {
        brand: 'Napa Extra',
        generic: 'Paracetamol + Caffeine',
        mfr: 'Beximco Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg + 65mg',
        barcode: '8901234002',
        pieces_per_strip: 10,
        strips_per_box: 20,
        reorder_level: 80,
        is_rx: 0
      },
      {
        brand: 'Ace Plus',
        generic: 'Paracetamol + Caffeine',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg + 65mg',
        barcode: '8901234003',
        pieces_per_strip: 10,
        strips_per_box: 20,
        reorder_level: 80,
        is_rx: 0
      },
      {
        brand: 'Fast 500mg',
        generic: 'Paracetamol',
        mfr: 'The ACME Laboratories Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234004',
        pieces_per_strip: 10,
        strips_per_box: 50,
        reorder_level: 50,
        is_rx: 0
      },
      // PPI / Gastric Medicines
      {
        brand: 'Seclo 20mg',
        generic: 'Omeprazole',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Capsule',
        strength: '20mg',
        barcode: '8901234005',
        pieces_per_strip: 10,
        strips_per_box: 10,
        reorder_level: 60,
        is_rx: 0
      },
      {
        brand: 'Maxpro 20mg',
        generic: 'Esomeprazole',
        mfr: 'Renata Limited',
        form: 'Tablet',
        strength: '20mg',
        barcode: '8901234006',
        pieces_per_strip: 14,
        strips_per_box: 8,
        reorder_level: 60,
        is_rx: 0
      },
      {
        brand: 'Sergel 20mg',
        generic: 'Esomeprazole',
        mfr: 'Incepta Pharmaceuticals Ltd.',
        form: 'Capsule',
        strength: '20mg',
        barcode: '8901234007',
        pieces_per_strip: 10,
        strips_per_box: 10,
        reorder_level: 60,
        is_rx: 0
      },
      {
        brand: 'Pantodac 20mg',
        generic: 'Pantoprazole',
        mfr: 'Beximco Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '20mg',
        barcode: '8901234008',
        pieces_per_strip: 10,
        strips_per_box: 10,
        reorder_level: 50,
        is_rx: 0
      },
      // Respiratory & Allergy
      {
        brand: 'Monas 10mg',
        generic: 'Montelukast Sodium',
        mfr: 'The ACME Laboratories Ltd.',
        form: 'Tablet',
        strength: '10mg',
        barcode: '8901234009',
        pieces_per_strip: 10,
        strips_per_box: 3,
        reorder_level: 30,
        is_rx: 1
      },
      {
        brand: 'Montene 10mg',
        generic: 'Montelukast Sodium',
        mfr: 'Incepta Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '10mg',
        barcode: '8901234010',
        pieces_per_strip: 10,
        strips_per_box: 3,
        reorder_level: 30,
        is_rx: 1
      },
      {
        brand: 'Alatrol 10mg',
        generic: 'Cetirizine HCl',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '10mg',
        barcode: '8901234011',
        pieces_per_strip: 10,
        strips_per_box: 10,
        reorder_level: 50,
        is_rx: 0
      },
      {
        brand: 'Fexo 120mg',
        generic: 'Fexofenadine HCl',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '120mg',
        barcode: '8901234012',
        pieces_per_strip: 10,
        strips_per_box: 5,
        reorder_level: 40,
        is_rx: 0
      },
      // Antibiotics (Rx Required)
      {
        brand: 'Zimax 500mg',
        generic: 'Azithromycin',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234013',
        pieces_per_strip: 6,
        strips_per_box: 3,
        reorder_level: 20,
        is_rx: 1
      },
      {
        brand: 'Azithrocin 500mg',
        generic: 'Azithromycin',
        mfr: 'Beximco Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234014',
        pieces_per_strip: 6,
        strips_per_box: 3,
        reorder_level: 20,
        is_rx: 1
      },
      {
        brand: 'Cef-3 200mg',
        generic: 'Cefixime',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Capsule',
        strength: '200mg',
        barcode: '8901234015',
        pieces_per_strip: 8,
        strips_per_box: 2,
        reorder_level: 16,
        is_rx: 1
      },
      {
        brand: 'Ciprocin 500mg',
        generic: 'Ciprofloxacin',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234016',
        pieces_per_strip: 10,
        strips_per_box: 3,
        reorder_level: 20,
        is_rx: 1
      },
      // Chronic Diseases (Diabetes, Hypertension, Cholesterol)
      {
        brand: 'Comet 500mg',
        generic: 'Metformin HCl',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '500mg',
        barcode: '8901234017',
        pieces_per_strip: 10,
        strips_per_box: 10,
        reorder_level: 50,
        is_rx: 1
      },
      {
        brand: 'Camlodin 5mg',
        generic: 'Amlodipine',
        mfr: 'Square Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '5mg',
        barcode: '8901234018',
        pieces_per_strip: 10,
        strips_per_box: 5,
        reorder_level: 40,
        is_rx: 1
      },
      {
        brand: 'Osartil 50mg',
        generic: 'Losartan Potassium',
        mfr: 'Incepta Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '50mg',
        barcode: '8901234019',
        pieces_per_strip: 10,
        strips_per_box: 3,
        reorder_level: 30,
        is_rx: 1
      },
      {
        brand: 'Rovista 10mg',
        generic: 'Rosuvastatin',
        mfr: 'Beximco Pharmaceuticals Ltd.',
        form: 'Tablet',
        strength: '10mg',
        barcode: '8901234020',
        pieces_per_strip: 10,
        strips_per_box: 3,
        reorder_level: 30,
        is_rx: 1
      }
    ];

    const insertMed = db.prepare(`
      INSERT INTO medicines (brand_name, generic_id, manufacturer_id, dosage_form, strength, barcode, pieces_per_strip, strips_per_box, reorder_level, is_rx_required)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of medicinesList) {
      const gId = getGenId(m.generic);
      const mId = getMfrId(m.mfr);
      insertMed.run(m.brand, gId, mId, m.form, m.strength, m.barcode, m.pieces_per_strip, m.strips_per_box, m.reorder_level, m.is_rx);
    }
  }

  // 6. Medicine Batches (Carefully crafted with FEFO dates, near-expiry, and expired batches for testing FEFO and validation guard)
  const batchCount = db.prepare('SELECT COUNT(*) as count FROM medicine_batches').get().count;
  if (batchCount === 0) {
    const getMedId = (brand) => db.prepare('SELECT medicine_id FROM medicines WHERE brand_name = ?').get(brand)?.medicine_id;

    // Dates relative to current date (2026-11-16)
    // Past (expired): 2026-09-15
    // Near expiry (15 days): 2026-12-01
    // Near expiry (45 days): 2026-12-31
    // Near expiry (75 days): 2027-01-30
    // Long term safe: 2027-10-15, 2028-05-20
    const batches = [
      // Napa Extra (Two batches to demonstrate FEFO: earlier expiry batch must be picked first!)
      { brand: 'Napa Extra', batch: 'NX-2026A', expiry: '2027-04-10', cost: 2.10, sell: 3.00, stock: 120 },
      { brand: 'Napa Extra', batch: 'NX-2026B', expiry: '2028-01-15', cost: 2.20, sell: 3.00, stock: 350 },
      // Expired batch for Napa Extra (Stock guard must BLOCK this from POS sale!)
      { brand: 'Napa Extra', batch: 'NX-EXP-OLD', expiry: '2026-08-10', cost: 1.90, sell: 3.00, stock: 25 },

      // Ace Plus (Alternative substitute for Napa Extra)
      { brand: 'Ace Plus', batch: 'AP-2501', expiry: '2027-08-20', cost: 2.05, sell: 3.00, stock: 200 },

      // Napa 500mg
      { brand: 'Napa 500mg', batch: 'NP-501', expiry: '2027-12-30', cost: 0.85, sell: 1.20, stock: 500 },
      // Expiring in 20 days (Warning alert!)
      { brand: 'Napa 500mg', batch: 'NP-EXP-SOON', expiry: '2026-12-05', cost: 0.80, sell: 1.20, stock: 40 },

      // Fast 500mg (Alternative to Napa 500mg)
      { brand: 'Fast 500mg', batch: 'FS-101', expiry: '2027-06-15', cost: 0.80, sell: 1.20, stock: 150 },

      // Seclo 20mg
      { brand: 'Seclo 20mg', batch: 'SC-881', expiry: '2027-09-01', cost: 4.20, sell: 6.00, stock: 180 },

      // Maxpro 20mg
      { brand: 'Maxpro 20mg', batch: 'MX-701', expiry: '2027-11-20', cost: 5.60, sell: 8.00, stock: 112 },
      { brand: 'Maxpro 20mg', batch: 'MX-702', expiry: '2028-03-10', cost: 5.80, sell: 8.00, stock: 224 },

      // Sergel 20mg (Substitute to Maxpro 20mg)
      { brand: 'Sergel 20mg', batch: 'SG-901', expiry: '2027-05-18', cost: 5.50, sell: 8.00, stock: 150 },

      // Pantodac 20mg
      { brand: 'Pantodac 20mg', batch: 'PT-402', expiry: '2027-10-05', cost: 4.80, sell: 7.00, stock: 100 },

      // Monas 10mg (Rx required) - Warning alert expiring in 50 days (under 60 days)
      { brand: 'Monas 10mg', batch: 'MN-101', expiry: '2027-01-05', cost: 11.50, sell: 16.00, stock: 60 },
      { brand: 'Monas 10mg', batch: 'MN-102', expiry: '2027-11-30', cost: 11.80, sell: 16.00, stock: 120 },

      // Montene 10mg (Substitute to Monas 10mg)
      { brand: 'Montene 10mg', batch: 'MT-550', expiry: '2027-07-22', cost: 11.20, sell: 16.00, stock: 90 },

      // Alatrol 10mg
      { brand: 'Alatrol 10mg', batch: 'AL-301', expiry: '2027-12-12', cost: 2.20, sell: 3.50, stock: 160 },

      // Fexo 120mg
      { brand: 'Fexo 120mg', batch: 'FX-120', expiry: '2027-10-10', cost: 6.50, sell: 9.00, stock: 80 },

      // Zimax 500mg (Rx required) - Expiring in 80 days (under 90 days alert)
      { brand: 'Zimax 500mg', batch: 'ZX-501', expiry: '2027-02-05', cost: 26.00, sell: 35.00, stock: 36 },

      // Azithrocin 500mg (Substitute to Zimax 500mg)
      { brand: 'Azithrocin 500mg', batch: 'AZ-991', expiry: '2027-09-15', cost: 25.50, sell: 35.00, stock: 42 },

      // Cef-3 200mg (Rx required, Low stock alert! only 12 pieces vs reorder_level 16)
      { brand: 'Cef-3 200mg', batch: 'CF-200', expiry: '2027-08-30', cost: 38.00, sell: 50.00, stock: 12 },

      // Ciprocin 500mg
      { brand: 'Ciprocin 500mg', batch: 'CP-501', expiry: '2027-11-01', cost: 11.00, sell: 15.00, stock: 60 },

      // Comet 500mg (Low stock alert! 20 pieces vs reorder_level 50)
      { brand: 'Comet 500mg', batch: 'CM-501', expiry: '2027-12-01', cost: 2.80, sell: 4.00, stock: 20 },

      // Camlodin 5mg
      { brand: 'Camlodin 5mg', batch: 'CD-501', expiry: '2027-06-30', cost: 3.50, sell: 5.00, stock: 80 },

      // Osartil 50mg
      { brand: 'Osartil 50mg', batch: 'OS-501', expiry: '2027-09-25', cost: 5.60, sell: 8.00, stock: 70 },

      // Rovista 10mg
      { brand: 'Rovista 10mg', batch: 'RV-101', expiry: '2027-12-15', cost: 13.50, sell: 18.00, stock: 60 }
    ];

    const insertBatch = db.prepare(`
      INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, purchase_price_piece, selling_price_piece, stock_qty_pieces)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const b of batches) {
      const mId = getMedId(b.brand);
      if (mId) {
        insertBatch.run(mId, b.batch, b.expiry, b.cost, b.sell, b.stock);
      }
    }
  }

  // 7. Suppliers
  const suppCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
  if (suppCount === 0) {
    const suppliersList = [
      ['Square Pharma Distribution Hub', 'Mahbub Alam', '+880 1711-223344', 15400.00],
      ['Beximco Logistics & Wholesale', 'Shahidul Karim', '+880 1819-334455', 8200.00],
      ['Incepta Agency Direct', 'Kamal Uddin', '+880 1912-445566', 0.00],
      ['Renata Healthcare Distribution', 'Fahim Reza', '+880 1610-556677', 4500.00],
      ['Universal Medicine Traders Ltd.', 'Anisur Rahman', '+880 1722-667788', 12350.00]
    ];

    const insertSupp = db.prepare(`
      INSERT INTO suppliers (company_name, contact_person, phone, total_due)
      VALUES (?, ?, ?, ?)
    `);

    for (const s of suppliersList) {
      insertSupp.run(s[0], s[1], s[2], s[3]);
    }
  }

  // 8. Customers
  const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (custCount === 0) {
    const customersList = [
      ['Kazi Muntasir Billah', '01712345678', 'House 14, Road 5, Block C, Banani, Dhaka', 450.00],
      ['Farhana Yasmin', '01898765432', 'Flat 4B, Green View Appt, Gulshan-2, Dhaka', 0.00],
      ['Mahfuzul Haque', '01911223344', 'Plot 22, Sector 4, Uttara, Dhaka', 1250.00],
      ['Nusrat Jahan', '01677889900', 'House 5, Road 8, Dhanmondi, Dhaka', 0.00],
      ['Tareq Monowar', '01755667788', '35/A Siddeshwari Circular Road, Dhaka', 85.00]
    ];

    const insertCust = db.prepare(`
      INSERT INTO customers (name, phone, address, total_due)
      VALUES (?, ?, ?, ?)
    `);

    for (const c of customersList) {
      insertCust.run(c[0], c[1], c[2], 0.0);
    }
  }

  console.log('Database master data verified and clean!');
}

seedDatabase();

module.exports = { seedDatabase };
