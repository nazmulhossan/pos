import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Search, DollarSign, History, FileText, ArrowDownLeft } from 'lucide-react';

export default function CustomersView() {
  const { settings } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState({ invoices: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Collect Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');

  // New Customer Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '' });

  const currency = settings.currency_symbol || '৳';

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.getCustomers(searchQuery);
      setCustomers(res);
      if (res.length > 0 && !selectedCustomer) {
        selectCustomer(res[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (c) => {
    setSelectedCustomer(c);
    try {
      const res = await api.getCustomerLedger(c.customer_id);
      setLedger({ invoices: res.invoices, payments: res.payments });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCustomers();
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !payAmount) return;

    try {
      await api.recordCustomerPayment(selectedCustomer.customer_id, {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        notes: payNotes
      });
      setShowPayModal(false);
      setPayAmount('');
      setPayNotes('');
      // Reload customer & ledger
      loadCustomers();
      selectCustomer(selectedCustomer);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.addCustomer(newCust);
      setShowNewModal(false);
      setNewCust({ name: '', phone: '', address: '' });
      loadCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Customer Credit Directory & Due Ledgers
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track registered customer profiles, cumulative due balances, past transactions, and credit collection history (SRS 5.3).
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Register New Customer</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Main Grid: Left Customers List, Right Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Customer List (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col space-y-3 h-[calc(100vh-250px)]">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
            />
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {customers.map(c => {
              const isSelected = selectedCustomer?.customer_id === c.customer_id;
              return (
                <div
                  key={c.customer_id}
                  onClick={() => selectCustomer(c)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-500 text-white shadow'
                      : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm text-white">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.phone}</div>
                    </div>
                    {c.total_due > 0 ? (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Due: {currency}{c.total_due.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-semibold">
                        Clear
                      </span>
                    )}
                  </div>
                  {c.address && (
                    <div className="text-[11px] text-slate-500 mt-1 truncate">{c.address}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Customer Statement / Ledger (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col space-y-4 h-[calc(100vh-250px)] overflow-y-auto">
          {selectedCustomer ? (
            <>
              {/* Customer Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedCustomer.name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Phone: <strong className="text-slate-300">{selectedCustomer.phone}</strong> • Address: {selectedCustomer.address || 'N/A'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Outstanding Debt</div>
                    <div className="text-2xl font-extrabold font-mono text-rose-400">
                      {currency}{selectedCustomer.total_due.toFixed(2)}
                    </div>
                  </div>

                  {selectedCustomer.total_due > 0 && (
                    <button
                      onClick={() => {
                        setPayAmount(String(selectedCustomer.total_due));
                        setShowPayModal(true);
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Collect Payment</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Ledger */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Sales Invoices on Credit:
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Invoice Total</th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-3 text-right">Credit Due</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {ledger.invoices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">No invoices recorded for this customer.</td>
                          </tr>
                        ) : (
                          ledger.invoices.map(inv => (
                            <tr key={inv.invoice_id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-mono font-bold text-white">{inv.invoice_number}</td>
                              <td className="py-2.5 px-3 text-slate-400">{new Date(inv.sale_date).toLocaleDateString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-white">{currency}{inv.grand_total.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-400">{currency}{inv.paid_amount.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">{currency}{inv.due_amount.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  inv.due_amount > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {inv.due_amount > 0 ? 'Has Due' : 'Paid in Full'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments Collected */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-purple-400" />
                    Credit Payments Received:
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Received By</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {ledger.payments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">No debt recovery payments recorded yet.</td>
                          </tr>
                        ) : (
                          ledger.payments.map(p => (
                            <tr key={p.payment_id} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 text-slate-300 font-mono">{new Date(p.created_at).toLocaleString()}</td>
                              <td className="py-2 px-3 text-slate-400">{p.received_by}</td>
                              <td className="py-2 px-3 text-slate-300">{p.payment_method}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{currency}{p.amount.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Select a customer from the left directory to view full credit ledger.
            </div>
          )}
        </div>
      </div>

      {/* COLLECT PAYMENT MODAL */}
      {showPayModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Receive Customer Credit Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="font-bold text-white">{selectedCustomer.name}</div>
              <div className="text-rose-400 font-bold">Outstanding Debt: {currency}{selectedCustomer.total_due.toFixed(2)}</div>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Collection Amount ({currency}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reference Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at counter"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Record Recovery</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Register New Customer</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvir Hasan"
                  value={newCust.name}
                  onChange={(e) => setNewCust(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Mobile Phone (Unique) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 01712345678"
                  value={newCust.phone}
                  onChange={(e) => setNewCust(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Address / Landmark</label>
                <textarea
                  rows={2}
                  placeholder="Street, Area, City..."
                  value={newCust.address}
                  onChange={(e) => setNewCust(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
