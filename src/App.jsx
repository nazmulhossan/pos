import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PosBillingView from './views/PosBillingView';
import SalesReturnsView from './views/SalesReturnsView';
import InventoryBatchesView from './views/InventoryBatchesView';
import MedicineCatalogView from './views/MedicineCatalogView';
import ProcurementView from './views/ProcurementView';
import CustomersView from './views/CustomersView';
import ReportsView from './views/ReportsView';
import SettingsUsersView from './views/SettingsUsersView';
import { Pill } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('pos');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center animate-bounce mb-3 shadow-lg shadow-emerald-900/50">
          <Pill className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm font-bold text-slate-200">Initializing Pharmacy System...</div>
        <div className="text-xs text-slate-500 mt-1">Loading FEFO batch inventory engine</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1">
        {activeTab === 'pos' && <PosBillingView />}
        {activeTab === 'returns' && <SalesReturnsView />}
        {activeTab === 'inventory' && <InventoryBatchesView />}
        {activeTab === 'medicines' && <MedicineCatalogView />}
        {activeTab === 'purchases' && <ProcurementView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'settings' && <SettingsUsersView />}
      </main>
    </div>
  );
}
