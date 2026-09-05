import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[100] flex flex-col gap-2.5 w-[calc(100%-1.5rem)] sm:w-full sm:max-w-sm pointer-events-none">
      {toasts.map((t) => {
        let accent = 'bg-blue-600';
        let icon = <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />;
        let label = 'Berhasil';

        if (t.type === 'error') {
          accent = 'bg-red-500';
          icon = <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
          label = 'Terjadi Kesalahan';
        } else if (t.type === 'warning') {
          accent = 'bg-amber-400';
          icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
          label = 'Perhatian';
        } else if (t.type === 'info') {
          accent = 'bg-blue-600';
          icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;
          label = 'Informasi';
        }

        return (
          <div
            key={t.id}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 sm:p-4 shadow-[0_16px_40px_rgba(15,23,42,.16)] backdrop-blur-xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-200"
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
            <div className="mt-0.5 rounded-xl bg-slate-50 p-2">{icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400 mb-0.5">{label}</div>
              <div className="text-xs sm:text-[13px] font-bold text-slate-800 leading-relaxed break-words">{t.message}</div>
            </div>
            <button
              aria-label="Tutup pemberitahuan"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
