export interface UserProfile {
  id: string
  email: string
  role: "student" | "teacher" | "admin"
  first_name?: string | null
  last_name?: string | null
  is_active?: boolean
  is_verified?: boolean
  target_exam?: string | null
  target_level?: string | null
}

export interface AuthState {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  role?: "student" | "teacher"
  target_exam?: string
  target_level?: string
  timezone?: string
  native_language?: string
  invitation_code?: string
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}
