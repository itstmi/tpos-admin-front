import { Loader2, X } from 'lucide-react';

// Popup in the ISP panel's Add Customer style: small labels, compact fields, two columns
export const fieldClass = 'w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm bg-white text-slate-800';

export const ModalField = ({ label, bad, hint, className = '', children }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
    {children}
    {bad && hint && <p className="text-[11px] text-red-500 mt-1">{hint}</p>}
  </div>
);

const Modal = ({ title, onClose, onSubmit, busy, submitText, children }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[94vh] flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <X size={20} className="text-slate-500" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="p-4 space-y-3 overflow-y-auto">
        {children}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-emerald-500/20 transition-all text-sm"
          >
            {busy && <Loader2 size={18} className="animate-spin" />}
            {submitText}
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default Modal;
