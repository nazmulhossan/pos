# MediCare POS — Pharmacy Billing & Inventory Management System

A high-speed, keyboard-driven retail Pharmacy Point of Sale (POS) and Inventory Management System designed and built strictly according to the **Software Requirements Specification (SRS) & Architecture** document.

---

## 🚀 Features & Architecture

### 1. High-Speed POS Billing Module
- **Sub-Second Item Lookup & Scanning**: Instant search by medicine brand name (e.g. *Napa Extra*, *Maxpro*), generic composition (*Paracetamol + Caffeine*, *Esomeprazole*), or exact barcode scanning.
- **Automatic Batch Assignment (FEFO)**: Automatically assigns the active batch with the earliest expiration date (*First-Expire, First-Out*). Expired batches are strictly blocked from sale.
- **Multi-Unit Pricing & Conversion**: Real-time conversion between **Piece** (tablet/capsule), **Strip**, and **Box**, calculating exact base pieces to deduct from inventory with zero fractional rounding errors.
- **Generic Substitute Lookup (`F2`)**: Instantly lists available in-stock bio-equivalent brand alternatives sharing the exact same generic composition and strength with 1-click addition to cart.
- **Customer Profile & Due Sales**: Optional walk-in or registered customer profile. Required for credit/due sales with running customer ledger balance tracking.
- **Prescription Attachment**: Scanned doctor prescription upload/attachment for scheduled and antibiotic drugs (`is_rx_required = 1`).
- **Discount Threshold Enforcement (`F8`)**: Item-level or invoice-level discount with strict role-based threshold limits (e.g., Pharmacist max 10%, Admin 100%).
- **Multi-Mode Payment**: Cash (with auto change return calculation), Card, Mobile Financial Services (**bKash**, **Nagad**, **Rocket**), Split payments, and Customer Due accounts.
- **Stock Over-Sell Guard**: Automatically prevents billing quantity exceeding available pieces across active non-expired batches.
- **Thermal POS Receipt Printing**: Switchable print layouts for **Thermal 80mm**, **Thermal 58mm**, and standard **A4 invoices** with barcode.

### 2. POS Screen Keyboard Shortcuts
| POS Feature | Shortcut | System Behavior & Validation Rule |
| :--- | :--- | :--- |
| **Instant Search Focus** | `F1` / `Ctrl+F` | Focuses the search/barcode input immediately from anywhere on screen. |
| **Unit Toggle** | `Tab` / `Alt+U` | Cycles selected cart row between Piece, Strip, and Box; recalculates subtotal and pieces to deduct. |
| **Substitute Finder** | `F2` | Opens modal listing alternative in-stock brands with matching `generic_id` and strength. |
| **Hold / Recall Bill** | `F4` / `F5` | Suspends active cart while customer checks another item; restores it later. |
| **Apply Discount** | `F8` | Focuses discount field; enforces maximum discount percentage for logged-in role. |
| **Complete & Print** | `F10` / `Ctrl+P` | Opens checkout dialog, commits atomic database transaction, and prints receipt. |
| **Stock Over-Sell Guard** | *Automatic* | Prevents billing quantity exceeding available pieces across active non-expired batches. |

### 3. Sales Returns & Refund Workflow
- Lookup past invoices by unique `invoice_number` (e.g., `INV-2026-0001`) or customer mobile number.
- Itemized selection of returned quantities in pieces or strips.
- Automatic proportional refund calculation factoring in original invoice discounts.
- Restocks returned pieces back to the original `batch_id` in `medicine_batches`.
- Audit log entry recorded in `sales_returns` with timestamp, cashier, and reason.

### 4. Inventory & Batch Management (FEFO)
- **Base-Unit Inventory Storage**: All inventory quantities are stored in the smallest dispensable unit (`pieces`).
- **Automated Expiry Alerts**:
  - 🛑 **Expired**: Past expiration date (strictly blocked from POS billing).
  - 🟠 **≤ 30 Days**: Early clearance warning.
  - 🟡 **≤ 60 Days**: Notice alert.
  - 🔵 **≤ 90 Days**: Quarterly alert.
- **Low-Stock Reorder Alerts**: Identifies medicines where total stock pieces $\le$ `reorder_level`.
- **Damage & Expiry Write-Offs**: Decommissions expired or damaged stock, logs financial loss (`quantity * purchase_price`), and deducts from batches.

### 5. Supplier Procurement & Payables
- Distributor profiles with running payable credit balances (`total_due`).
- Inward purchase invoice entry: receives stock into batches with purchase cost, selling price, and expiration date.
- Supplier payment vouchers to settle wholesale accounts.

### 6. Role-Based Access Control (RBAC)
- **Admin (Owner)**: Full access, P&L financial reports, user management, tax and discount threshold controls.
- **Pharmacist / Cashier**: POS billing, customer registration, prescription uploads, invoice returns. Restricted from viewing purchase costs, profit margins, or deleting stock.
- **Inventory Manager**: Medicine catalog management, supplier purchases, batch adjustments, and expiry/damage write-offs. Restricted from financial profit/loss and user administration.

### 7. Financial Reports & Analytics
- **Sales & Collections Breakdown**: Daily, weekly, monthly sales filtered by payment method (Cash, Card, MFS, Due).
- **Profit & Loss Statement (Admin only)**: Accurately derives gross profit from batch-specific purchase cost vs billed selling price, less discounts, sales returns, and write-off losses.
- **Fast-Moving Rankings**: Top-selling medicines ranked by base pieces sold and revenue generated.

---

## 🔑 Default User Accounts

| Role | Username | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Admin / Owner** | `admin` | `admin123` | Full system access, P&L statements, tax/discount settings, user management |
| **Pharmacist / Cashier** | `pharmacist` | `pharm123` | High-speed POS, returns, prescription attachment (Purchase costs hidden) |
| **Inventory Manager** | `manager` | `mgr123` | Catalog, supplier procurement, batch management, write-offs |

> *Tip: You can switch demo roles instantly using the top right user menu in the header bar.*

---

## 🛠️ Tech Stack & Database Schema

- **Backend**: Node.js v25, Express 5, `node:sqlite` (Synchronous SQLite in WAL mode with atomic transactions and foreign keys).
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide icons.
- **Database Tables**:
  - `users`
  - `generics`
  - `manufacturers`
  - `medicines`
  - `medicine_batches`
  - `suppliers`
  - `purchases` & `purchase_items`
  - `customers` & `customer_payments`
  - `sales_invoices` & `sales_items`
  - `sales_returns`
  - `damage_write_offs`
  - `held_bills`
  - `settings`

---

## 🏃 Running the Application

### 1. Start the Production Server (Full-Stack on Port 5001)
```bash
npm start
```
Then open your browser at:
```
http://localhost:5001
```

### 2. Development Mode (Vite Dev Server + Express API)
```bash
npm run dev
```

### 3. Run Automated Validation Test Suite
```bash
npm test
```
Validates sub-second search speed, FEFO batch assignment, over-sell guard rejection, pharmacist discount limit enforcement, checkout transactions, sales returns, and RBAC protection.
