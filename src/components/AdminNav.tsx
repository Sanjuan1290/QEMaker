import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AdminNav() {
  const { admin, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate('/admin/login');
  };

  const isDashboard = location.pathname === '/admin';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#0a0908]/80 backdrop-blur-xl">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f59e0b]/25 to-transparent" />
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-4 px-6">

        {/* Brand */}
        <button onClick={() => navigate('/admin')} className="group flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#f59e0b] to-[#fbb92c] shadow-[0_4px_12px_rgba(245,158,11,0.35)] transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(245,158,11,0.5)]">
            <span className="font-serif text-[0.9rem] font-bold text-[#0a0908]">Q</span>
          </div>
          <span className="hidden font-serif text-[1.2rem] text-[#fdf8f0] sm:block">
            QE
            <span className="bg-gradient-to-r from-[#f59e0b] to-amber-400 bg-clip-text text-transparent">
              Maker
            </span>
          </span>
        </button>

        {/* Breadcrumb / active path hint */}
        {!isDashboard && (
          <div className="hidden items-center gap-1.5 text-xs text-[#b3b3b3] md:flex">
            <span>/</span>
            <span className="text-[#8c8c8c]">
              {location.pathname.includes('/class/')
                ? 'Class'
                : location.pathname.includes('/quiz/')
                ? 'Quiz'
                : ''}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* User + Sign Out */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2.5 rounded-xl border border-white/7 bg-white/4 px-3 py-1.5 sm:flex">
            {admin?.picture ? (
              <img
                src={admin.picture}
                alt=""
                className="h-6 w-6 rounded-full ring-[1.5px] ring-[#f59e0b]/30"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#fbb92c] text-[0.7rem] font-bold text-[#0a0908]">
                {admin?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="max-w-[120px] truncate text-xs font-medium text-[#d1d1d1]">
              {admin?.name}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-white/14 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#d1d1d1] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 hover:border-[#f59e0b]/40 hover:bg-white/4 hover:text-[#fdf8f0]"
          >
            {signingOut ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-[#f59e0b]" />
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            )}
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}