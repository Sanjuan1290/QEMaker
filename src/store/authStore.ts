import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { isAuthorizedEmail } from '../utils/auth';
import type { Admin } from '../types';

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => () => void;  // returns unsubscribe fn
}

function sessionToAdmin(session: any): Admin | null {
  const user = session?.user;
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id:      user.id,
    email:   user.email,
    name:    meta.full_name || meta.name || user.email.split('@')[0],
    picture: meta.avatar_url || meta.picture,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  admin:     null,
  loading:   true,
  authError: '',

  // Call once at app start — returns the unsubscribe fn for cleanup
  initAuth: () => {
    // 1. HANDLE URL HASH FIRST (OAuth callback)
    const url = new URL(window.location.href);
    const hash = url.hash.substring(1); // Remove #
    
    if (hash) {
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      
      if (access_token && refresh_token) {
        set({ loading: true });
        
        supabase.auth.setSession({
          access_token,
          refresh_token,
        }).then(({ data: { session }, error }) => {
          if (error) {
            console.error('Session exchange failed:', error);
            set({ loading: false, authError: 'Login failed. Please try again.' });
          } else {
            const admin = sessionToAdmin(session);
            if (admin && !isAuthorizedEmail(admin.email)) {
              supabase.auth.signOut();
              set({ admin: null, loading: false, authError: 'Your email is not authorized.' });
            } else {
              set({ admin, loading: false, authError: '' });
            }
          }
          // Clean URL (remove #access_token...)
          window.history.replaceState({}, document.title, url.pathname);
        });
        return () => {}; // Early return - no subscription needed
      }
    }

    // 2. NORMAL SESSION CHECK (existing logic)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const admin = sessionToAdmin(session);
      if (admin && !isAuthorizedEmail(admin.email)) {
        supabase.auth.signOut();
        set({ admin: null, loading: false, authError: 'Your email is not authorized.' });
      } else {
        set({ admin, loading: false });
      }
    });

    // 3. Subscribe to auth state changes (existing logic)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const admin = sessionToAdmin(session);
      if (admin && !isAuthorizedEmail(admin.email)) {
        supabase.auth.signOut();
        set({ admin: null, authError: 'Your email is not authorized to access the admin panel.' });
        return;
      }
      set({ admin, authError: '' });
    });

    return () => subscription.unsubscribe();
  },

  signInWithGoogle: async () => {
    set({ authError: '' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) set({ authError: error.message });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ admin: null });
  },
}));
