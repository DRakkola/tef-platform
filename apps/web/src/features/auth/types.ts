export interface UserProfile {
  id: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  isActive: boolean;
  isVerified: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
