import React from 'react';

interface Props {
  message: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message,
  detail,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-black/75 backdrop-blur-[10px] animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#1a1918]/98 p-7 shadow-[0_24px_64px_rgba(0,0,0,0.7)] animate-slide-up"
      >
        <div
          className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl border ${
            danger
              ? 'border-rose-400/25 bg-rose-400/12'
              : 'border-yellow-500/20 bg-yellow-500/10'
          }`}
        >
          {danger ? '⚠️' : '💬'}
        </div>

        <h3 className="mb-1.5 font-serif text-[1.2rem] text-[#fdf8f0]">{message}</h3>
        {detail && (
          <p className="mb-6 text-sm leading-relaxed text-[#b3b3b3]">{detail}</p>
        )}
        {!detail && <div className="mb-6" />}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-transparent bg-transparent px-3 py-1.5 text-xs font-semibold text-[#d1d1d1] transition-all duration-200 hover:bg-white/4 hover:text-[#fdf8f0] active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.97] ${
              danger
                ? 'bg-rose-400/10 text-rose-200 border border-rose-300 hover:bg-rose-400/18 hover:border-rose-400/45'
                : 'bg-gradient-to-br from-yellow-500 to-yellow-400 text-[#0a0908] shadow-[0_2px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-px hover:from-yellow-400 hover:to-yellow-500 hover:shadow-[0_4px_16px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}