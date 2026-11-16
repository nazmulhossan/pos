import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pos_token') || null);
  const [settings, setSettings] = useState({
    pharmacy_name: 'MediCare Central Pharmacy',
    pharmacy_tagline: 'Your Trusted Health & Wellness Partner',
    address: 'House #42, Road #11, Banani, Dhaka',
    phone: '+880 1711-000000',
    vat_percent: 5,
    currency_symbol: '৳',
    max_discount: 10,
    default_receipt_type: '80mm'
  });
  const [alertsCount, setAlertsCount] = useState({ low_stock: 0, expiring: 0 });
  const [loading, setLoading] = useState(true);

  // Load session
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem('pos_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          if (res.settings) setSettings(res.settings);
        } catch (err) {
          console.warn('Session expired or invalid, logging in as demo admin');
          // Auto login as admin for instant seamless experience
          await loginAsDemo('admin');
        }
      } else {
        // Auto-login as default demo Admin for instant access
        await loginAsDemo('admin');
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  // Poll alerts count every 60 seconds
  useEffect(() => {
    if (!token) return;
    async function loadAlerts() {
      try {
        const res = await api.getAlerts();
        const expiringTotal = (res.counts.expiring_30_count || 0) + (res.counts.expired_count || 0);
        setAlertsCount({
          low_stock: res.counts.low_stock_count || 0,
          expiring: expiringTotal
        });
      } catch (err) {
        // quiet fail on polling
      }
    }
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('pos_token', res.token);
    setToken(res.token);
    setUser(res.user);
    if (res.settings) setSettings(res.settings);
    return res;
  };

  const loginAsDemo = async (roleType) => {
    const credentials = {
      admin: { u: 'admin', p: 'admin123' },
      pharmacist: { u: 'pharmacist', p: 'pharm123' },
      manager: { u: 'manager', p: 'mgr123' }
    };
    const cred = credentials[roleType] || credentials.admin;
    return await login(cred.u, cred.p);
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    setToken(null);
    setUser(null);
  };

  const refreshSettings = async () => {
    try {
      const s = await api.getSettings();
      setSettings(prev => ({
        ...prev,
        ...s,
        vat_percent: parseFloat(s.vat_percent || '5')
      }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      settings,
      alertsCount,
      loading,
      login,
      loginAsDemo,
      logout,
      refreshSettings
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
