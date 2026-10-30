import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import type { RoleCode } from '@/types/api'

interface ProtectedRouteProps {
  children: ReactNode
  allowRoles?: RoleCode[]
  allowPermissions?: string[]
}

export const ProtectedRoute = ({ children, allowRoles, allowPermissions }: ProtectedRouteProps) => {
  const location = useLocation()
  const { hasPermission, isAuthenticated, session } = useAuth()

  if (!isAuthenticated || !session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowRoles && allowRoles.length > 0) {
    const granted = allowRoles.some((role) => session.roles.includes(role))
    if (!granted) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (allowPermissions && allowPermissions.length > 0) {
    const granted = allowPermissions.some((permission) => hasPermission(permission))
    if (!granted) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
