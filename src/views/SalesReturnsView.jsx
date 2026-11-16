import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RotateCcw, Search, AlertCircle, CheckCircle, PackageCheck, History, ArrowLeft } from 'lucide-react';

export default function SalesReturnsView() {
  const { settings } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Return form state: object keyed by sales_item_id: { returned_pieces: number, selected: boolean }
  const [returnItemsState, setReturnItemsState] = useState({});
  const [returnReason, setReturnReason] = useState('Customer changed mind');
  const [refundMethod, setRefundMethod] = useState('CASH'); // 'CASH', 'DUE_ADJUSTMENT', 'MFS'
  const [processing, setProcessing] = useState(false);

  const currency = settings.currency_symbol || '৳';

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      setSelectedInvoice(null);
      const res = await api.lookupInvoice(searchQuery.trim());
      setInvoices(res);
      if (res.length === 1) {
        selectInvoice(res[0]);
      }
    } catch (err) {
      setError(err.message);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const selectInvoice = (inv) => {
    setSelectedInvoice(inv);
    // Initialize return state for each item
    const state = {};
    inv.items.forEach(it => {
      // Calculate how many pieces were already returned
      const previouslyReturned = (inv.past_returns || [])
        .filter(r => r.batch_id === it.batch_id)
        .reduce((a, r) => a + r.returned_pieces, 0);

      const maxAvailableToReturn = Math.max(0, it.total_pieces_deducted - previouslyReturned);

      state[it.sales_item_id] = {
        selected: false,
        batch_id: it.batch_id,
        max_pieces: maxAvailableToReturn,
        returned_pieces: maxAvailableToReturn > 0 ? 1 : 0
      };
    });
    setReturnItemsState(state);
  };

  // Calculate estimated refund total
  const calculateRefundTotal = () => {
    if (!selectedInvoice) return 0;
    let total = 0;
    const discountRatio = selectedInvoice.subtotal > 0
      ? (selectedInvoice.discount_amount / selectedInvoice.subtotal)
      : 0;

    selectedInvoice.items.forEach(it => {
      const rowState = returnItemsState[it.sales_item_id];
      if (rowState && rowState.selected && rowState.returned_pieces > 0) {
        const piecePricePaid = it.subtotal / it.total_pieces_deducted;
        const netPiecePrice = piecePricePaid * (1 - discountRatio);
        total += rowState.returned_pieces * netPiecePrice;
      }
    });

    return +total.toFixed(2);
  };

  const handleProcessReturn = async () => {
    setError(null);
    setSuccessMsg(null);

    const itemsToReturn = [];
    Object.entries(returnItemsState).forEach(([salesItemId, val]) => {
      if (val.selected && val.returned_pieces > 0) {
        itemsToReturn.push({
          sales_item_id: parseInt(salesItemId, 10),
          batch_id: val.batch_id,
          returned_pieces: parseInt(val.returned_pieces, 10)
        });
      }
    });

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return.');
      return;
    }

    if (!returnReason.trim()) {
      setError('Please specify a return reason for audit logs.');
      return;
    }

    try {
      setProcessing(true);
      const res = await api.processReturn({
        invoice_id: selectedInvoice.invoice_id,
        return_items: itemsToReturn,
        reason: returnReason,
        refund_method: refundMethod
      });

      setSuccessMsg(`Return approved! Restocked items into original batch. Refund issued: ${currency}${res.total_refund_amount.toFixed(2)} via ${res.refund_method}`);
      // Refresh invoice
      const updated = await api.lookupInvoice(selectedInvoice.invoice_number);
      if (updated && updated.length > 0) {
        selectInvoice(updated[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto p-4 space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Sales Returns & Customer Refunds</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Search past invoice by invoice number or customer mobile, verify purchased items, and restock directly into the original batch (SRS 2.3).
          </p>
        </div>

        {/* Invoice Search Input */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="e.g. INV-2026-0001 or 01712345678"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            {loading ? 'Searching...' : 'Lookup'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Invoice List if multiple match phone */}
      {!selectedInvoice && invoices.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Multiple Matching Invoices:</h3>
          <div className="divide-y divide-slate-800">
            {invoices.map(inv => (
              <div
                key={inv.invoice_id}
                onClick={() => selectInvoice(inv)}
                className="py-3 px-3 hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-bold text-sm text-white font-mono">{inv.invoice_number}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(inv.sale_date).toLocaleDateString()} • Cashier: {inv.cashier_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400 font-mono">{currency}{inv.grand_total.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">{inv.payment_method}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Invoice Details & Return Form */}
      {selectedInvoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Purchased Items Table (2 cols) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">Original Invoice:</span>
                <h3 className="text-lg font-bold text-white font-mono">{selectedInvoice.invoice_number}</h3>
                <p className="text-xs text-slate-400">
                  Date: {new Date(selectedInvoice.sale_date).toLocaleString()} • Billed by {selectedInvoice.cashier_name}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Invoice Grand Total</div>
                <div className="text-xl font-bold font-mono text-white">{currency}{selectedInvoice.grand_total.toFixed(2)}</div>
                <div className="text-xs text-slate-500">Method: {selectedInvoice.payment_method}</div>
              </div>
            </div>

            {selectedInvoice.customer_name && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs flex justify-between">
                <div>
                  <span className="text-slate-400">Customer:</span> <strong className="text-white">{selectedInvoice.customer_name}</strong> ({selectedInvoice.customer_phone})
                </div>
                <div>
                  <span className="text-slate-400">Current Due:</span> <strong className="text-rose-400">{currency}{selectedInvoice.due_amount?.toFixed(2)}</strong>
                </div>
              </div>
            )}

            {/* Line Items selection */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Select Items to Return & Restock:
              </h4>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                      <th className="py-2.5 px-3 text-center">Return?</th>
                      <th className="py-2.5 px-3">Medicine & Strength</th>
                      <th className="py-2.5 px-3">Batch Number</th>
                      <th className="py-2.5 px-3 text-center">Purchased</th>
                      <th className="py-2.5 px-3 text-center">Return Pcs</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selectedInvoice.items.map((it) => {
                      const state = returnItemsState[it.sales_item_id] || { selected: false, returned_pieces: 0, max_pieces: 0 };
                      const isRowSelected = state.selected;

                      return (
                        <tr
                          key={it.sales_item_id}
                          className={`transition-colors ${isRowSelected ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'}`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              disabled={state.max_pieces === 0}
                              checked={isRowSelected}
                              onChange={(e) => {
                                setReturnItemsState(prev => ({
                                  ...prev,
                                  [it.sales_item_id]: {
                                    ...prev[it.sales_item_id],
                                    selected: e.target.checked
                                  }
                                }));
                              }}
                              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-800 border-slate-600"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{it.brand_name}</div>
                            <div className="text-[11px] text-slate-400">{it.dosage_form} • {it.strength}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {it.batch_number}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="font-bold text-white">{it.qty_sold_in_unit} {it.sold_unit_type}</div>
                            <div className="text-[10px] text-slate-500">({it.total_pieces_deducted} pcs)</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {state.max_pieces > 0 ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max={state.max_pieces}
                                  disabled={!isRowSelected}
                                  value={state.returned_pieces}
                                  onChange={(e) => {
                                    const val = Math.min(state.max_pieces, Math.max(1, parseInt(e.target.value, 10) || 1));
                                    setReturnItemsState(prev => ({
                                      ...prev,
                                      [it.sales_item_id]: {
                                        ...prev[it.sales_item_id],
                                        returned_pieces: val
                                      }
                                    }));
                                  }}
                                  className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-white font-bold text-xs"
                                />
                                <span className="text-[10px] text-slate-400">/ {state.max_pieces} pcs</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-rose-400 font-medium">Fully Returned</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {currency}{it.unit_price.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            {currency}{it.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History of Past Returns */}
            {selectedInvoice.past_returns && selectedInvoice.past_returns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Past Returns on this Invoice:
                </h4>
                <div className="space-y-1.5 text-xs">
                  {selectedInvoice.past_returns.map(r => (
                    <div key={r.return_id} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200">Restocked {r.returned_pieces} pieces</span>
                        <span className="text-slate-400"> into Batch {r.batch_number} • Reason: "{r.reason}"</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-amber-400 font-bold">{currency}{r.refund_amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">{new Date(r.return_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Refund Calculation & Authorization Panel (1 col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Refund Calculation
              </h3>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span>Original Invoice Subtotal:</span>
                  <span className="font-mono">{currency}{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-800 text-amber-400">
                    <span>Applied Discount:</span>
                    <span className="font-mono">-{currency}{selectedInvoice.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span>Proportional Refund Adjustment:</span>
                  <span className="font-mono text-emerald-400">Automatic</span>
                </div>
              </div>

              {/* Total Refund Display */}
              <div className="p-4 my-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-center">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total Refund Payable</div>
                <div className="text-3xl font-extrabold text-white font-mono mt-1">
                  {currency}{calculateRefundTotal().toFixed(2)}
                </div>
                <div className="text-[10px] text-amber-300/80 mt-1">
                  Deducts original proportional discount
                </div>
              </div>

              {/* Return Reason Field */}
              <div className="space-y-2 mb-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Return Audit Reason *
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-amber-500"
                >
                  <option value="Customer changed mind">Customer changed mind / Extra medicine</option>
                  <option value="Doctor changed prescription">Doctor changed prescription</option>
                  <option value="Adverse reaction or allergy">Adverse reaction or allergy</option>
                  <option value="Dispensing error by cashier">Dispensing error by cashier</option>
                  <option value="Packaging seal intact - unneeded">Packaging seal intact - unneeded</option>
                </select>
              </div>

              {/* Refund Method */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Refund Method:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('CASH')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      refundMethod === 'CASH'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Cash Payout
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('DUE_ADJUSTMENT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      refundMethod === 'DUE_ADJUSTMENT'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Due Deduction
                  </button>
                </div>
              </div>
            </div>

            {/* Confirm Return Button */}
            <button
              type="button"
              disabled={processing || calculateRefundTotal() <= 0}
              onClick={handleProcessReturn}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{processing ? 'Restocking & Refunding...' : 'Confirm Return & Restock to Batch'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
