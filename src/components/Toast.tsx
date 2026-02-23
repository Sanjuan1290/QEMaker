import React, { createContext, useContext, useCallback, useState } from 'react';
import { ToastItem, ToastType } from '../types';

interface ToastCtx {
  showToast: (msg: string, type?: ToastType) => void;
}
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[999] flex flex-col gap-2.5">
        {toasts.map((t) => {
          const ok = t.type === 'success';
          return (
            <div
              key={t.id}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto flex max-w-[340px] cursor-pointer items-center gap-3 animate-toast-in rounded-2xl border p-3.5 backdrop-blur-xl
                ${ok
                  ? 'border-emerald-500/30 bg-[#1a1a1a]/95 [border-left:3px_solid_#10b981]'
                  : 'border-rose-500/30 bg-[#1a1a1a]/95 [border-left:3px_solid_#f43f5e]'
                }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold
                  ${ok ? 'bg-emerald-500/15 text-[#10b981]' : 'bg-rose-500/15 text-[#f43f5e]'}`}
              >
                {ok ? '✓' : '✕'}
              </div>
              <span className="flex-1 text-sm font-medium leading-snug text-[#fdf8f0]">
                {t.message}
              </span>
              <button className="text-lg leading-none text-[#b3b3b3] hover:text-[#d1d1d1]">×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}