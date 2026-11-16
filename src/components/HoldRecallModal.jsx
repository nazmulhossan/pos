import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, RotateCcw, Trash2, X, PlusCircle } from 'lucide-react';

export default function HoldRecallModal({ mode, cart, customer, discount, onClose, onRestoreCart }) {
  const [heldBills, setHeldBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [referenceNote, setReferenceNote] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode === 'recall') {
      loadHeldBills();
    }
  }, [mode]);

  const loadHeldBills = async () => {
    try {
      setLoading(true);
      const bills = await api.getHeldBills();
      setHeldBills(bills);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHoldCurrent = async () => {
    if (!cart || cart.length === 0) return;
    try {
      setLoading(true);
      await api.holdBill({
        reference_note: referenceNote || `Held Cart (${cart.length} items)`,
        cart_data: cart,
        customer_id: customer ? customer.customer_id : null,
        discount_val: discount.value,
        discount_type: discount.type
      });
      onClose(true); // true means cart was held
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRestore = async (bill) => {
    try {
      await api.deleteHeldBill(bill.held_id);
      onRestoreCart(bill);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (heldId) => {
    try {
      await api.deleteHeldBill(heldId);
      setHeldBills(prev => prev.filter(b => b.held_id !== heldId));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {mode === 'hold' ? 'Hold Current Cart (F4)' : 'Recall Suspended Carts (F5)'}
            </h3>
          </div>
          <button onClick={() => onClose(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30">
            {error}
          </div>
        )}

        {/* Content */}
        {mode === 'hold' ? (
          <div className="space-y-4 py-4">
            <p className="text-xs text-slate-300">
              Suspends the active cart so you can immediately serve another walk-in customer. You can restore this cart at any time using <strong>F5</strong>.
            </p>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Items in Cart:</span>
                <span className="font-bold text-white">{cart.length} item(s)</span>
              </div>
              {customer && (
                <div className="flex justify-between text-slate-400">
                  <span>Customer:</span>
                  <span className="font-bold text-white">{customer.name} ({customer.phone})</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reference Label / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Customer checking vitamins in aisle 2"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldCurrent}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 transition-all active:scale-95"
              >
                {loading ? 'Holding...' : 'Hold Cart (F4)'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading held carts...</div>
            ) : heldBills.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No suspended carts on hold.</div>
            ) : (
              heldBills.map(bill => (
                <div
                  key={bill.held_id}
                  className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{bill.reference_note}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-700 text-slate-300 font-normal">
                        {bill.cart_data?.length || 0} items
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Held by {bill.held_by} • {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {bill.customer_name && (
                      <div className="text-[11px] text-emerald-400 mt-0.5">
                        Customer: {bill.customer_name} ({bill.customer_phone})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(bill.held_id)}
                      className="p-2 rounded-lg bg-slate-700/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Discard held cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRestore(bill)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore Cart</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
