import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Database, Plus, Search, Building2, FlaskConical, Edit2, Trash2 } from 'lucide-react';

export default function MedicineCatalogView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('medicines'); // 'medicines', 'generics', 'manufacturers'
  const [medicines, setMedicines] = useState([]);
  const [generics, setGenerics] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [medForm, setMedForm] = useState({
    brand_name: '',
    generic_id: '',
    manufacturer_id: '',
    dosage_form: 'Tablet',
    strength: '',
    barcode: '',
    pieces_per_strip: 10,
    strips_per_box: 10,
    reorder_level: 50,
    is_rx_required: false
  });

  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({ generic_name: '', description: '' });

  const [showMfrModal, setShowMfrModal] = useState(false);
  const [mfrForm, setMfrForm] = useState({ name: '', contact_info: '' });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'INVENTORY_MANAGER';

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [mList, gList, mfList] = await Promise.all([
        api.getMedicines(),
        api.getGenerics(),
        api.getManufacturers()
      ]);
      setMedicines(mList);
      setGenerics(gList);
      setManufacturers(mfList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    try {
      if (editingMed) {
        await api.updateMedicine(editingMed.medicine_id, medForm);
      } else {
        await api.addMedicine(medForm);
      }
      setShowMedModal(false);
      setEditingMed(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveGeneric = async (e) => {
    e.preventDefault();
    try {
      await api.addGeneric(genForm);
      setShowGenModal(false);
      setGenForm({ generic_name: '', description: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveMfr = async (e) => {
    e.preventDefault();
    try {
      await api.addManufacturer(mfrForm);
      setShowMfrModal(false);
      setMfrForm({ name: '', contact_info: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditMed = (m) => {
    setEditingMed(m);
    setMedForm({
      brand_name: m.brand_name,
      generic_id: m.generic_id,
      manufacturer_id: m.manufacturer_id,
      dosage_form: m.dosage_form,
      strength: m.strength,
      barcode: m.barcode || '',
      pieces_per_strip: m.pieces_per_strip,
      strips_per_box: m.strips_per_box,
      reorder_level: m.reorder_level,
      is_rx_required: !!m.is_rx_required
    });
    setShowMedModal(true);
  };

  const filteredMedicines = medicines.filter(m =>
    m.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.manufacturer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.barcode && m.barcode.includes(searchQuery))
  );

  return (
    <div className="max-w-[1700px] mx-auto p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
              <Database className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Master Medicine Catalog & Unit Ratios
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Store unit conversion ratios (pieces per strip, strips per box), generic compositions, and reorder levels (SRS 5.1).
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingMed(null);
                setMedForm({
                  brand_name: '',
                  generic_id: generics[0]?.generic_id || '',
                  manufacturer_id: manufacturers[0]?.manufacturer_id || '',
                  dosage_form: 'Tablet',
                  strength: '',
                  barcode: '',
                  pieces_per_strip: 10,
                  strips_per_box: 10,
                  reorder_level: 50,
                  is_rx_required: false
                });
                setShowMedModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Medicine SKU</span>
            </button>
            <button
              onClick={() => setShowGenModal(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700"
            >
              + Generic
            </button>
            <button
              onClick={() => setShowMfrModal(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700"
            >
              + Manufacturer
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('medicines')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'medicines' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Medicines ({medicines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('generics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'generics' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            <span>Generics ({generics.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('manufacturers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'manufacturers' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Manufacturers ({manufacturers.length})</span>
          </button>
        </div>

        {activeTab === 'medicines' && (
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search brand, generic, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'medicines' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <th className="py-3 px-4">Brand Name</th>
                  <th className="py-3 px-4">Generic Composition</th>
                  <th className="py-3 px-4">Manufacturer</th>
                  <th className="py-3 px-4">Form & Strength</th>
                  <th className="py-3 px-4">Barcode</th>
                  <th className="py-3 px-4 text-center">Unit Conversion Ratios</th>
                  <th className="py-3 px-4 text-center">Reorder Lvl</th>
                  <th className="py-3 px-4 text-center">Total Stock</th>
                  {canEdit && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredMedicines.map(m => (
                  <tr key={m.medicine_id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        {m.brand_name}
                        {m.is_rx_required === 1 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Rx
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {m.generic_name}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {m.manufacturer_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">
                        {m.dosage_form} • {m.strength}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {m.barcode || '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      <div className="text-[11px]">
                        1 Strip = <strong className="text-white">{m.pieces_per_strip} pcs</strong>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        1 Box = {m.strips_per_box} strips ({m.pieces_per_strip * m.strips_per_box} pcs)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {m.reorder_level} pcs
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {m.total_stock_pieces} pcs
                    </td>
                    {canEdit && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openEditMed(m)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Edit Medicine"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'generics' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {generics.map(g => (
              <div key={g.generic_id} className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="font-bold text-sm text-white">{g.generic_name}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">{g.description || 'No description provided.'}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {manufacturers.map(mf => (
              <div key={mf.manufacturer_id} className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="font-bold text-sm text-white">{mf.name}</div>
                <div className="text-xs text-slate-400 mt-1">{mf.contact_info || 'No contact details'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEW / EDIT MEDICINE MODAL */}
      {showMedModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingMed ? `Edit Medicine SKU: ${editingMed.brand_name}` : 'Add New Medicine to Catalog'}
              </h3>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveMedicine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Napa Extra"
                    value={medForm.brand_name}
                    onChange={(e) => setMedForm(p => ({ ...p, brand_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Dosage Form *</label>
                  <select
                    value={medForm.dosage_form}
                    onChange={(e) => setMedForm(p => ({ ...p, dosage_form: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Injection">Injection</option>
                    <option value="Eye Drop">Eye Drop</option>
                    <option value="Ointment">Ointment / Gel</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Generic Composition *</label>
                  <select
                    required
                    value={medForm.generic_id}
                    onChange={(e) => setMedForm(p => ({ ...p, generic_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">-- Choose Generic --</option>
                    {generics.map(g => (
                      <option key={g.generic_id} value={g.generic_id}>{g.generic_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Manufacturer *</label>
                  <select
                    required
                    value={medForm.manufacturer_id}
                    onChange={(e) => setMedForm(p => ({ ...p, manufacturer_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="">-- Choose Manufacturer --</option>
                    {manufacturers.map(mf => (
                      <option key={mf.manufacturer_id} value={mf.manufacturer_id}>{mf.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Strength *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500mg or 20mg"
                    value={medForm.strength}
                    onChange={(e) => setMedForm(p => ({ ...p, strength: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Barcode (EAN-13/SKU)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901234001"
                    value={medForm.barcode}
                    onChange={(e) => setMedForm(p => ({ ...p, barcode: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Unit Conversion Ratios (SRS 5.1 Key Architectural Rule) */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <div className="font-bold text-emerald-400">Unit Conversion Ratios (Base Unit = Pieces):</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Pieces / Strip *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={medForm.pieces_per_strip}
                      onChange={(e) => setMedForm(p => ({ ...p, pieces_per_strip: parseInt(e.target.value, 10) || 1 }))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Strips / Box *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={medForm.strips_per_box}
                      onChange={(e) => setMedForm(p => ({ ...p, strips_per_box: parseInt(e.target.value, 10) || 1 }))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Reorder Level (Pcs) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={medForm.reorder_level}
                      onChange={(e) => setMedForm(p => ({ ...p, reorder_level: parseInt(e.target.value, 10) || 0 }))}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Total pieces in 1 Box: <strong>{medForm.pieces_per_strip * medForm.strips_per_box} pieces</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rx_check"
                  checked={medForm.is_rx_required}
                  onChange={(e) => setMedForm(p => ({ ...p, is_rx_required: e.target.checked }))}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-600"
                />
                <label htmlFor="rx_check" className="font-semibold text-rose-300 cursor-pointer">
                  Prescription Strictly Required (Antibiotics, Schedule-H, Narcotic)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow"
                >
                  {editingMed ? 'Update Medicine' : 'Save to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK GENERIC MODAL */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Generic Chemical Composition</h3>
              <button onClick={() => setShowGenModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveGeneric} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Generic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol + Caffeine"
                  value={genForm.generic_name}
                  onChange={(e) => setGenForm(p => ({ ...p, generic_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description / Therapeutic Class</label>
                <textarea
                  rows={2}
                  placeholder="Analgesic and antipyretic..."
                  value={genForm.description}
                  onChange={(e) => setGenForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowGenModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Save Generic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MANUFACTURER MODAL */}
      {showMfrModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Pharmaceutical Manufacturer</h3>
              <button onClick={() => setShowMfrModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSaveMfr} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beximco Pharmaceuticals Ltd."
                  value={mfrForm.name}
                  onChange={(e) => setMfrForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contact Information / HQ</label>
                <textarea
                  rows={2}
                  placeholder="Address, Phone, Email..."
                  value={mfrForm.contact_info}
                  onChange={(e) => setMfrForm(p => ({ ...p, contact_info: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowMfrModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Save Manufacturer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
