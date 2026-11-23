import { LocalApiError, localRequest } from './localWorkspaceService';
import { isSupabaseConfigured } from './supabase';
import { SupabaseApiError, supabaseRequest } from './supabaseService';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  if (url.startsWith('/api/') && !url.startsWith('/api/supabase/')) {
    try {
      if (isSupabaseConfigured) {
        return await supabaseRequest<T>(url, options);
      }
      return await localRequest<T>(url, options);
    } catch (err) {
      if (err instanceof SupabaseApiError || err instanceof LocalApiError) {
        throw new ApiError(err.message, err.status);
      }
      throw new ApiError(err instanceof Error ? err.message : 'Request failed', 400);
    }
  }

  throw new ApiError(`Unsupported API endpoint (${url}).`, 404);
}

