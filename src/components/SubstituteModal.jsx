import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Plus, X, Search, ShieldCheck } from 'lucide-react';

export default function SubstituteModal({ medicine, onClose, onSelectSubstitute }) {
  const { settings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [substitutes, setSubstitutes] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState(null);

  const currency = settings.currency_symbol || '৳';

  useEffect(() => {
    async function loadSubs() {
      if (!medicine) return;
      try {
        setLoading(true);
        const res = await api.getSubstitutes(medicine.medicine_id);
        setSubstitutes(res.substitutes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSubs();
  }, [medicine]);

  if (!medicine) return null;

  const filtered = substitutes.filter(s =>
    s.brand_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.manufacturer_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Generic Substitute Finder <span className="text-xs font-mono font-normal text-emerald-400">(F2)</span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Exact matches for generic composition: <strong className="text-slate-200">{medicine.generic_name} ({medicine.strength})</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Medicine Pill */}
        <div className="p-3 my-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">{medicine.brand_name}</div>
            <div className="text-[11px] text-slate-400">{medicine.manufacturer_name} • {medicine.dosage_form}</div>
          </div>
          <div className="text-right">
            <div className={`text-xs font-bold ${medicine.available_pieces > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {medicine.available_pieces > 0 ? `${medicine.available_pieces} Pcs in Stock` : 'Out of Stock'}
            </div>
            <div className="text-[11px] text-slate-400">
              Piece: {currency}{medicine.prices?.PIECE?.toFixed(2)} | Strip: {currency}{medicine.prices?.STRIP?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filter alternative brand or manufacturer..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
            autoFocus
          />
        </div>

        {/* Substitutes List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Searching active in-stock generic alternatives...</div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No other in-stock alternative brands found with matching active generic and strength.
            </div>
          ) : (
            filtered.map(sub => (
              <div
                key={sub.medicine_id}
                className="p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 transition-all flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{sub.brand_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      Bio-Equivalent
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {sub.manufacturer_name} • {sub.dosage_form} • {sub.strength}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-300 font-mono">
                    <span>Pcs: <strong className="text-white">{currency}{sub.prices?.PIECE?.toFixed(2)}</strong></span>
                    <span>Strip: <strong className="text-white">{currency}{sub.prices?.STRIP?.toFixed(2)}</strong></span>
                    <span>Box: <strong className="text-white">{currency}{sub.prices?.BOX?.toFixed(2)}</strong></span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/60">
                    {sub.available_pieces} Pcs Ready
                  </span>
                  <button
                    onClick={() => onSelectSubstitute(sub)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
