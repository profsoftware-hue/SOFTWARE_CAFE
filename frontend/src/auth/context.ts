import { createContext, useContext } from 'react'

import type { LoginPayload } from '@/api/auth'
import type { RoleCode, User } from '@/types/api'

export interface SessionData {
  userId: number
  username: string
  roles: RoleCode[]
  permissions: string[]
  expiresAt: number
}

export interface AuthContextValue {
  session: SessionData | null
  profile: User | null
  permissions: string[]
  isAuthenticated: boolean
  hasPermission: (permission: string) => boolean
  login: (payload: LoginPayload) => Promise<void>
  refreshProfile: () => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
