/**
 * ProtectedRoute: Enforces authentication on private application routes.
 * Redirects unauthenticated visitors to /login preserving the intended destination.
 */

import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "./AuthContext"
import { LoadingState } from "@/components/LoadingState"

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "student" | "teacher" | "admin"
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Vérification de la session en cours..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
