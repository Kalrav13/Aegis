import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-dismiss toast after 4 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  }, [dismissToast]);

  const getToastClasses = (type: ToastType) => {
    switch (type) {
      case 'SUCCESS':
        return {
          bg: 'bg-slate-900/95 border-emerald-500/30 text-slate-200',
          icon: CheckCircle,
          iconColor: 'text-emerald-400'
        };
      case 'WARNING':
        return {
          bg: 'bg-slate-900/95 border-amber-500/30 text-slate-200',
          icon: AlertTriangle,
          iconColor: 'text-amber-400'
        };
      case 'ERROR':
        return {
          bg: 'bg-slate-900/95 border-rose-500/30 text-slate-200',
          icon: XCircle,
          iconColor: 'text-rose-400'
        };
      default:
        return {
          bg: 'bg-slate-900/95 border-indigo-500/30 text-slate-200',
          icon: Info,
          iconColor: 'text-indigo-400'
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast notification portal container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full">
        {toasts.map((toast) => {
          const config = getToastClasses(toast.type);
          const IconComp = config.icon;
          return (
            <div
              key={toast.id}
              className={`flex items-start space-x-3 p-4 rounded-xl border backdrop-blur-md shadow-glass-hover animate-slide-in transition-all duration-350 ${config.bg}`}
            >
              <IconComp className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
              <div className="flex-1 text-sm font-medium text-slate-300 leading-snug">
                {toast.message}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
