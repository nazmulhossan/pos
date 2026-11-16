import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Users, ShieldCheck, Key, Plus, Save, CheckCircle } from 'lucide-react';

export default function SettingsUsersView() {
  const { user, refreshSettings } = useAuth();
  const [activeTab, setActiveTab] = useState('settings'); // 'settings', 'users'

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    pharmacy_name: '',
    pharmacy_tagline: '',
    address: '',
    phone: '',
    email: '',
    vat_percent: '5',
    currency_symbol: '৳',
    max_discount_pharmacist: '10',
    max_discount_inventory_manager: '20',
    max_discount_admin: '100',
    default_receipt_type: '80mm'
  });

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', username: '', password: '', role: 'PHARMACIST' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadSettingsAndUsers();
  }, []);

  const loadSettingsAndUsers = async () => {
    try {
      setLoading(true);
      const [sRes, uRes] = await Promise.all([
        api.getSettings(),
        api.getUsers()
      ]);
      setSettingsForm(prev => ({ ...prev, ...sRes }));
      setUsersList(uRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      await api.updateSettings(settingsForm);
      await refreshSettings();
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.addUser(newUser);
      setShowAddUserModal(false);
      setNewUser({ full_name: '', username: '', password: '', role: 'PHARMACIST' });
      loadSettingsAndUsers();
      setSuccessMsg('User created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleUserActive = async (u) => {
    try {
      await api.updateUser(u.user_id, {
        is_active: !u.is_active
      });
      loadSettingsAndUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto p-4 space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Pharmacy System Settings & User RBAC Control
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure tax rates, maximum cashier discount limits, thermal print format, and user operator credentials (SRS 3.1).
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setShowAddUserModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create System User</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'settings' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pharmacy & Tax Configuration</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users & Role Permissions ({usersList.length})</span>
        </button>
      </div>

      {/* SETTINGS FORM */}
      {activeTab === 'settings' ? (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 text-xs max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Store Information (Printed on Invoices & Thermal Receipts)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Pharmacy Trade Name *</label>
                <input
                  type="text"
                  required
                  value={settingsForm.pharmacy_name}
                  onChange={(e) => setSettingsForm(p => ({ ...p, pharmacy_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tagline</label>
                <input
                  type="text"
                  value={settingsForm.pharmacy_tagline}
                  onChange={(e) => setSettingsForm(p => ({ ...p, pharmacy_tagline: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Physical Address *</label>
                <input
                  type="text"
                  required
                  value={settingsForm.address}
                  onChange={(e) => setSettingsForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Tax, Currency & Discount Threshold Control (SRS 3.1)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Applicable VAT / Tax (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={settingsForm.vat_percent}
                  onChange={(e) => setSettingsForm(p => ({ ...p, vat_percent: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400">Default rate applied at checkout</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Currency Symbol *</label>
                <input
                  type="text"
                  required
                  value={settingsForm.currency_symbol}
                  onChange={(e) => setSettingsForm(p => ({ ...p, currency_symbol: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Default Receipt Format</label>
                <select
                  value={settingsForm.default_receipt_type}
                  onChange={(e) => setSettingsForm(p => ({ ...p, default_receipt_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold"
                >
                  <option value="80mm">Thermal 80mm (Standard POS)</option>
                  <option value="58mm">Thermal 58mm (Compact)</option>
                  <option value="a4">Standard A4 Invoice</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 p-3 bg-slate-850 rounded-xl border border-slate-800">
              <div>
                <label className="block font-semibold text-sky-300 mb-1">Pharmacist Max Discount Limit (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settingsForm.max_discount_pharmacist}
                  onChange={(e) => setSettingsForm(p => ({ ...p, max_discount_pharmacist: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
                <span className="text-[10px] text-slate-400">Enforced strictly in POS billing (SRS 2.2 F8)</span>
              </div>
              <div>
                <label className="block font-semibold text-amber-300 mb-1">Inventory Manager Max Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settingsForm.max_discount_inventory_manager}
                  onChange={(e) => setSettingsForm(p => ({ ...p, max_discount_inventory_manager: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-emerald-300 mb-1">Admin / Owner Max Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settingsForm.max_discount_admin}
                  onChange={(e) => setSettingsForm(p => ({ ...p, max_discount_admin: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      ) : (
        /* USERS LIST TABLE */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                <th className="py-3 px-4">Operator Full Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role & Scope</th>
                <th className="py-3 px-4">Permissions Overview</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Toggle State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {usersList.map(u => (
                <tr key={u.user_id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white text-sm">{u.full_name}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{u.username}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                      u.role === 'ADMIN' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      u.role === 'PHARMACIST' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
                      'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {u.role === 'ADMIN' && 'Full Access: P&L financial reports, user management, tax configuration'}
                    {u.role === 'PHARMACIST' && 'POS Billing, customer registration, prescription uploads, sales returns. Purchase costs hidden.'}
                    {u.role === 'INVENTORY_MANAGER' && 'Catalog management, supplier purchases, batch adjustments, damage write-offs.'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleToggleUserActive(u)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create System Operator (RBAC)</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Mahmudul Hasan"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Username (Login ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mahmud"
                  value={newUser.username}
                  onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Role & Privilege Level *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="ADMIN">ADMIN (Full Access, P&L, Users, Settings)</option>
                  <option value="PHARMACIST">PHARMACIST (POS Billing, Returns, Prescriptions)</option>
                  <option value="INVENTORY_MANAGER">INVENTORY_MANAGER (Stock, Batches, Purchases, Write-offs)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddUserModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
