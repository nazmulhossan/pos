import React, { useState } from 'react';
import { api } from '../services/api';
import { FileText, Upload, Image as ImageIcon, X, Check } from 'lucide-react';

export default function PrescriptionModal({ currentUrl, onClose, onAttachPrescription }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file && !previewUrl) {
      onAttachPrescription(null);
      onClose();
      return;
    }

    if (file) {
      try {
        setUploading(true);
        const res = await api.uploadPrescription(file);
        onAttachPrescription(res.url);
        onClose();
      } catch (err) {
        setError(err.message);
        setUploading(false);
      }
    } else {
      onAttachPrescription(previewUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Attach Doctor Prescription</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs border border-rose-500/30">
            {error}
          </div>
        )}

        <div className="py-4 space-y-4">
          <p className="text-xs text-slate-300">
            Upload or snap a scanned image of the doctor's prescription for scheduled & Rx-required drugs. This will be stored with the invoice audit log.
          </p>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center transition-all bg-slate-800/40 relative">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="w-8 h-8 text-emerald-400" />
              <div className="text-xs font-semibold text-white">Click or drag & drop prescription image</div>
              <div className="text-[11px] text-slate-400">PNG, JPG, JPEG, WEBP or PDF (max 10MB)</div>
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-52 bg-slate-950 flex items-center justify-center p-2">
              <img src={previewUrl} alt="Prescription preview" className="max-h-48 object-contain rounded-lg" />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{uploading ? 'Attaching...' : 'Attach to Invoice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
