/**
 * Supabase Client Initialization for the TEF Platform Web Frontend.
 * Configured with token auto-refresh, local persistence, and safe fallbacks.
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "./config"

// Fallback dummy JWT payload if anon key is not yet set in environment
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.placeholder"

const supabaseAnonKey = config.supabaseAnonKey?.trim() || FALLBACK_ANON_KEY

export const supabase = createClient(config.supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "tef_supabase_auth",
  },
})
