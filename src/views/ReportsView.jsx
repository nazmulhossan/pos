import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  AlertTriangle,
  Lock,
  Layers,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

export default function ReportsView() {
  const { user, settings } = useAuth();
  const [period, setPeriod] = useState('today'); // 'today', 'week', 'month', 'all'
  const [activeReportTab, setActiveReportTab] = useState('sales'); // 'sales', 'profit_loss', 'fast_moving', 'expiry_loss'

  const [salesData, setSalesData] = useState(null);
  const [profitLossData, setProfitLossData] = useState(null);
  const [fastMovingData, setFastMovingData] = useState([]);
  const [expiryLossData, setExpiryLossData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currency = settings.currency_symbol || '৳';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const [salesRes, fastRes, lossRes] = await Promise.all([
        api.getSalesReport(period),
        api.getFastMoving(15),
        api.getExpiryLossReport()
      ]);

      setSalesData(salesRes);
      setFastMovingData(fastRes);
      setExpiryLossData(lossRes);

      if (isAdmin) {
        try {
          const plRes = await api.getProfitLossReport(period);
          setProfitLossData(plRes.metrics);
        } catch (e) {
          console.warn('P&L fetch error:', e);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Financial Reporting & Inventory Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time sales collection breakdowns, batch-specific profit/loss statement, and top-selling trends (SRS 3.3).
          </p>
        </div>

        {/* Time Period Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl border border-slate-700">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'Last 30 Days' },
            { id: 'all', label: 'All Time' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === p.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Navigation Tabs for Reports */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex gap-2">
        <button
          onClick={() => setActiveReportTab('sales')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReportTab === 'sales' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Sales & Collections</span>
        </button>

        <button
          onClick={() => setActiveReportTab('profit_loss')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReportTab === 'profit_loss' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Profit & Loss Statement</span>
          {!isAdmin && <Lock className="w-3 h-3 text-slate-400" />}
        </button>

        <button
          onClick={() => setActiveReportTab('fast_moving')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReportTab === 'fast_moving' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Fast-Moving Rankings</span>
        </button>

        <button
          onClick={() => setActiveReportTab('expiry_loss')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeReportTab === 'expiry_loss' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Expiry / Damage Losses</span>
        </button>
      </div>

      {/* SALES & COLLECTION REPORT */}
      {activeReportTab === 'sales' && salesData && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
              <span className="text-slate-400 text-xs font-semibold">Total Revenue</span>
              <div className="text-2xl font-extrabold text-white font-mono mt-1">
                {currency}{salesData.summary.total_revenue?.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{salesData.summary.total_invoices} invoices billed</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
              <span className="text-slate-400 text-xs font-semibold">Cash / MFS Collected</span>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                {currency}{salesData.summary.total_collected?.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-1">Realized liquid funds</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
              <span className="text-slate-400 text-xs font-semibold">Discounts Given</span>
              <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                {currency}{salesData.summary.total_discount?.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Within cashier thresholds</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
              <span className="text-slate-400 text-xs font-semibold">Customer Due Balance</span>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                {currency}{salesData.summary.total_due_generated?.toFixed(2)}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-1">Outstanding receivables</div>
            </div>
          </div>

          {/* Payment Method Breakdown (SRS 3.3) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sales Breakdown by Payment Method
              </h3>
              <div className="space-y-2">
                {salesData.payment_breakdown.map((pm, idx) => {
                  const percentage = salesData.summary.total_collected > 0
                    ? ((pm.total_collected / salesData.summary.total_collected) * 100).toFixed(1)
                    : 0;
                  return (
                    <div key={idx} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white uppercase">{pm.payment_method}</span>
                        <span className="font-mono text-emerald-400 font-bold">{currency}{pm.total_collected.toFixed(2)} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{pm.count} transactions</span>
                        <span>Total Billed: {currency}{pm.total_billed.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invoices List */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Recent Invoices in this Period ({salesData.recent_invoices.length})
              </h3>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {salesData.recent_invoices.map(inv => (
                  <div key={inv.invoice_id} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white font-mono">{inv.invoice_number}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(inv.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Cashier: {inv.cashier_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-emerald-400">{currency}{inv.grand_total.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">{inv.payment_method}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFIT & LOSS STATEMENT (ADMIN ONLY - SRS 3.1 & 3.3) */}
      {activeReportTab === 'profit_loss' && (
        !isAdmin ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Restricted Access (Role-Based Access Control)</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cashiers and Pharmacists are restricted from viewing wholesale purchase costs and gross profit margin statements.
            </p>
            <p className="text-xs text-emerald-400 font-semibold">
              Please sign in with an Administrator account to view full financial reports.
            </p>
          </div>
        ) : profitLossData ? (
          <div className="space-y-4">
            {/* P&L Key Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-slate-400 text-xs font-semibold">Gross Sales</span>
                <div className="text-2xl font-extrabold text-white font-mono mt-1">
                  {currency}{profitLossData.gross_sales?.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Billed revenue before discounts</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-slate-400 text-xs font-semibold">Cost of Goods Sold (COGS)</span>
                <div className="text-2xl font-extrabold text-slate-300 font-mono mt-1">
                  {currency}{profitLossData.cost_of_goods_sold?.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Actual batch purchase costs</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-slate-400 text-xs font-semibold">Net Profit (After Losses)</span>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                  {currency}{profitLossData.net_profit?.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-500/80 mt-1">Realized net earnings</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <span className="text-slate-400 text-xs font-semibold">Net Profit Margin</span>
                <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">
                  {profitLossData.profit_margin_percent}%
                </div>
                <div className="text-[10px] text-indigo-400/80 mt-1">Net profit / gross sales</div>
              </div>
            </div>

            {/* Formal Income Statement Table (SRS 3.3) */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-3xl mx-auto space-y-4">
              <div className="text-center pb-4 border-b border-slate-800">
                <h3 className="text-base font-bold text-white uppercase tracking-tight">
                  Comprehensive Profit & Loss Income Statement
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accounting period: {period.toUpperCase()} • Generated using FEFO batch purchase ledger
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800 font-semibold text-slate-200">
                  <span>Gross Sales (Billed Price)</span>
                  <span className="font-mono text-white text-sm">{currency}{profitLossData.gross_sales?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400">
                  <span>Less: Cost of Goods Sold (Batch Purchase Cost)</span>
                  <span className="font-mono text-slate-300">-{currency}{profitLossData.cost_of_goods_sold?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800 font-bold text-emerald-400 bg-slate-850 px-3 rounded-lg">
                  <span>GROSS PROFIT MARGIN</span>
                  <span className="font-mono text-sm">{currency}{profitLossData.gross_profit?.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400 pl-3">
                  <span>Less: Promotional & Cashier Discounts</span>
                  <span className="font-mono text-amber-400">-{currency}{profitLossData.discounts_given?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400 pl-3">
                  <span>Less: Sales Returns & Customer Refunds</span>
                  <span className="font-mono text-amber-400">-{currency}{profitLossData.sales_refunds?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400 pl-3">
                  <span>Less: Expired & Damaged Stock Write-Off Losses</span>
                  <span className="font-mono text-rose-400">-{currency}{profitLossData.damage_expiry_losses?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800 text-slate-400 pl-3">
                  <span>VAT Collected (Pass-through Tax Liability)</span>
                  <span className="font-mono text-slate-400">+{currency}{profitLossData.vat_collected?.toFixed(2)}</span>
                </div>

                <div className="flex justify-between py-3 border-t-2 border-emerald-500 font-extrabold text-white text-base bg-emerald-950/40 px-3 rounded-xl mt-3">
                  <span>NET PHARMACY PROFIT</span>
                  <span className="font-mono text-emerald-400">{currency}{profitLossData.net_profit?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* FAST MOVING MEDICINES (SRS 3.3) */}
      {activeReportTab === 'fast_moving' && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Top-Selling Medicine Rankings (by Base Units Sold)
            </h3>
            <span className="text-xs text-slate-400">Showing top 15 SKU performers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Medicine Brand</th>
                  <th className="py-3 px-4">Generic Composition</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4 text-center">Transactions</th>
                  <th className="py-3 px-4 text-right">Total Units Sold (Pcs)</th>
                  <th className="py-3 px-4 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {fastMovingData.map((item, idx) => (
                  <tr key={item.medicine_id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{item.brand_name}</div>
                      <div className="text-[10px] text-slate-500">{item.dosage_form} • {item.strength}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.generic_name}</td>
                    <td className="py-3 px-4 text-slate-400">{item.manufacturer_name}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">{item.order_frequency} orders</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      {item.total_pieces_sold} pcs
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {currency}{item.total_revenue?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPIRY & DAMAGE WRITE-OFF LOSSES (SRS 3.3) */}
      {activeReportTab === 'expiry_loss' && expiryLossData && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-xl mx-auto text-center space-y-2">
            <span className="text-xs uppercase font-bold text-rose-400">Cumulative Stock Write-Off Loss</span>
            <div className="text-4xl font-extrabold text-white font-mono">
              {isAdmin ? `${currency}${expiryLossData.total_financial_loss?.toFixed(2)}` : 'Restricted (Admin Only)'}
            </div>
            <p className="text-xs text-slate-400">
              Total write-offs from expired batches, packaging breaks, and storage damage.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Loss Breakdown by Decommission Reason
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {expiryLossData.breakdown_by_reason.map((r, idx) => (
                <div key={idx} className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-1">
                  <div className="text-xs font-bold text-white uppercase">{r.reason}</div>
                  <div className="text-xs text-slate-400">{r.total_pieces_lost} pieces written off ({r.incidents} incidents)</div>
                  {isAdmin && (
                    <div className="text-lg font-bold font-mono text-rose-400 pt-1">
                      {currency}{r.total_financial_loss?.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
