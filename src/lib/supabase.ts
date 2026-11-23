import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured: boolean =
  Boolean(rawUrl) &&
  Boolean(rawAnonKey) &&
  isValidHttpUrl(rawUrl) &&
  !rawUrl.includes('YOUR_PROJECT_REF') &&
  !rawAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const STORAGE_BUCKETS = {
  FILES: 'trellas-files',
  AVATARS: 'trellas-avatars',
} as const;
