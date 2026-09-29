/**
 * Centralized Authentication Context & Provider.
 * Integrates Supabase Auth (GoTrue) for session lifecycle and JWT issuance,
 * while communicating with the FastAPI backend (/api/v1/auth/me) as the authoritative
 * system of record for user profiles, roles, and learning data.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type {
  UserProfile,
  LoginCredentials,
  RegisterPayload,
  AuthContextType,
} from "./types"
import { config, getApiUrl } from "@/core/config"
import { supabase } from "@/core/supabase"

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const isSupabaseConfigured = Boolean(
  config.supabaseAnonKey &&
  !config.supabaseAnonKey.includes("placeholder") &&
  config.supabaseAnonKey.trim().length > 20
)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    } catch {
      return null
    }
  })

  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && Boolean(localStorage.getItem("auth_token"))
    } catch {
      return false
    }
  })

  // Validate existing token and load authoritative user profile from backend
  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const response = await fetch(getApiUrl("/auth/me"), {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        return userData
      } else if (response.status === 401) {
        // Token is invalid or expired
        try {
          localStorage.removeItem("auth_token")
        } catch {
          // Ignore
        }
        setToken(null)
        setUser(null)
      }
    } catch (err) {
      console.error("[Auth] Failed to validate user session with backend:", err)
    }
    return null
  }, [])

  // Initial load & Supabase Auth state listener
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              try {
                localStorage.setItem("auth_token", session.access_token)
              } catch {
                // Ignore
              }
              if (mounted) {
                setToken(session.access_token)
                await fetchCurrentUser(session.access_token)
              }
              return
            }
          } catch (supaErr) {
            console.debug("[Auth] Supabase getSession error:", supaErr)
          }
        }

        // Check for cached local token
        if (token && mounted) {
          await fetchCurrentUser(token)
        }
      } catch (err) {
        console.error("[Auth] Failed to initialize session:", err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    let unsubscribeSupabase = () => {}

    if (isSupabaseConfigured) {
      try {
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!mounted) return

          if (currentSession?.access_token) {
            try {
              localStorage.setItem("auth_token", currentSession.access_token)
            } catch {
              // Ignore
            }
            setToken(currentSession.access_token)
            await fetchCurrentUser(currentSession.access_token)
          } else if (event === "SIGNED_OUT") {
            try {
              localStorage.removeItem("auth_token")
            } catch {
              // Ignore
            }
            setToken(null)
            setUser(null)
          }
        })
        unsubscribeSupabase = () => subscription.unsubscribe()
      } catch {
        // Ignore in environments without valid Supabase setup
      }
    }

    // Listen to storage sync across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        if (!e.newValue) {
          setToken(null)
          setUser(null)
        } else {
          setToken(e.newValue)
          fetchCurrentUser(e.newValue)
        }
      }
    }

    const handleAuthExpired = () => {
      setToken(null)
      setUser(null)
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("auth:expired", handleAuthExpired)

    return () => {
      mounted = false
      unsubscribeSupabase()
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("auth:expired", handleAuthExpired)
    }
  }, [fetchCurrentUser, token])

  // Login handler with Supabase Auth first, fallback to FastAPI
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true)
    const cleanEmail = credentials.email.trim().toLowerCase()

    try {
      // 1. Attempt Supabase Auth GoTrue sign in if configured
      if (isSupabaseConfigured) {
        try {
          const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: credentials.password,
          })

          if (!supaError) {
            if (supaData?.session) {
              const accessToken = supaData.session.access_token
              try {
                localStorage.setItem("auth_token", accessToken)
              } catch {
                // Ignore
              }
              setToken(accessToken)
              await fetchCurrentUser(accessToken)
            }
            return
          }
        } catch (supaErr) {
          console.debug("[Auth] Supabase sign-in fallback to backend API:", supaErr)
        }
      }

      // 2. Fallback to backend /api/v1/auth/login
      const response = await fetch(getApiUrl("/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: credentials.password,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.message ||
          (response.status === 401
            ? "Identifiants incorrects. Veuillez vérifier votre courriel et votre mot de passe."
            : `Erreur de connexion (${response.status})`)
        throw new Error(message)
      }

      const accessToken = data.access_token
      try {
        localStorage.setItem("auth_token", accessToken)
      } catch {
        // Ignore
      }

      setToken(accessToken)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  // Register handler with Supabase Auth first, fallback to FastAPI
  const register = async (payload: RegisterPayload) => {
    setIsLoading(true)
    const cleanEmail = payload.email.trim().toLowerCase()
    const timezone =
      payload.timezone ||
      (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      "UTC"

    try {
      // 1. Attempt Supabase Auth GoTrue registration if configured
      if (isSupabaseConfigured) {
        try {
          const { data: supaData, error: supaError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: payload.password,
            options: {
              data: {
                role: payload.role || "student",
                target_exam: payload.target_exam || "TEF Canada",
                target_level: payload.target_level || "B2",
                timezone,
                native_language: payload.native_language || null,
              },
            },
          })

          if (!supaError) {
            if (supaData?.session) {
              const accessToken = supaData.session.access_token
              try {
                localStorage.setItem("auth_token", accessToken)
              } catch {
                // Ignore
              }
              setToken(accessToken)
              await fetchCurrentUser(accessToken)
            } else if (supaData?.user) {
              console.info("[Auth] Supabase sign-up successful, email confirmation required")
              // Just return to avoid falling back
            }
            return
          }
        } catch (supaErr) {
          console.debug("[Auth] Supabase sign-up fallback to backend API:", supaErr)
        }
      }

      // 2. Fallback to backend /api/v1/auth/register
      const response = await fetch(getApiUrl("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: payload.password,
          role: payload.role || "student",
          target_exam: payload.target_exam || "TEF Canada",
          target_level: payload.target_level || "B2",
          timezone,
          native_language: payload.native_language || null,
          invitation_code: payload.invitation_code || null,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.message ||
          `Erreur lors de la création du compte (${response.status})`
        throw new Error(message)
      }

      const accessToken = data.access_token
      try {
        localStorage.setItem("auth_token", accessToken)
      } catch {
        // Ignore
      }

      setToken(accessToken)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  // Logout handler (clears Supabase GoTrue session and backend cookies)
  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => null)
      }

      if (token) {
        await fetch(getApiUrl("/auth/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }).catch(() => null)
      }
    } finally {
      try {
        localStorage.removeItem("auth_token")
      } catch {
        // Ignore
      }
      setToken(null)
      setUser(null)
      window.dispatchEvent(new Event("auth:expired"))
    }
  }

  // Manual refresh
  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser(token)
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: Boolean(token),
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      token: typeof window !== "undefined" ? localStorage.getItem("auth_token") : null,
      isAuthenticated:
        typeof window !== "undefined" && Boolean(localStorage.getItem("auth_token")),
      isLoading: false,
      login: async () => {},
      register: async () => {},
      logout: async () => {
        try {
          localStorage.removeItem("auth_token")
        } catch {
          // Ignore
        }
      },
      refreshUser: async () => {},
    }
  }
  return context
}
