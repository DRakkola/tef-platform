/**
 * Comprehensive integration tests for the Authentication Flow:
 * - LoginPage (login & register tabs, demo credentials shortcut)
 * - AuthContext & useAuth hook (token storage, login, logout)
 * - ProtectedRoute redirection
 * - Error handling & resilient session recovery
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { AuthProvider, useAuth } from "@/features/auth/AuthContext"
import { LoginPage } from "@/features/auth/LoginPage"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"

describe("Authentication Flow & Session Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it("renders LoginPage with email, password inputs, and demo credentials buttons", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(screen.getByText("Portail de préparation TEF")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connexion" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer un compte" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("candidat@exemple.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Étudiant Démo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Admin Démo" })).toBeInTheDocument()
  })

  it("populates demo credentials when clicking Étudiant Démo", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    const demoStudentBtn = screen.getByRole("button", { name: "Étudiant Démo" })
    fireEvent.click(demoStudentBtn)

    const emailInput = screen.getByPlaceholderText("candidat@exemple.com") as HTMLInputElement
    expect(emailInput.value).toBe("student.demo@example.com")
  })

  it("switches to registration tab and displays target exam & level selectors", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    const registerTabBtn = screen.getByRole("button", { name: "Créer un compte" })
    fireEvent.click(registerTabBtn)

    expect(screen.getByText("Épreuve visée")).toBeInTheDocument()
    expect(screen.getByText("Niveau cible")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Créer mon compte" })).toBeInTheDocument()
  })

  it("authenticates successfully and saves auth_token to localStorage", async () => {
    const mockTokenResponse = {
      access_token: "jwt_token_student_12345",
      refresh_token: "refresh_token_abcde",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: "student-id-1",
        email: "student.demo@example.com",
        role: "student",
        first_name: "Jean",
        last_name: "Valjean",
      },
    }

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes("/api/v1/auth/login")) {
        return {
          ok: true,
          json: async () => mockTokenResponse,
        } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )

    // Click demo button to fill
    fireEvent.click(screen.getByRole("button", { name: "Étudiant Démo" }))

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Se connecter" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBe("jwt_token_student_12345")
    })

    expect(await screen.findByText("Dashboard Destination")).toBeInTheDocument()
  })

  it("displays error alert when login fails with invalid credentials", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Adresse courriel ou mot de passe incorrect.",
          },
        }),
      } as Response
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    fireEvent.change(screen.getByPlaceholderText("candidat@exemple.com"), {
      target: { value: "wrong@test.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "WrongPass123!" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }))

    expect(
      await screen.findByText("Adresse courriel ou mot de passe incorrect.")
    ).toBeInTheDocument()
    expect(localStorage.getItem("auth_token")).toBeNull()
  })

  it("redirects unauthenticated users to /login via ProtectedRoute", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page Redirected</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )

    expect(screen.getByText("Login Page Redirected")).toBeInTheDocument()
    expect(screen.queryByText("Secret Protected Content")).not.toBeInTheDocument()
  })

  it("clears session and localStorage on logout", async () => {
    localStorage.setItem("auth_token", "existing_valid_token")

    const TestLogoutComponent = () => {
      const { isAuthenticated, logout } = useAuth()
      return (
        <div>
          <span>{isAuthenticated ? "User Authenticated" : "User Logged Out"}</span>
          <button onClick={() => logout()}>Log out</button>
        </div>
      )
    }

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes("/api/v1/auth/me")) {
        return {
          ok: true,
          json: async () => ({ id: "1", email: "user@test.com", role: "student" }),
        } as Response
      }
      if (url.includes("/api/v1/auth/logout")) {
        return { ok: true, json: async () => ({ message: "Logged out" }) } as Response
      }
      return { ok: false, status: 404 } as Response
    })

    render(
      <AuthProvider>
        <MemoryRouter>
          <TestLogoutComponent />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(await screen.findByText("User Authenticated")).toBeInTheDocument()

    // Trigger logout
    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBeNull()
    })

    expect(screen.getByText("User Logged Out")).toBeInTheDocument()
  })
})
