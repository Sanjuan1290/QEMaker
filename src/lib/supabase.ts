import { createClient } from '@supabase/supabase-js';

// Vite exposes env vars via import.meta.env (not process.env)
// Variables must be prefixed with VITE_ in your .env file
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  console.error(
    '⚠️  Supabase credentials missing!\n' +
    '  1. Copy .env.example → .env\n' +
    '  2. Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    '  3. Restart the dev server (npm run dev)'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnon || 'placeholder-anon-key',
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
    },
  }
);