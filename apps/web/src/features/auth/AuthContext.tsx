/**
 * Centralized Authentication Context & Provider.
 * Handles token storage, session validation, user profiles, and session lifecycle.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import type {
  UserProfile,
  LoginCredentials,
  RegisterPayload,
  AuthContextType,
} from "./types"

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    } catch {
      return null
    }
  })

  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Validate existing token and load user profile
  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/v1/auth/me", {
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
      console.error("[Auth] Failed to validate user session:", err)
    }
    return null
  }, [])

  // Initial load
  useEffect(() => {
    let mounted = true
    const initAuth = async () => {
      if (token) {
        await fetchCurrentUser(token)
      }
      if (mounted) {
        setIsLoading(false)
      }
    }
    initAuth()

    // Listen to cross-window or internal session expiration events
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
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("auth:expired", handleAuthExpired)
    }
  }, [token, fetchCurrentUser])

  // Login handler
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: credentials.email.trim().toLowerCase(),
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
        // Ignore storage errors in restricted iframes
      }

      setToken(accessToken)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  // Register handler
  const register = async (payload: RegisterPayload) => {
    setIsLoading(true)
    try {
      const timezone =
        payload.timezone ||
        (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
        "UTC"

      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: payload.email.trim().toLowerCase(),
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

  // Logout handler
  const logout = async () => {
    try {
      if (token) {
        await fetch("/api/v1/auth/logout", {
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
