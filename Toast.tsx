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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        let borderClass = 'border-l-4 border-l-red-600';
        let bgClass = 'bg-white';
        let icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;

        if (t.type === 'error') {
          borderClass = 'border-l-4 border-l-red-600';
          icon = <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />;
        } else if (t.type === 'warning') {
          borderClass = 'border-l-4 border-l-amber-500';
          icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
        } else if (t.type === 'info') {
          borderClass = 'border-l-4 border-l-blue-600';
          icon = <Info className="w-5 h-5 text-blue-500 shrink-0" />;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border border-slate-200 ${borderClass} ${bgClass} flex items-start gap-3 transition-all animate-in slide-in-from-top-2 duration-200`}
          >
            {icon}
            <div className="flex-1 text-xs font-bold text-slate-800 leading-snug">
              {t.message}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 -mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
