import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Boxes,
  AlertTriangle,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Filter,
  Search,
  CheckCircle,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';

export default function InventoryBatchesView() {
  const { user, settings } = useAuth();
  const [batches, setBatches] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRED', 'EXPIRING_30', 'EXPIRING_60', 'EXPIRING_90'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Batch Modal
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [medicinesList, setMedicinesList] = useState([]);
  const [newBatch, setNewBatch] = useState({
    medicine_id: '',
    batch_number: '',
    expiry_date: '',
    purchase_price_piece: '',
    selling_price_piece: '',
    stock_qty_pieces: ''
  });

  // Write-off Modal
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffTargetBatch, setWriteOffTargetBatch] = useState(null);
  const [writeOffForm, setWriteOffForm] = useState({
    quantity_pieces: '',
    reason: 'EXPIRED',
    notes: ''
  });

  const currency = settings.currency_symbol || '৳';
  const isPharmacist = user?.role === 'PHARMACIST';
  const canManageInventory = user?.role === 'ADMIN' || user?.role === 'INVENTORY_MANAGER';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [batchesRes, alertsRes, medsRes] = await Promise.all([
        api.getBatches(),
        api.getAlerts(),
        api.getMedicines()
      ]);
      setBatches(batchesRes);
      setAlerts(alertsRes);
      setMedicinesList(medsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      await api.addBatch(newBatch);
      setShowAddBatchModal(false);
      setNewBatch({
        medicine_id: '',
        batch_number: '',
        expiry_date: '',
        purchase_price_piece: '',
        selling_price_piece: '',
        stock_qty_pieces: ''
      });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRecordWriteOff = async (e) => {
    e.preventDefault();
    if (!writeOffTargetBatch) return;

    try {
      await api.recordWriteOff({
        batch_id: writeOffTargetBatch.batch_id,
        quantity_pieces: writeOffForm.quantity_pieces,
        reason: writeOffForm.reason,
        notes: writeOffForm.notes
      });
      setShowWriteOffModal(false);
      setWriteOffTargetBatch(null);
      setWriteOffForm({ quantity_pieces: '', reason: 'EXPIRED', notes: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter batches
  const filteredBatches = batches.filter(b => {
    const matchesSearch = b.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.batch_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'LOW_STOCK') {
      return b.stock_qty_pieces <= b.reorder_level;
    }
    if (activeFilter === 'EXPIRED') {
      return b.expiry_status === 'EXPIRED';
    }
    if (activeFilter === 'EXPIRING_30') {
      return b.expiry_status === 'EXPIRING_30_DAYS';
    }
    if (activeFilter === 'EXPIRING_60') {
      return b.expiry_status === 'EXPIRING_60_DAYS';
    }
    if (activeFilter === 'EXPIRING_90') {
      return b.expiry_status === 'EXPIRING_90_DAYS';
    }

    return true;
  });

  return (
    <div className="max-w-[1700px] mx-auto p-4 space-y-4">
      {/* Top Header & Automated Alerts Bar (SRS 3.2) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Boxes className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Batch-Level Inventory & FEFO Expiration Tracking
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Base-unit inventory storage (pieces) with automated 30, 60, 90 days early expiry warnings and low-stock reorder triggers.
            </p>
          </div>

          {canManageInventory && (
            <button
              onClick={() => setShowAddBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Medicine Batch</span>
            </button>
          )}
        </div>

        {/* Automated Alert Counters (SRS 3.2) */}
        {alerts && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div
              onClick={() => setActiveFilter('LOW_STOCK')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeFilter === 'LOW_STOCK' ? 'bg-amber-500/20 border-amber-500 shadow-md' : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                <span>Low Stock</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">{alerts.counts.low_stock_count}</div>
              <div className="text-[10px] text-slate-400">At or below reorder level</div>
            </div>

            <div
              onClick={() => setActiveFilter('EXPIRED')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeFilter === 'EXPIRED' ? 'bg-rose-500/20 border-rose-500 shadow-md' : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
                <span>Expired (Blocked)</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">{alerts.counts.expired_count}</div>
              <div className="text-[10px] text-slate-400">Strictly blocked from POS</div>
            </div>

            <div
              onClick={() => setActiveFilter('EXPIRING_30')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeFilter === 'EXPIRING_30' ? 'bg-orange-500/20 border-orange-500 shadow-md' : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-orange-400 font-semibold">
                <span>Expiring ≤ 30d</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">{alerts.counts.expiring_30_count}</div>
              <div className="text-[10px] text-slate-400">Immediate clearance needed</div>
            </div>

            <div
              onClick={() => setActiveFilter('EXPIRING_60')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeFilter === 'EXPIRING_60' ? 'bg-yellow-500/20 border-yellow-500 shadow-md' : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-yellow-400 font-semibold">
                <span>Expiring ≤ 60d</span>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">{alerts.counts.expiring_60_count}</div>
              <div className="text-[10px] text-slate-400">Early expiry warning</div>
            </div>

            <div
              onClick={() => setActiveFilter('EXPIRING_90')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                activeFilter === 'EXPIRING_90' ? 'bg-blue-500/20 border-blue-500 shadow-md' : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
                <span>Expiring ≤ 90d</span>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">{alerts.counts.expiring_90_count}</div>
              <div className="text-[10px] text-slate-400">Quarterly notice</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'All Batches' },
            { id: 'LOW_STOCK', label: 'Low Stock Alert' },
            { id: 'EXPIRED', label: 'Expired Stock' },
            { id: 'EXPIRING_30', label: '≤ 30 Days' },
            { id: 'EXPIRING_60', label: '≤ 60 Days' },
            { id: 'EXPIRING_90', label: '≤ 90 Days' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === f.id
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search brand, generic, or batch #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <th className="py-3 px-4">Medicine Info</th>
                <th className="py-3 px-4">Batch #</th>
                <th className="py-3 px-4">Expiration (FEFO)</th>
                <th className="py-3 px-4 text-center">Status</th>
                {!isPharmacist && <th className="py-3 px-4 text-right">Cost / Pc</th>}
                <th className="py-3 px-4 text-right">Selling / Pc</th>
                <th className="py-3 px-4 text-right">Stock (Pieces)</th>
                <th className="py-3 px-4">Packaging Breakdown</th>
                {canManageInventory && <th className="py-3 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-500">
                    No batches match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map(b => {
                  const isExpired = b.expiry_status === 'EXPIRED';
                  const isExpiring30 = b.expiry_status === 'EXPIRING_30_DAYS';

                  return (
                    <tr key={b.batch_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{b.brand_name}</div>
                        <div className="text-[11px] text-slate-400">{b.generic_name} • {b.dosage_form} {b.strength}</div>
                        <div className="text-[10px] text-slate-500">{b.manufacturer_name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {b.batch_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-white">{b.expiry_date}</div>
                        <div className={`text-[10px] font-medium ${
                          isExpired ? 'text-rose-400' : isExpiring30 ? 'text-orange-400' : 'text-slate-400'
                        }`}>
                          {b.days_until_expiry < 0 ? `Expired ${Math.abs(b.days_until_expiry)} days ago` : `${b.days_until_expiry} days remaining`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            BLOCKED (EXPIRED)
                          </span>
                        ) : isExpiring30 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            ≤ 30 DAYS
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      {!isPharmacist && (
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {currency}{b.purchase_price_piece?.toFixed(2)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {currency}{b.selling_price_piece?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                        {b.stock_qty_pieces} pcs
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        {b.stock_summary}
                      </td>
                      {canManageInventory && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setWriteOffTargetBatch(b);
                              setShowWriteOffModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-slate-700 text-[11px] font-medium transition-colors"
                            title="Write-off damaged or expired stock"
                          >
                            Write-Off
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW BATCH MODAL */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add New Medicine Batch (FEFO)</h3>
              <button onClick={() => setShowAddBatchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Medicine *</label>
                <select
                  required
                  value={newBatch.medicine_id}
                  onChange={(e) => setNewBatch(p => ({ ...p, medicine_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicinesList.map(m => (
                    <option key={m.medicine_id} value={m.medicine_id}>
                      {m.brand_name} ({m.generic_name} {m.strength})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NX-2027C"
                    value={newBatch.batch_number}
                    onChange={(e) => setNewBatch(p => ({ ...p, batch_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiration Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.expiry_date}
                    onChange={(e) => setNewBatch(p => ({ ...p, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cost / Pc ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2.10"
                    value={newBatch.purchase_price_piece}
                    onChange={(e) => setNewBatch(p => ({ ...p, purchase_price_piece: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sell / Pc ({currency}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="3.00"
                    value={newBatch.selling_price_piece}
                    onChange={(e) => setNewBatch(p => ({ ...p, selling_price_piece: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Base Pieces *</label>
                  <input
                    type="number"
                    required
                    placeholder="100"
                    value={newBatch.stock_qty_pieces}
                    onChange={(e) => setNewBatch(p => ({ ...p, stock_qty_pieces: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Save Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DAMAGE / EXPIRY WRITE-OFF MODAL */}
      {showWriteOffModal && writeOffTargetBatch && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Record Stock Write-Off</h3>
              <button onClick={() => setShowWriteOffModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs space-y-1">
              <div className="font-bold text-white">{writeOffTargetBatch.brand_name}</div>
              <div className="text-slate-400">Batch: {writeOffTargetBatch.batch_number} • Stock: {writeOffTargetBatch.stock_qty_pieces} pieces</div>
              <div className="text-slate-400">Purchase Cost: {currency}{writeOffTargetBatch.purchase_price_piece?.toFixed(2)}/pc</div>
            </div>

            <form onSubmit={handleRecordWriteOff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pieces to Write-Off (Max: {writeOffTargetBatch.stock_qty_pieces}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={writeOffTargetBatch.stock_qty_pieces}
                  required
                  value={writeOffForm.quantity_pieces}
                  onChange={(e) => setWriteOffForm(p => ({ ...p, quantity_pieces: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Write-Off *</label>
                <select
                  value={writeOffForm.reason}
                  onChange={(e) => setWriteOffForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                >
                  <option value="EXPIRED">Expired Past Safe Shelf Date</option>
                  <option value="DAMAGED">Damaged / Seal Broken in Storage</option>
                  <option value="BROKEN">Broken Bottle / Ampoule Spill</option>
                  <option value="LOST">Discrepancy / Lost in Physical Count</option>
                  <option value="OTHER">Other Defect</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Audit Notes</label>
                <textarea
                  rows={2}
                  placeholder="Explain why stock is being decommissioned..."
                  value={writeOffForm.notes}
                  onChange={(e) => setWriteOffForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                />
              </div>

              {writeOffForm.quantity_pieces > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs flex justify-between">
                  <span className="text-slate-300">Financial Loss:</span>
                  <span className="font-mono font-bold text-rose-400">
                    {currency}{(parseFloat(writeOffForm.quantity_pieces) * (writeOffTargetBatch.purchase_price_piece || 0)).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWriteOffModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow"
                >
                  Confirm Decommission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
