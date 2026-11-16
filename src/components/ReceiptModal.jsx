import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, CheckCircle, X, Download, RefreshCw, FileText } from 'lucide-react';

export default function ReceiptModal({ invoice, onClose }) {
  const { settings } = useAuth();
  const [paperFormat, setPaperFormat] = useState(settings?.default_receipt_type || '80mm');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const currency = settings?.currency_symbol || '৳';
  const pharmacyName = settings?.pharmacy_name || 'MediCare Central';
  const address = settings?.address || 'Dhaka, Bangladesh';
  const phone = settings?.phone || '+880 1711-000000';
  const vatRate = settings?.vat_percent || '5';

  // Safe Date parsing
  const rawDate = invoice.sale_date || invoice.created_at;
  const parsedDate = rawDate ? new Date(rawDate) : new Date();
  const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const formattedDate = validDate.toLocaleDateString();
  const formattedTime = validDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Safe Number formatting
  const subtotal = Number(invoice.subtotal ?? invoice.subtotal_amount ?? 0);
  const discountAmount = Number(invoice.discount_amount ?? 0);
  const vatAmount = Number(invoice.vat_amount ?? 0);
  const grandTotal = Number(invoice.grand_total ?? 0);
  const paidAmount = Number(invoice.paid_amount ?? 0);
  const dueAmount = Number(invoice.due_amount ?? 0);
  const change = Number(invoice.payment_breakdown?.change ?? 0);
  const customerDue = Number(invoice.customer?.total_due ?? invoice.customer?.current_due_balance ?? 0);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[95vh] text-slate-100">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Sale Completed Successfully</h3>
              <p className="text-xs text-slate-400">Invoice ready for printing or download</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Format Selector */}
        <div className="flex items-center justify-between py-3">
          <span className="text-xs text-slate-400 font-medium">Receipt Paper Format:</span>
          <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl border border-slate-700">
            <button
              onClick={() => setPaperFormat('80mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                paperFormat === '80mm' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Thermal 80mm
            </button>
            <button
              onClick={() => setPaperFormat('58mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                paperFormat === '58mm' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Thermal 58mm
            </button>
            <button
              onClick={() => setPaperFormat('a4')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                paperFormat === 'a4' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              A4 Invoice
            </button>
          </div>
        </div>

        {/* Printable Receipt Preview Container */}
        <div className="flex-1 overflow-y-auto my-2 p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 flex justify-center">
          <div
            id="printable-receipt"
            className={`bg-white text-black p-5 shadow-lg font-mono text-xs rounded-lg ${
              paperFormat === '58mm' ? 'w-[240px] text-[10px] p-3' : paperFormat === '80mm' ? 'w-[320px] text-[11px] p-4' : 'w-full max-w-[600px] text-xs p-6'
            }`}
          >
            {/* Pharmacy Branding */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400 mb-3">
              <h2 className="text-sm font-bold tracking-tight uppercase text-gray-900">{pharmacyName}</h2>
              <p className="text-[10px] text-gray-600 mt-0.5">{address}</p>
              <p className="text-[10px] text-gray-600">Hotline: {phone}</p>
              <p className="text-[10px] font-bold text-gray-800 mt-1">*** CASH RECEIPT ***</p>
            </div>

            {/* Invoice Meta */}
            <div className="space-y-0.5 text-[10px] border-b border-dashed border-gray-400 pb-2 mb-2 text-gray-800">
              <div className="flex justify-between">
                <span>Invoice: <strong className="text-black font-mono">{invoice.invoice_number}</strong></span>
                <span>Date: {formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {invoice.cashier_name || 'Admin Cashier'}</span>
                <span>Time: {formattedTime}</span>
              </div>
              {invoice.customer && (
                <div className="pt-1 text-[10px] border-t border-dotted border-gray-300 mt-1">
                  <div>Customer: <strong>{invoice.customer.name}</strong></div>
                  <div>Phone: {invoice.customer.phone}</div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-left border-collapse mb-2">
              <thead>
                <tr className="border-b border-gray-400 text-[10px] text-gray-700">
                  <th className="py-1">Item [Batch]</th>
                  <th className="py-1 text-center">Unit</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((it, idx) => (
                  <tr key={idx} className="text-[10px]">
                    <td className="py-1 pr-1">
                      <div className="font-semibold text-gray-900 leading-tight">{it.brand_name || 'Medicine'}</div>
                      <div className="text-[9px] text-gray-500 font-mono">
                        B:{it.batch_number || 'DEFAULT'} ({it.total_pieces_deducted || it.qty_sold_in_unit || 1} pcs)
                      </div>
                    </td>
                    <td className="py-1 text-center capitalize text-gray-700">{(it.sold_unit_type || 'piece').toLowerCase()}</td>
                    <td className="py-1 text-right font-mono text-gray-800">{it.qty_sold_in_unit || 1}</td>
                    <td className="py-1 text-right font-medium text-gray-900">{currency}{Number(it.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px] text-gray-800">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">{currency}{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discount:</span>
                  <span className="font-mono">-{currency}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>VAT ({vatRate}%):</span>
                  <span className="font-mono">+{currency}{vatAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-300 text-black">
                <span>NET PAYABLE:</span>
                <span className="font-mono">{currency}{grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Paid ({invoice.payment_method || 'CASH'}):</span>
                <span className="font-mono font-semibold">{currency}{paidAmount.toFixed(2)}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-emerald-800">
                  <span>Change Return:</span>
                  <span className="font-mono">{currency}{change.toFixed(2)}</span>
                </div>
              )}
              {dueAmount > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-red-700">
                  <span>Due Added:</span>
                  <span className="font-mono">{currency}{dueAmount.toFixed(2)}</span>
                </div>
              )}
              {customerDue > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-red-800 border-t border-dotted border-gray-400 pt-1">
                  <span>Total Customer Due:</span>
                  <span className="font-mono">{currency}{customerDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-4 border-t border-dashed border-gray-400 mt-3 text-gray-700">
              <div className="font-mono text-center text-sm font-bold my-1 tracking-widest border-y border-black py-0.5 text-black">
                |||||| | |||| ||| ||||||| | |||
              </div>
              <div className="text-[9px] font-mono font-semibold text-gray-800">{invoice.invoice_number}</div>
              <p className="text-[9px] text-gray-500 mt-2">Thank you for visiting {pharmacyName}!</p>
              <p className="text-[8px] text-gray-400">Medicines sold with valid prescription cannot be returned after 7 days.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Sale (Esc)</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
