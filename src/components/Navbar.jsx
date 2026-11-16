import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Pill,
  ShoppingCart,
  RotateCcw,
  Boxes,
  Database,
  Truck,
  Users,
  BarChart3,
  Settings,
  Bell,
  Keyboard,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, settings, alertsCount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const roleColors = {
    ADMIN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    PHARMACIST: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    INVENTORY_MANAGER: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  };

  const navItems = [
    { id: 'pos', label: 'POS Billing', icon: ShoppingCart, hotkey: 'F10', allowed: ['ADMIN', 'PHARMACIST'] },
    { id: 'returns', label: 'Returns & Refunds', icon: RotateCcw, hotkey: '', allowed: ['ADMIN', 'PHARMACIST'] },
    { id: 'inventory', label: 'Inventory & FEFO', icon: Boxes, badge: alertsCount.expiring + alertsCount.low_stock, allowed: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'] },
    { id: 'medicines', label: 'Medicine Catalog', icon: Database, allowed: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'] },
    { id: 'purchases', label: 'Procurement', icon: Truck, allowed: ['ADMIN', 'INVENTORY_MANAGER'] },
    { id: 'customers', label: 'Customer Ledgers', icon: Users, allowed: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'] },
    { id: 'reports', label: 'Reports & P/L', icon: BarChart3, allowed: ['ADMIN', 'PHARMACIST'] },
    { id: 'settings', label: 'Users & Settings', icon: Settings, allowed: ['ADMIN'] }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 select-none shadow-lg">
      {/* Top Banner */}
      <div className="max-w-[1700px] mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                {settings.pharmacy_name || 'MediCare POS'}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v1.0 Pro
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">{settings.pharmacy_tagline || 'Pharmacy Billing & Inventory Management'}</p>
          </div>
        </div>

        {/* Global Shortcuts Reference Pill */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 transition-colors"
          title="Click to view keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4 text-emerald-400" />
          <span className="font-medium">Hotkeys:</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700">F1 Search</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700">Tab Unit</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700">F2 Sub</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700">F4/F5 Hold</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700">F10 Pay</span>
        </button>

        {/* Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60 flex items-center justify-center cursor-pointer shadow-xs"
            title={theme === 'dark' ? 'Switch to Default Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Alerts Bell */}
          <button
            onClick={() => setActiveTab('inventory')}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/60 cursor-pointer"
            title="View Inventory & Expiry Alerts"
          >
            <Bell className="w-4 h-4" />
            {(alertsCount.expiring > 0 || alertsCount.low_stock > 0) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-slate-900 animate-pulse">
                {alertsCount.expiring + alertsCount.low_stock}
              </span>
            )}
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/80 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-xs text-white uppercase">
                {user ? user.username.slice(0, 2) : 'US'}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
                  {user ? user.full_name.split(' ')[0] : 'User'}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${user ? roleColors[user.role] : ''}`}>
                    {user?.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Account & Profile ▾</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-700/60 mb-1.5">
                  <p className="text-xs font-semibold text-slate-200">{user?.full_name || 'Staff'}</p>
                  <p className="text-[11px] text-slate-400 font-mono">@{user?.username} • {user?.role}</p>
                </div>

                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowRoleMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <span>Users & Settings</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setActiveTab('pos');
                    setShowRoleMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <ShoppingCart className="w-4 h-4 text-sky-400" />
                  <span>POS Terminal</span>
                </button>

                {/* Log Out */}
                <div className="pt-1.5 mt-1.5 border-t border-slate-700/60">
                  <button
                    onClick={() => {
                      logout();
                      setShowRoleMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="max-w-[1700px] mx-auto px-4 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/80 pt-1">
        {navItems.map(item => {
          const isAllowed = user && item.allowed.includes(user.role);
          if (!isAllowed) return null;

          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all relative ${
                isActive
                  ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.hotkey && (
                <span className="hidden xl:inline text-[10px] font-mono px-1 py-0.2 rounded bg-slate-900/60 border border-slate-700 text-slate-400">
                  {item.hotkey}
                </span>
              )}
              {item.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Shortcuts Modal Popover */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">SRS Keyboard Shortcuts Reference</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Instant Search & Barcode Focus</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">F1 or Ctrl+F</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Toggle Unit (Piece → Strip → Box)</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">Tab or Alt+U</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Generic Substitute Finder Modal</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">F2</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Hold Active Cart / Recall Suspended Cart</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">F4 / F5</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Focus Discount Field (within role limit)</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">F8</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Complete Sale & Print Thermal Receipt</span>
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-emerald-400 font-bold">F10 or Ctrl+P</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-300">Automatic Stock Over-Sell Guard</span>
                <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-medium">Automatic</span>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-5 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors"
            >
              Got it (Esc)
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
