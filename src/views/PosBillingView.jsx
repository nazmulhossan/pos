import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Clock,
  RotateCcw,
  Percent,
  CheckCircle2,
  AlertTriangle,
  User,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import SubstituteModal from '../components/SubstituteModal';
import HoldRecallModal from '../components/HoldRecallModal';
import CustomerModal from '../components/CustomerModal';
import PrescriptionModal from '../components/PrescriptionModal';
import ReceiptModal from '../components/ReceiptModal';

export default function PosBillingView() {
  const { user, settings } = useAuth();
  const searchInputRef = useRef(null);
  const discountInputRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  // Cart state
  // Array of { medicine, unit: 'PIECE'|'STRIP'|'BOX', quantity: number, unit_price: number, pieces_to_deduct: number, subtotal: number }
  const [cart, setCart] = useState([]);

  // Selected cart row index for hotkey actions like Tab (Unit Toggle) or F2 (Substitutes)
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);

  // Customer & Prescription
  const [customer, setCustomer] = useState(null);
  const [prescriptionUrl, setPrescriptionUrl] = useState(null);

  // Discount & Tax
  const [discountType, setDiscountType] = useState('PERCENT'); // 'PERCENT' or 'FLAT'
  const [discountValue, setDiscountValue] = useState(0);
  const [vatPercent] = useState(settings.vat_percent || 5);

  // Modals
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [substituteTargetMedicine, setSubstituteTargetMedicine] = useState(null);

  const [holdModalMode, setHoldModalMode] = useState(null); // 'hold' or 'recall'
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Checkout & Payment Modal
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH', 'CARD', 'BKASH', 'NAGAD', 'ROCKET', 'SPLIT', 'DUE'
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [splitPayments, setSplitPayments] = useState({ cash: 0, card: 0, mfs: 0, due: 0 });
  const [mfsDetails, setMfsDetails] = useState({ provider: 'bKash', mobile: '', trxId: '' });
  const [cardDetails, setCardDetails] = useState({ last4: '', authCode: '' });

  // Completed Receipt Modal
  const [completedInvoice, setCompletedInvoice] = useState(null);

  // Errors / Warnings
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const currency = settings.currency_symbol || '৳';

  // Instant Focus on search on load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard Shortcuts Handler (SRS 2.2)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if modal is open (except escape)
      if (e.key === 'Escape') {
        setShowSubstituteModal(false);
        setHoldModalMode(null);
        setShowCustomerModal(false);
        setShowPrescriptionModal(false);
        setShowCheckoutModal(false);
        setSearchResults([]);
        return;
      }

      // If user is inside an input modal, don't hijack
      if (showCheckoutModal || showCustomerModal || showSubstituteModal || holdModalMode) {
        return;
      }

      // F1 or Ctrl+F: Instant Search Focus
      if (e.key === 'F1' || (e.ctrlKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // Tab or Alt+U: Unit Toggle for active cart row
      if (e.key === 'Tab' || (e.altKey && e.key.toLowerCase() === 'u')) {
        if (cart.length > 0 && document.activeElement !== searchInputRef.current) {
          e.preventDefault();
          toggleCartRowUnit(selectedCartIndex);
        }
      }

      // F2: Substitute Finder for active cart row or selected search item
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0 && cart[selectedCartIndex]) {
          openSubstituteFinder(cart[selectedCartIndex].medicine);
        } else if (searchResults.length > 0 && searchResults[selectedResultIndex]) {
          openSubstituteFinder(searchResults[selectedResultIndex]);
        }
      }

      // F4: Hold Bill
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) setHoldModalMode('hold');
      }

      // F5: Recall Bill
      if (e.key === 'F5') {
        e.preventDefault();
        setHoldModalMode('recall');
      }

      // F8: Apply Discount
      if (e.key === 'F8') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
      }

      // F10 or Ctrl+P: Complete & Print
      if (e.key === 'F10' || (e.ctrlKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        if (cart.length > 0) {
          openCheckout();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCartIndex, searchResults, selectedResultIndex, showCheckoutModal, showCustomerModal, showSubstituteModal, holdModalMode]);

  // Real-time search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await api.searchMedicines(searchQuery.trim());
        setSearchResults(results);
        setSelectedResultIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 150); // Fast 150ms debounce for sub-second response

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate Cart Subtotals, Discounts, VAT & Net Payable
  const subtotal = +cart.reduce((acc, row) => acc + row.subtotal, 0).toFixed(2);

  let discountAmount = 0;
  const dVal = parseFloat(discountValue) || 0;
  if (dVal > 0) {
    if (discountType === 'PERCENT') {
      discountAmount = +((subtotal * dVal) / 100).toFixed(2);
    } else {
      discountAmount = Math.min(dVal, subtotal);
    }
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const vatAmount = +((taxableAmount * vatPercent) / 100).toFixed(2);
  const grandTotal = Math.round(taxableAmount + vatAmount);

  // Check if any cart medicine requires prescription
  const hasRxRequiredItem = cart.some(row => row.medicine.is_rx_required);

  // Add Item to Cart (Default: 1 Strip if available, else 1 Piece)
  const addToCart = (medicine, preferredUnit = null) => {
    setErrorMsg(null);
    setSearchQuery('');
    setSearchResults([]);

    if (medicine.available_pieces <= 0) {
      setErrorMsg(`Cannot add "${medicine.brand_name}" to cart: No active non-expired stock available.`);
      return;
    }

    // Determine default unit: Strip if available, otherwise Piece
    let unit = preferredUnit || (medicine.pieces_per_strip > 1 ? 'STRIP' : 'PIECE');
    let piecesNeeded = unit === 'STRIP' ? medicine.pieces_per_strip : (unit === 'BOX' ? medicine.pieces_per_strip * medicine.strips_per_box : 1);

    // If strip exceeds total available stock, default to Piece
    if (piecesNeeded > medicine.available_pieces) {
      unit = 'PIECE';
      piecesNeeded = 1;
    }

    const unitPrice = medicine.prices[unit];

    setCart(prevCart => {
      // Check if medicine with same unit already exists in cart
      const existingIdx = prevCart.findIndex(item => item.medicine.medicine_id === medicine.medicine_id && item.unit === unit);

      if (existingIdx !== -1) {
        const existing = prevCart[existingIdx];
        const newQty = existing.quantity + 1;
        const totalPieces = Math.round(newQty * getUnitMultiplier(medicine, unit));

        // Over-sell guard check
        if (totalPieces > medicine.available_pieces) {
          setErrorMsg(`Stock Guard: Adding another ${unit} would exceed available non-expired stock (${medicine.available_pieces} pieces) for ${medicine.brand_name}.`);
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          pieces_to_deduct: totalPieces,
          subtotal: +(newQty * unitPrice).toFixed(2)
        };
        setSelectedCartIndex(existingIdx);
        return updated;
      } else {
        // Add new item
        const newRow = {
          medicine,
          unit,
          quantity: 1,
          unit_price: unitPrice,
          pieces_to_deduct: piecesNeeded,
          subtotal: unitPrice
        };
        const updated = [...prevCart, newRow];
        setSelectedCartIndex(updated.length - 1);
        return updated;
      }
    });

    searchInputRef.current?.focus();
  };

  const getUnitMultiplier = (med, unit) => {
    if (unit === 'STRIP') return med.pieces_per_strip;
    if (unit === 'BOX') return med.pieces_per_strip * med.strips_per_box;
    return 1;
  };

  // Toggle Cart Row Unit (Piece -> Strip -> Box -> Piece)
  const toggleCartRowUnit = (index) => {
    if (!cart[index]) return;
    const row = cart[index];
    const med = row.medicine;
    let nextUnit = 'PIECE';

    if (row.unit === 'PIECE') {
      nextUnit = med.pieces_per_strip > 1 ? 'STRIP' : 'BOX';
    } else if (row.unit === 'STRIP') {
      nextUnit = med.strips_per_box > 1 ? 'BOX' : 'PIECE';
    } else {
      nextUnit = 'PIECE';
    }

    const newMultiplier = getUnitMultiplier(med, nextUnit);
    const totalPieces = Math.round(row.quantity * newMultiplier);

    if (totalPieces > med.available_pieces) {
      setErrorMsg(`Stock Guard: Switching to ${nextUnit} requires ${totalPieces} pieces, but only ${med.available_pieces} pieces are available in active stock.`);
      return;
    }

    const newUnitPrice = med.prices[nextUnit];
    const updated = [...cart];
    updated[index] = {
      ...row,
      unit: nextUnit,
      unit_price: newUnitPrice,
      pieces_to_deduct: totalPieces,
      subtotal: +(row.quantity * newUnitPrice).toFixed(2)
    };
    setCart(updated);
  };

  const updateCartQuantity = (index, deltaOrValue) => {
    if (!cart[index]) return;
    const row = cart[index];
    const med = row.medicine;
    let newQty = typeof deltaOrValue === 'number' && deltaOrValue < 10 && deltaOrValue > -10
      ? row.quantity + deltaOrValue
      : parseFloat(deltaOrValue);

    if (isNaN(newQty) || newQty <= 0) {
      // Remove row
      removeCartRow(index);
      return;
    }

    const multiplier = getUnitMultiplier(med, row.unit);
    const totalPieces = Math.round(newQty * multiplier);

    // Over-sell Guard
    if (totalPieces > med.available_pieces) {
      setErrorMsg(`Stock Guard: Quantity of ${newQty} ${row.unit} (${totalPieces} pieces) exceeds available stock of ${med.available_pieces} pieces.`);
      return;
    }

    setErrorMsg(null);
    const updated = [...cart];
    updated[index] = {
      ...row,
      quantity: newQty,
      pieces_to_deduct: totalPieces,
      subtotal: +(newQty * row.unit_price).toFixed(2)
    };
    setCart(updated);
  };

  const removeCartRow = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
    if (selectedCartIndex >= updated.length) {
      setSelectedCartIndex(Math.max(0, updated.length - 1));
    }
  };

  const openSubstituteFinder = (med) => {
    setSubstituteTargetMedicine(med);
    setShowSubstituteModal(true);
  };

  const openCheckout = () => {
    setErrorMsg(null);
    // Role discount validation
    const maxDiscountAllowed = settings.max_discount || 10;
    if (discountType === 'PERCENT' && dVal > maxDiscountAllowed) {
      setErrorMsg(`Your role (${user.role}) is limited to a maximum discount of ${maxDiscountAllowed}%. Current: ${dVal}%`);
      return;
    }

    setTenderedAmount(String(grandTotal));
    setSplitPayments({ cash: grandTotal, card: 0, mfs: 0, due: 0 });
    setShowCheckoutModal(true);
  };

  // Submit Final Sale
  const handleFinalCheckout = async () => {
    setErrorMsg(null);
    try {
      setSubmitting(true);

      // Validate due payment requirement
      let due = 0;
      let breakdown = {};

      if (paymentMethod === 'CASH') {
        const tendered = parseFloat(tenderedAmount) || grandTotal;
        const change = Math.max(0, tendered - grandTotal);
        due = Math.max(0, grandTotal - tendered);
        breakdown = { method: 'CASH', tendered, change };
      } else if (paymentMethod === 'DUE') {
        due = grandTotal;
        breakdown = { method: 'DUE' };
      } else if (paymentMethod === 'SPLIT') {
        due = Math.max(0, grandTotal - (splitPayments.cash + splitPayments.card + splitPayments.mfs));
        breakdown = {
          method: 'SPLIT',
          cash: splitPayments.cash,
          card: splitPayments.card,
          mfs: splitPayments.mfs,
          due
        };
      } else if (paymentMethod === 'CARD') {
        breakdown = { method: 'CARD', cardDetails };
      } else {
        // MFS (bKash / Nagad / Rocket)
        breakdown = { method: paymentMethod, mfsDetails };
      }

      if (due > 0 && !customer) {
        throw new Error('Customer selection/registration is strictly REQUIRED for credit/due sales.');
      }

      const payload = {
        items: cart.map(row => ({
          medicine_id: row.medicine.medicine_id,
          sold_unit_type: row.unit,
          qty_sold_in_unit: row.quantity
        })),
        customer_id: customer ? customer.customer_id : null,
        discount_type: discountType,
        discount_value: dVal,
        vat_percent_custom: vatPercent,
        payment_method: paymentMethod,
        payment_breakdown: breakdown,
        prescription_url: prescriptionUrl
      };

      const res = await api.checkout(payload);

      // Clear state and show receipt
      setCart([]);
      setCustomer(null);
      setPrescriptionUrl(null);
      setDiscountValue(0);
      setShowCheckoutModal(false);
      setCompletedInvoice(res.invoice);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto p-4 flex flex-col lg:flex-row gap-4 h-[calc(100vh-100px)]">
      {/* LEFT COLUMN: Fast Item Lookup & Cart Interface (65%) */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Top Search & Scanning Bar (SRS 2.1 #1 & 2.2 F1) */}
        <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-3 flex items-center gap-2 pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-emerald-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => Math.min(searchResults.length - 1, prev + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => Math.max(0, prev - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchResults[selectedResultIndex]) {
                    addToCart(searchResults[selectedResultIndex]);
                  }
                }
              }}
              placeholder="Scan Barcode or Search Brand / Generic Name (F1 or Ctrl+F)..."
              className="w-full pl-10 pr-24 py-2.5 bg-slate-800 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 font-medium transition-all"
            />
            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                F1
              </span>
              <Barcode className="w-5 h-5 text-slate-400" />
            </div>

            {/* Live Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-700/60 animate-in fade-in">
                {searchResults.map((med, idx) => (
                  <div
                    key={med.medicine_id}
                    onClick={() => addToCart(med)}
                    onMouseEnter={() => setSelectedResultIndex(idx)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                      idx === selectedResultIndex ? 'bg-slate-700/90 text-white' : 'hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{med.brand_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-900/60 text-slate-300 border border-slate-700">
                          {med.dosage_form} • {med.strength}
                        </span>
                        {med.is_rx_required === 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Rx Required
                          </span>
                        )}
                        {med.has_expired_stock && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Has Expired Batches (Blocked)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>Generic: <strong className="text-slate-300">{med.generic_name}</strong></span>
                        <span>•</span>
                        <span>{med.manufacturer_name}</span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1 font-mono flex items-center gap-4">
                        <span>Pcs: <strong>{currency}{med.prices?.PIECE?.toFixed(2)}</strong></span>
                        <span>Strip ({med.pieces_per_strip}): <strong>{currency}{med.prices?.STRIP?.toFixed(2)}</strong></span>
                        <span>Box: <strong>{currency}{med.prices?.BOX?.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        med.available_pieces > med.reorder_level
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : med.available_pieces > 0
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                      }`}>
                        {med.available_pieces > 0 ? `${med.available_pieces} Pcs Avail` : 'Out of Stock'}
                      </div>
                      {med.fe_fo_batch && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          FEFO: {med.fe_fo_batch.batch_number} (Exp: {med.fe_fo_batch.expiry_date})
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (cart[selectedCartIndex]) openSubstituteFinder(cart[selectedCartIndex].medicine);
                else setErrorMsg('Select an item in cart to find generic substitutes (F2).');
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-xs"
              title="Generic Substitute Finder (F2)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Substitutes (F2)</span>
            </button>

            <button
              onClick={() => setHoldModalMode(cart.length > 0 ? 'hold' : 'recall')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-xs"
              title="Hold (F4) or Recall (F5) Cart"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Hold/Recall (F4/F5)</span>
            </button>
          </div>
        </div>

        {/* Global Warnings / Error alerts */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/40 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {/* Prescription Required Alert Banner */}
        {hasRxRequiredItem && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-sky-500/20 text-sky-200 text-xs border border-sky-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
              <span>This sale contains scheduled/Rx-required medicines. Attach scanned prescription image before final checkout.</span>
            </div>
            <button
              onClick={() => setShowPrescriptionModal(true)}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all"
            >
              {prescriptionUrl ? '✓ Prescription Attached' : '+ Attach Prescription'}
            </button>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-3">
                <ShoppingCart className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">Active Cart is Empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Scan barcode or press <kbd className="px-1.5 py-0.5 bg-slate-800 text-emerald-400 rounded font-mono text-[11px]">F1</kbd> to search medicines by brand or generic name.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-700">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Medicine & Generic</th>
                    <th className="py-2.5 px-3">Batch (FEFO)</th>
                    <th className="py-2.5 px-3 text-center">Unit (Tab/Alt+U)</th>
                    <th className="py-2.5 px-3 text-center">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Line Subtotal</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {cart.map((row, idx) => {
                    const isSelected = idx === selectedCartIndex;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedCartIndex(idx)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-800/80 ring-1 ring-emerald-500/50' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {row.medicine.brand_name}
                            {row.medicine.is_rx_required === 1 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Rx</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {row.medicine.generic_name} • {row.medicine.strength}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {row.medicine.fe_fo_batch ? (
                            <div>
                              <div className="font-mono text-emerald-400 font-medium">
                                {row.medicine.fe_fo_batch.batch_number}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Exp: {row.medicine.fe_fo_batch.expiry_date}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">Auto-assign</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCartRowUnit(idx);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-700/80 hover:bg-emerald-600 text-white font-semibold text-[11px] border border-slate-600 transition-colors"
                            title="Click or press Tab/Alt+U to cycle Piece/Strip/Box"
                          >
                            {row.unit} ▾
                          </button>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            ({row.pieces_to_deduct} base pcs)
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCartQuantity(idx, -1);
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => updateCartQuantity(idx, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 text-center bg-transparent text-white font-bold focus:outline-hidden text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCartQuantity(idx, 1);
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-300 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {currency}{row.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                          {currency}{row.subtotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCartRow(idx);
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Cart Action Helpers */}
        <div className="p-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Items: <strong className="text-white">{cart.length}</strong></span>
            <span>Total Base Pieces: <strong className="text-white">{cart.reduce((a, c) => a + c.pieces_to_deduct, 0)} pcs</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors disabled:opacity-40"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Customer, Discount, Taxes & Checkout Summary (35%) */}
      <div className="w-full lg:w-[420px] flex flex-col gap-4">
        {/* Customer & Prescription Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              Customer Profile
            </span>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {customer ? 'Change Customer' : '+ Select / Add'}
            </button>
          </div>

          {customer ? (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-white">{customer.name}</div>
                <div className="text-xs text-slate-400">{customer.phone}</div>
                {customer.total_due > 0 && (
                  <div className="text-xs font-bold text-rose-400 mt-1">
                    Outstanding Credit Due: {currency}{customer.total_due.toFixed(2)}
                  </div>
                )}
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="text-xs text-slate-400 hover:text-rose-400 p-1"
                title="Remove customer (revert to Walk-in)"
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              onClick={() => setShowCustomerModal(true)}
              className="p-3 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 hover:border-emerald-500/50 cursor-pointer text-xs text-slate-400 flex items-center justify-between"
            >
              <span>Walk-in Customer (No Ledger)</span>
              <span className="text-emerald-400 text-xs font-semibold">Select ▾</span>
            </div>
          )}

          {/* Prescription Pill */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              Prescription:
            </span>
            <button
              onClick={() => setShowPrescriptionModal(true)}
              className={`font-semibold transition-colors ${
                prescriptionUrl ? 'text-emerald-400 hover:underline' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {prescriptionUrl ? '✓ 1 Image Attached' : 'Attach Scan (Optional)'}
            </button>
          </div>
        </div>

        {/* Calculation & Checkout Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Order Payment Summary
            </h3>

            {/* Subtotal */}
            <div className="flex justify-between items-center py-2 text-sm text-slate-300 border-b border-slate-800">
              <span>Cart Subtotal</span>
              <span className="font-mono font-bold text-white text-base">{currency}{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount Section (SRS 2.1 #6 & 2.2 F8) */}
            <div className="py-2.5 border-b border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  Discount (F8):
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-800 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      discountType === 'PERCENT' ? 'bg-amber-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('FLAT')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      discountType === 'FLAT' ? 'bg-amber-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {currency}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  step="0.5"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={`Max ${settings.max_discount}% for ${user?.role}`}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-mono"
                />
                <span className="font-mono text-xs text-amber-400 font-bold">
                  -{currency}{discountAmount.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                Logged in as <strong>{user?.role}</strong> (Max limit: {settings.max_discount}%)
              </div>
            </div>

            {/* VAT (5%) */}
            <div className="flex justify-between items-center py-2 text-xs text-slate-300 border-b border-slate-800">
              <span>VAT / Tax ({vatPercent}%)</span>
              <span className="font-mono text-slate-300">+{currency}{vatAmount.toFixed(2)}</span>
            </div>

            {/* Net Grand Total Rounded */}
            <div className="p-4 my-2 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-850 border border-emerald-500/40 shadow-inner">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Net Payable</span>
                <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                  {currency}{grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-emerald-500/80 mt-1 flex justify-between">
                <span>Includes {vatPercent}% VAT</span>
                <span>Auto-rounded (SRS 2.1 #6)</span>
              </div>
            </div>
          </div>

          {/* Checkout & Quick Pay Action */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={openCheckout}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-emerald-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Complete Sale & Print Receipt</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-xs font-mono">F10</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            <div className="text-center text-[11px] text-slate-500">
              Press <kbd className="text-slate-400 font-mono">F10</kbd> or <kbd className="text-slate-400 font-mono">Ctrl+P</kbd> from anywhere to checkout
            </div>
          </div>
        </div>
      </div>

      {/* CHECKOUT & PAYMENT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Payment & Checkout</h3>
                <p className="text-xs text-slate-400">Total Due: <strong className="text-emerald-400 font-mono text-sm">{currency}{grandTotal.toFixed(2)}</strong></p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30">
                {errorMsg}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'CARD', label: 'Card', icon: CreditCard },
                { id: 'BKASH', label: 'bKash', icon: Smartphone },
                { id: 'NAGAD', label: 'Nagad', icon: Smartphone },
                { id: 'ROCKET', label: 'Rocket', icon: Smartphone },
                { id: 'SPLIT', label: 'Split Pay', icon: Layers },
                { id: 'DUE', label: 'Full Due', icon: User }
              ].map(m => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Payment Details per Method */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cash Tendered from Customer:
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-lg font-bold font-mono text-white focus:outline-hidden focus:border-emerald-500"
                      autoFocus
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">{currency}</span>
                  </div>
                </div>

                {/* Quick Cash Presets */}
                <div className="flex gap-2">
                  {[grandTotal, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100, 500, 1000].filter(v => v >= grandTotal).slice(0, 4).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTenderedAmount(String(preset))}
                      className="flex-1 py-1 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-300 text-xs font-mono font-semibold"
                    >
                      {currency}{preset}
                    </button>
                  ))}
                </div>

                {/* Change Calculation (SRS 2.1 #7) */}
                <div className="pt-2 flex justify-between items-center text-sm font-semibold border-t border-slate-700">
                  <span className="text-slate-300">Change Due to Customer:</span>
                  <span className={`font-mono text-lg font-bold ${
                    parseFloat(tenderedAmount) >= grandTotal ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {currency}{Math.max(0, (parseFloat(tenderedAmount) || 0) - grandTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {['BKASH', 'NAGAD', 'ROCKET'].includes(paymentMethod) && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Customer Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 017XXXXXXXX"
                    value={mfsDetails.mobile}
                    onChange={(e) => setMfsDetails(p => ({ ...p, mobile: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">MFS Transaction ID (TrxID)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9J28A17X"
                    value={mfsDetails.trxId}
                    onChange={(e) => setMfsDetails(p => ({ ...p, trxId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono uppercase"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'CARD' && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Card Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="4412"
                    value={cardDetails.last4}
                    onChange={(e) => setCardDetails(p => ({ ...p, last4: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Approval Code / Reference</label>
                  <input
                    type="text"
                    placeholder="APPR-8812"
                    value={cardDetails.authCode}
                    onChange={(e) => setCardDetails(p => ({ ...p, authCode: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'SPLIT' && (
              <div className="space-y-2 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs">
                <div className="flex justify-between items-center">
                  <span>Cash:</span>
                  <input
                    type="number"
                    value={splitPayments.cash}
                    onChange={(e) => setSplitPayments(p => ({ ...p, cash: parseFloat(e.target.value) || 0 }))}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-mono"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Card:</span>
                  <input
                    type="number"
                    value={splitPayments.card}
                    onChange={(e) => setSplitPayments(p => ({ ...p, card: parseFloat(e.target.value) || 0 }))}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-mono"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>MFS:</span>
                  <input
                    type="number"
                    value={splitPayments.mfs}
                    onChange={(e) => setSplitPayments(p => ({ ...p, mfs: parseFloat(e.target.value) || 0 }))}
                    className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right font-mono"
                  />
                </div>
                <div className="flex justify-between items-center text-rose-400 font-bold pt-1 border-t border-slate-700">
                  <span>Remaining Customer Due:</span>
                  <span className="font-mono">
                    {currency}{Math.max(0, grandTotal - (splitPayments.cash + splitPayments.card + splitPayments.mfs)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'DUE' && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
                <div className="font-bold text-rose-300">Credit / Due Sale:</div>
                <div className="text-slate-300">
                  Entire amount ({currency}{grandTotal.toFixed(2)}) will be recorded as receivable debt in the customer's credit ledger.
                </div>
                {!customer && (
                  <div className="text-rose-400 font-bold mt-2">
                    ⚠️ You must attach a registered customer profile to complete a due sale.
                  </div>
                )}
              </div>
            )}

            {/* Confirm Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handleFinalCheckout}
                disabled={submitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Committing Sale...' : 'Confirm Sale & Print Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showSubstituteModal && (
        <SubstituteModal
          medicine={substituteTargetMedicine}
          onClose={() => setShowSubstituteModal(false)}
          onSelectSubstitute={(sub) => {
            setShowSubstituteModal(false);
            addToCart(sub);
          }}
        />
      )}

      {holdModalMode && (
        <HoldRecallModal
          mode={holdModalMode}
          cart={cart}
          customer={customer}
          discount={{ value: discountValue, type: discountType }}
          onClose={(cartHeld) => {
            if (cartHeld) {
              setCart([]);
              setCustomer(null);
            }
            setHoldModalMode(null);
          }}
          onRestoreCart={(bill) => {
            setCart(bill.cart_data || []);
            if (bill.customer_id) {
              setCustomer({ customer_id: bill.customer_id, name: bill.customer_name, phone: bill.customer_phone });
            }
            setDiscountValue(bill.discount_val || 0);
            setDiscountType(bill.discount_type || 'PERCENT');
          }}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelectCustomer={(c) => setCustomer(c)}
        />
      )}

      {showPrescriptionModal && (
        <PrescriptionModal
          currentUrl={prescriptionUrl}
          onClose={() => setShowPrescriptionModal(false)}
          onAttachPrescription={(url) => setPrescriptionUrl(url)}
        />
      )}

      {completedInvoice && (
        <ReceiptModal
          invoice={completedInvoice}
          onClose={() => setCompletedInvoice(null)}
        />
      )}
    </div>
  );
}
