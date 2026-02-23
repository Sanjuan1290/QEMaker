import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { admin, loading, authError, signInWithGoogle } = useAuthStore();

  useEffect(() => {
    if (!loading && admin) navigate('/admin', { replace: true });
  }, [admin, loading, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">

      {/* ── Left brand panel ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-14 lg:flex">
        {/* Background orbs */}
        <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.1)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-[5%] bottom-[10%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.06)_0%,transparent_70%)]" />
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,240,210,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,240,210,1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-gradient-to-br from-gold to-gold-dim shadow-gold-glow">
            <span className="font-display text-xl font-bold text-night">Q</span>
          </div>
          <div>
            <div className="font-display text-2xl leading-none text-text-primary">
              QE<span className="text-gold-gradient">Maker</span>
            </div>
            <div className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-text-faint">Quiz & Exam Maker</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative animate-fade-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/22 bg-gold/10 px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse-gold" />
            Built for educators
          </div>
          <h1 className="mb-5 font-display text-5xl leading-[1.05] tracking-tight text-text-primary xl:text-6xl">
            Generate<br />
            <em className="text-gold-gradient not-italic">quizzes</em><br />
            in seconds.
          </h1>
          <p className="mb-10 max-w-xs text-[0.9375rem] leading-relaxed text-text-muted">
            Paste your multiple-choice questions and QEMaker instantly structures them into a shareable exam — no manual entry required.
          </p>
          {[
            { icon: '⚡', label: 'Auto-parse 50+ questions at once' },
            { icon: '🔗', label: 'One-click shareable student links' },
            { icon: '📊', label: 'Real-time results & answer review' },
          ].map(f => (
            <div key={f.label} className="mb-3.5 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/16 bg-gold/8 text-base">
                {f.icon}
              </div>
              <span className="text-sm text-text-dim">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="relative font-mono text-[0.6875rem] text-text-faint">© {new Date().getFullYear()} QEMaker</div>
      </div>

      {/* ── Right sign-in ── */}
      <div className="flex items-center justify-center border-l border-white/[0.05] bg-night-800/60 p-8">
        <div className="w-full max-w-[390px] animate-fade-up">

          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold-dim shadow-gold-glow">
              <span className="font-display font-bold text-night">Q</span>
            </div>
            <span className="font-display text-xl text-text-primary">QE<span className="text-gold-gradient">Maker</span></span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-text-dim">Admin Access</div>
            <h2 className="font-display text-4xl text-text-primary mb-2">Welcome back</h2>
            <p className="text-sm leading-relaxed text-text-muted">Sign in with your authorized Google account to manage quizzes.</p>
          </div>

          {/* Auth domains */}
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="mb-3 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-text-faint">Authorized accounts</div>
            {[
              { domain: '@pcu.edu.ph', note: 'All accounts' },
              { domain: '@gmail.com',  note: 'Whitelisted only' },
            ].map(d => (
              <div key={d.domain} className="mb-2 flex items-center gap-2.5 last:mb-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald/20 bg-emerald/10 text-[0.65rem] text-emerald-light">✓</div>
                <span className="font-mono text-xs text-text-secondary">{d.domain}</span>
                <span className="ml-auto text-[0.75rem] text-text-dim">{d.note}</span>
              </div>
            ))}
          </div>

          {/* Google Sign In */}
          <button
            onClick={signInWithGoogle}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-[13px] border border-white/[0.12]
                       bg-white/[0.05] px-5 py-3.5 text-[0.9375rem] font-semibold text-text-primary
                       backdrop-blur-md transition-all duration-200
                       hover:-translate-y-px hover:border-gold/35 hover:bg-white/[0.08] hover:shadow-[0_6px_24px_rgba(0,0,0,0.4)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {authError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose/22 bg-rose/8 px-4 py-3 text-sm text-rose-light animate-fade-in">
              <span className="mt-0.5 shrink-0">⚠</span>
              <p className="leading-relaxed">{authError}</p>
            </div>
          )}

          {!import.meta.env.VITE_SUPABASE_URL && (
            <div className="hint-box">
              <strong className="text-gold">Setup required:</strong> Copy{' '}
              <code className="rounded bg-gold/8 px-1.5 py-0.5 font-mono text-[0.6875rem] text-gold-light">.env.example</code>{' '}→{' '}
              <code className="rounded bg-gold/8 px-1.5 py-0.5 font-mono text-[0.6875rem] text-gold-light">.env</code>{' '}
              and fill in your Supabase credentials.
            </div>
          )}

          <div className="divider mt-6" />
          <p className="mt-4 text-center text-xs leading-relaxed text-text-faint">
            Students don't need an account — share the quiz link directly.
          </p>
        </div>
      </div>
    </div>
  );
}