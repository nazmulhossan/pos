const express = require('express');
const { db } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/sales
// Daily, weekly, and monthly sales broken down by payment method (Cash, Card, MFS, Due)
router.get('/sales', authenticateToken, (req, res) => {
  const period = req.query.period || 'today'; // 'today', 'week', 'month', 'all'
  let dateFilter = '';

  if (period === 'today') {
    dateFilter = "date(sale_date, 'localtime') = date('now', 'localtime')";
  } else if (period === 'week') {
    dateFilter = "date(sale_date, 'localtime') >= date('now', '-7 days', 'localtime')";
  } else if (period === 'month') {
    dateFilter = "date(sale_date, 'localtime') >= date('now', '-30 days', 'localtime')";
  } else {
    dateFilter = '1=1';
  }

  try {
    // Summary metrics
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(due_amount), 0) as total_due_generated
      FROM sales_invoices
      WHERE ${dateFilter}
    `).get();

    // Payment method breakdown
    const paymentBreakdown = db.prepare(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(grand_total), 0) as total_billed
      FROM sales_invoices
      WHERE ${dateFilter}
      GROUP BY payment_method
      ORDER BY total_collected DESC
    `).all();

    // Recent invoices within period
    const recentInvoices = db.prepare(`
      SELECT i.*, u.full_name as cashier_name, c.name as customer_name, c.phone as customer_phone
      FROM sales_invoices i
      JOIN users u ON i.user_id = u.user_id
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      WHERE ${dateFilter}
      ORDER BY i.invoice_id DESC
      LIMIT 100
    `).all();

    res.json({
      period,
      summary,
      payment_breakdown: paymentBreakdown,
      recent_invoices: recentInvoices
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate sales report: ' + err.message });
  }
});

