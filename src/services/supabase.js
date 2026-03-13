import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Anon Key is missing. Ensure .env.local is configured.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

/**
 * Generates a random 4-character access code for the game.
 */
export function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // only letters, avoiding I and O for clarity
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
