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

export const useAuthStore = create<AuthState>((set) => ({
  admin:     null,
  loading:   true,
  authError: '',

  // Call once at app start — returns the unsubscribe fn for cleanup
  initAuth: () => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const admin = sessionToAdmin(session);
      // Check authorization on restore
      if (admin && !isAuthorizedEmail(admin.email)) {
        supabase.auth.signOut();
        set({ admin: null, loading: false, authError: 'Your email is not authorized.' });
      } else {
        set({ admin, loading: false });
      }
    });

    // Subscribe to auth state changes
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