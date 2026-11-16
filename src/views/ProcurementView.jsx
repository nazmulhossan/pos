import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Truck, Plus, Search, FileText, CheckCircle, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';

export default function ProcurementView() {
  const { settings } = useAuth();
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases', 'suppliers'
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New Purchase Invoice Modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseInvNumber, setPurchaseInvNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePaidAmount, setPurchasePaidAmount] = useState('0');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([
    { medicine_id: '', batch_number: '', expiry_date: '', unit_type: 'BOX', quantity_received: 1, unit_cost_piece: '', selling_price_piece: '' }
  ]);

  // Supplier Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTargetSupplier, setPayTargetSupplier] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  // New Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ company_name: '', contact_person: '', phone: '', total_due: 0 });

  // Expanded purchase rows
  const [expandedPurchaseId, setExpandedPurchaseId] = useState(null);

  const currency = settings.currency_symbol || '৳';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppRes, purRes, medRes] = await Promise.all([
        api.getSuppliers(),
        api.getPurchases(),
        api.getMedicines()
      ]);
      setSuppliers(suppRes);
      setPurchases(purRes);
      setMedicines(medRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchaseItemRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      { medicine_id: '', batch_number: '', expiry_date: '', unit_type: 'BOX', quantity_received: 1, unit_cost_piece: '', selling_price_piece: '' }
    ]);
  };

  const handleRemovePurchaseItemRow = (idx) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePurchaseItem = (idx, field, val) => {
    setPurchaseItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };

      // If medicine chosen, prefill estimated selling price from latest batch
      if (field === 'medicine_id') {
        const med = medicines.find(m => m.medicine_id === parseInt(val, 10));
        if (med) {
          // default selling price
          updated[idx].selling_price_piece = updated[idx].selling_price_piece || '3.00';
          updated[idx].unit_cost_piece = updated[idx].unit_cost_piece || '2.00';
        }
      }
      return updated;
    });
  };

  const calculatePurchaseGrandTotal = () => {
    return purchaseItems.reduce((acc, row) => {
      const med = medicines.find(m => m.medicine_id === parseInt(row.medicine_id, 10));
      if (!med) return acc;
      let factor = 1;
      if (row.unit_type === 'STRIP') factor = med.pieces_per_strip;
      else if (row.unit_type === 'BOX') factor = med.pieces_per_strip * med.strips_per_box;
      const pieces = Math.round((parseFloat(row.quantity_received) || 0) * factor);
      const cost = parseFloat(row.unit_cost_piece) || 0;
      return acc + (pieces * cost);
    }, 0);
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (!purchaseSupplierId || !purchaseInvNumber.trim()) {
      setError('Supplier and Invoice Number are required.');
      return;
    }

    try {
      await api.createPurchase({
        supplier_id: parseInt(purchaseSupplierId, 10),
        invoice_number: purchaseInvNumber.trim(),
        purchase_date: purchaseDate,
        items: purchaseItems,
        paid_amount: parseFloat(purchasePaidAmount) || 0,
        notes: purchaseNotes
      });
      setShowPurchaseModal(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSupplierPayment = async (e) => {
    e.preventDefault();
    if (!payTargetSupplier || !payAmount) return;

    try {
      await api.recordSupplierPayment({
        supplier_id: payTargetSupplier.supplier_id,
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        notes: 'Paid against outstanding supplier credit'
      });
      setShowPayModal(false);
      setPayTargetSupplier(null);
      setPayAmount('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await api.addSupplier(newSupplier);
      setShowSupplierModal(false);
      setNewSupplier({ company_name: '', contact_person: '', phone: '', total_due: 0 });
      loadData();
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
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <Truck className="w-5 h-5 text-sky-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Supplier Procurement & Stock Inward
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Receive incoming supplier stock directly into FEFO inventory batches and track payable balances (SRS 3.2 & 5.2).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Purchase Stock Inward</span>
          </button>
          <button
            onClick={() => setShowSupplierModal(true)}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700"
          >
            + Add Supplier
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'purchases' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Purchase Invoices ({purchases.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'suppliers' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Suppliers Directory & Payables ({suppliers.length})</span>
          </button>
        </div>
      </div>

      {/* Purchases View */}
      {activeTab === 'purchases' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Received By</th>
                  <th className="py-3 px-4 text-right">Total Invoiced</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Payable Due</th>
                  <th className="py-3 px-4 text-center">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                      No purchase invoices recorded yet. Click "+ New Purchase Stock Inward" above.
                    </td>
                  </tr>
                ) : (
                  purchases.map(p => {
                    const isExpanded = expandedPurchaseId === p.purchase_id;
                    return (
                      <React.Fragment key={p.purchase_id}>
                        <tr
                          onClick={() => setExpandedPurchaseId(isExpanded ? null : p.purchase_id)}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {p.invoice_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-200">{p.supplier_name}</div>
                            <div className="text-[10px] text-slate-500">{p.supplier_phone}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {p.purchase_date}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {p.received_by}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {currency}{p.total_amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">
                            {currency}{p.paid_amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            {currency}{p.due_amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono flex items-center gap-1 mx-auto">
                              <span>{p.items?.length || 0} batches</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Batches Received Table */}
                        {isExpanded && p.items && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={8} className="p-4 border-y border-slate-800">
                              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                Inward Batches Received on {p.invoice_number}:
                              </div>
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-500 text-[10px]">
                                    <th className="py-1">Medicine</th>
                                    <th className="py-1">Batch Number</th>
                                    <th className="py-1">Expiry Date</th>
                                    <th className="py-1 text-right">Received Pieces</th>
                                    <th className="py-1 text-right">Unit Cost / Pc</th>
                                    <th className="py-1 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {p.items.map((it, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1.5 font-bold text-white">{it.brand_name} ({it.strength})</td>
                                      <td className="py-1.5 font-mono text-emerald-400">{it.batch_number}</td>
                                      <td className="py-1.5 font-mono text-slate-400">{it.expiry_date}</td>
                                      <td className="py-1.5 text-right font-mono text-white">{it.quantity_pieces} pcs</td>
                                      <td className="py-1.5 text-right font-mono text-slate-300">{currency}{it.unit_cost.toFixed(2)}</td>
                                      <td className="py-1.5 text-right font-mono font-bold text-white">{currency}{it.subtotal.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Suppliers View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div key={s.supplier_id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-3">
              <div>
                <div className="font-bold text-base text-white">{s.company_name}</div>
                <div className="text-xs text-slate-400 mt-1">Contact: {s.contact_person || 'N/A'} • {s.phone || 'No phone'}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Payable Due Balance</div>
                  <div className="text-xl font-extrabold font-mono text-rose-400 mt-0.5">
                    {currency}{s.total_due.toFixed(2)}
                  </div>
                </div>
                {s.total_due > 0 && (
                  <button
                    onClick={() => {
                      setPayTargetSupplier(s);
                      setPayAmount(String(s.total_due));
                      setShowPayModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow transition-all active:scale-95"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay Due</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW PURCHASE STOCK INWARD MODAL */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Receive Stock Inward & Create Batches</h3>
              <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePurchase} className="flex-1 flex flex-col overflow-hidden space-y-4 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-850 rounded-2xl border border-slate-800">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Supplier *</label>
                  <select
                    required
                    value={purchaseSupplierId}
                    onChange={(e) => setPurchaseSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>{s.company_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Supplier Invoice # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SINV-88210"
                    value={purchaseInvNumber}
                    onChange={(e) => setPurchaseInvNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Immediate Paid Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasePaidAmount}
                    onChange={(e) => setPurchasePaidAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Medicine Batches Being Received:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItemRow}
                    className="flex items-center gap-1 text-emerald-400 font-semibold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Medicine Row</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {purchaseItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 grid grid-cols-1 sm:grid-cols-7 gap-2.5 items-end">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Medicine *</label>
                        <select
                          required
                          value={item.medicine_id}
                          onChange={(e) => updatePurchaseItem(idx, 'medicine_id', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="">-- Choose Medicine --</option>
                          {medicines.map(m => (
                            <option key={m.medicine_id} value={m.medicine_id}>{m.brand_name} ({m.strength})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Batch # *</label>
                        <input
                          type="text"
                          required
                          placeholder="B-2027A"
                          value={item.batch_number}
                          onChange={(e) => updatePurchaseItem(idx, 'batch_number', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Expiry Date *</label>
                        <input
                          type="date"
                          required
                          value={item.expiry_date}
                          onChange={(e) => updatePurchaseItem(idx, 'expiry_date', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Unit & Qty *</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity_received}
                            onChange={(e) => updatePurchaseItem(idx, 'quantity_received', e.target.value)}
                            className="w-14 px-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center"
                          />
                          <select
                            value={item.unit_type}
                            onChange={(e) => updatePurchaseItem(idx, 'unit_type', e.target.value)}
                            className="w-20 px-1 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px]"
                          >
                            <option value="BOX">Box</option>
                            <option value="STRIP">Strip</option>
                            <option value="PIECE">Piece</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Cost/Pc *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="2.10"
                          value={item.unit_cost_piece}
                          onChange={(e) => updatePurchaseItem(idx, 'unit_cost_piece', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex-1">
                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Sell/Pc *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="3.00"
                            value={item.selling_price_piece}
                            onChange={(e) => updatePurchaseItem(idx, 'selling_price_piece', e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                          />
                        </div>
                        {purchaseItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseItemRow(idx)}
                            className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 mb-0.5"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Due Summary */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-6 font-mono text-xs">
                  <div>Total Inward: <strong className="text-white text-sm">{currency}{calculatePurchaseGrandTotal().toFixed(2)}</strong></div>
                  <div>Paid Now: <strong className="text-emerald-400 text-sm">{currency}{(parseFloat(purchasePaidAmount) || 0).toFixed(2)}</strong></div>
                  <div>Payable Due Added: <strong className="text-rose-400 text-sm">{currency}{Math.max(0, calculatePurchaseGrandTotal() - (parseFloat(purchasePaidAmount) || 0)).toFixed(2)}</strong></div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow"
                  >
                    Confirm & Update Batches
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {showPayModal && payTargetSupplier && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Record Supplier Payment Voucher</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
              <div className="font-bold text-white text-sm">{payTargetSupplier.company_name}</div>
              <div className="text-rose-400 font-bold">Outstanding Payable Due: {currency}{payTargetSupplier.total_due.toFixed(2)}</div>
            </div>

            <form onSubmit={handleSupplierPayment} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Payment Amount ({currency}) *</label>
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
                <label className="block font-semibold text-slate-300 mb-1">Payment Channel</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="CASH">Cash Voucher</option>
                  <option value="BANK_CHEQUE">Bank Transfer / Cheque</option>
                  <option value="BKASH">bKash Merchant</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add Pharmaceutical Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company / Distributor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Square Pharma Distribution Hub"
                  value={newSupplier.company_name}
                  onChange={(e) => setNewSupplier(p => ({ ...p, company_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Mahbub Alam"
                  value={newSupplier.contact_person}
                  onChange={(e) => setNewSupplier(p => ({ ...p, contact_person: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="+880 1711-223344"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
