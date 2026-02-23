import { supabase } from '../lib/supabase';

/** Generates a random 8-char alphanumeric code and checks DB uniqueness. */
export async function generateUniqueCode(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let unique = false;

  while (!unique) {
    code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const { data } = await supabase.from('classes').select('id').eq('code', code).maybeSingle();
    if (!data) unique = true;
  }

  return code;
}