// GET /api/reports/profit-loss (SRS 3.3 - Admin Only)
// Accurate gross and net profit derived from batch-specific purchase cost versus actual billed selling price
router.get('/profit-loss', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const period = req.query.period || 'month'; // 'today', 'week', 'month', 'all'
  let dateFilter = '';
  let writeOffDateFilter = '';

  if (period === 'today') {
    dateFilter = "date(i.sale_date, 'localtime') = date('now', 'localtime')";
    writeOffDateFilter = "date(created_at, 'localtime') = date('now', 'localtime')";
  } else if (period === 'week') {
    dateFilter = "date(i.sale_date, 'localtime') >= date('now', '-7 days', 'localtime')";
    writeOffDateFilter = "date(created_at, 'localtime') >= date('now', '-7 days', 'localtime')";
  } else if (period === 'month') {
    dateFilter = "date(i.sale_date, 'localtime') >= date('now', '-30 days', 'localtime')";
    writeOffDateFilter = "date(created_at, 'localtime') >= date('now', '-30 days', 'localtime')";
  } else {
    dateFilter = '1=1';
    writeOffDateFilter = '1=1';
  }

  try {
    // 1. Calculate sales revenue & cost of goods sold (COGS) based on batch-specific purchase cost
    const salesData = db.prepare(`
      SELECT 
        COUNT(DISTINCT i.invoice_id) as total_invoices,
        COALESCE(SUM(si.subtotal), 0) as total_sales_subtotal,
        COALESCE(SUM(si.total_pieces_deducted * b.purchase_price_piece), 0) as total_cogs,
        COALESCE(SUM(i.discount_amount), 0) / COUNT(DISTINCT si.sales_item_id) as invoice_discounts,
        COALESCE(SUM(i.vat_amount), 0) / COUNT(DISTINCT si.sales_item_id) as total_vat
      FROM sales_items si
      JOIN sales_invoices i ON si.invoice_id = i.invoice_id
      JOIN medicine_batches b ON si.batch_id = b.batch_id
      WHERE ${dateFilter}
    `).get();

    // Sum discounts directly from invoices
    const invoiceSummary = db.prepare(`
      SELECT 
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(SUM(subtotal), 0) as total_gross_sales,
        COALESCE(SUM(vat_amount), 0) as total_vat
      FROM sales_invoices
      WHERE ${dateFilter.replace(/i\./g, '')}
    `).get();

    // 2. Financial loss from damage and expiry write-offs
    const writeOffData = db.prepare(`
      SELECT 
        COUNT(*) as total_write_offs,
        COALESCE(SUM(loss_amount), 0) as total_write_off_loss
      FROM damage_write_offs
      WHERE ${writeOffDateFilter}
    `).get();

    // 3. Refunds from returns
    const returnData = db.prepare(`
      SELECT 
        COUNT(*) as total_returns,
        COALESCE(SUM(refund_amount), 0) as total_refunds
      FROM sales_returns
      WHERE ${writeOffDateFilter.replace(/created_at/g, 'return_date')}
    `).get();

    const grossSales = invoiceSummary.total_gross_sales || 0;
    const cogs = salesData.total_cogs || 0;
    const grossProfit = +(grossSales - cogs).toFixed(2);
    const discountsGiven = invoiceSummary.total_discounts || 0;
    const refunds = returnData.total_refunds || 0;
    const writeOffLoss = writeOffData.total_write_off_loss || 0;
    const netProfit = +(grossProfit - discountsGiven - refunds - writeOffLoss).toFixed(2);
    const marginPercent = grossSales > 0 ? +((netProfit / grossSales) * 100).toFixed(2) : 0;

    res.json({
      period,
      metrics: {
        gross_sales: grossSales,
        cost_of_goods_sold: cogs,
        gross_profit: grossProfit,
        discounts_given: discountsGiven,
        sales_refunds: refunds,
        damage_expiry_losses: writeOffLoss,
        vat_collected: invoiceSummary.total_vat,
        net_profit: netProfit,
        profit_margin_percent: marginPercent
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate profit/loss report: ' + err.message });
  }
});

// GET /api/reports/fast-moving
// Top-selling medicine rankings by quantity and revenue (SRS 3.3)
router.get('/fast-moving', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  try {
    const list = db.prepare(`
      SELECT 
        m.medicine_id,
        m.brand_name,
        m.dosage_form,
        m.strength,
        g.generic_name,
        mf.name as manufacturer_name,
        m.pieces_per_strip,
        m.strips_per_box,
        SUM(si.total_pieces_deducted) as total_pieces_sold,
        COUNT(DISTINCT si.invoice_id) as order_frequency,
        COALESCE(SUM(si.subtotal), 0) as total_revenue
      FROM sales_items si
      JOIN medicine_batches b ON si.batch_id = b.batch_id
      JOIN medicines m ON b.medicine_id = m.medicine_id
      JOIN generics g ON m.generic_id = g.generic_id
      JOIN manufacturers mf ON m.manufacturer_id = mf.manufacturer_id
      GROUP BY m.medicine_id
      ORDER BY total_pieces_sold DESC
      LIMIT ?
    `).all(limit);

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fast-moving medicines: ' + err.message });
  }
});

// GET /api/reports/expiry-loss
// Financial loss tracking for expired & damaged stock (SRS 3.3)
router.get('/expiry-loss', authenticateToken, (req, res) => {
  const isPharmacist = req.user.role === 'PHARMACIST';
  try {
    const summary = db.prepare(`
      SELECT 
        reason,
        COUNT(*) as incidents,
        SUM(quantity_pieces) as total_pieces_lost,
        COALESCE(SUM(loss_amount), 0) as total_financial_loss
      FROM damage_write_offs
      GROUP BY reason
    `).all();

    const totalLost = db.prepare('SELECT COALESCE(SUM(loss_amount), 0) as total FROM damage_write_offs').get().total;

    res.json({
      total_financial_loss: isPharmacist ? null : totalLost,
      breakdown_by_reason: summary.map(s => ({
        ...s,
        total_financial_loss: isPharmacist ? null : s.total_financial_loss
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expiry loss report: ' + err.message });
  }
});

module.exports = router;
