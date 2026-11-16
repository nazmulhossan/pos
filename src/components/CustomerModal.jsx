import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Search, Check, X } from 'lucide-react';

export default function CustomerModal({ onClose, onSelectCustomer, initialPhone = '' }) {
  const { settings } = useAuth();
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'create'
  const [searchTerm, setSearchTerm] = useState(initialPhone);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New customer form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState('');

  const currency = settings.currency_symbol || '৳';

  useEffect(() => {
    handleSearch(searchTerm);
  }, []);

  const handleSearch = async (q) => {
    try {
      setLoading(true);
      const res = await api.getCustomers(q);
      setCustomers(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim()
      });
      onSelectCustomer({
        customer_id: res.customer_id,
        name: res.name,
        phone: res.phone,
        total_due: res.total_due || 0
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Select or Register Customer</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2 my-3 p-1 bg-slate-800/80 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'search' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Search Directory
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            + Quick Add Customer
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30">
            {error}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' ? (
          <div className="flex-1 flex flex-col overflow-hidden space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by customer name or mobile number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleSearch(e.target.value);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No customers found. Switch to "+ Quick Add Customer" to register.
                </div>
              ) : (
                customers.map(c => (
                  <div
                    key={c.customer_id}
                    onClick={() => {
                      onSelectCustomer(c);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{c.name}</span>
                        {c.total_due > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Due: {currency}{c.total_due.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{c.phone} • {c.address || 'No address'}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Select</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Create Customer Tab */
          <form onSubmit={handleCreateCustomer} className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mohammad Abdullah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Phone (Unique) *</label>
              <input
                type="text"
                required
                placeholder="e.g. 01712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Address / Landmark (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. House 12, Road 4, Sector 7, Uttara"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all"
              >
                {loading ? 'Saving...' : 'Register & Select'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
