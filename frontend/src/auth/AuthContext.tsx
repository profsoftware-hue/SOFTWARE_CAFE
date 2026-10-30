import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { getMe, loginRequest, logoutRequest, type LoginPayload } from '@/api/auth'
import { AuthContext, type AuthContextValue, type SessionData } from '@/auth/context'
import { hasPermissionCode } from '@/lib/permissions'
import type { User } from '@/types/api'

const STORAGE_KEY = 'ccp_auth_session'

const persistSession = (session: SessionData | null) => {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

const readStoredSession = (): SessionData | null => {
  localStorage.removeItem('ccp_token')
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<SessionData>
    if (!parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return {
      userId: parsed.userId ?? 0,
      username: parsed.username ?? '',
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      expiresAt: parsed.expiresAt,
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<SessionData | null>(() => readStoredSession())
  const [profile, setProfile] = useState<User | null>(null)

  const logout = useCallback(() => {
    void logoutRequest().catch(() => undefined)
    persistSession(null)
    setSession(null)
    setProfile(null)
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload)

    const nextSession: SessionData = {
      userId: response.user_id,
      username: response.username,
      roles: response.roles ?? [],
      permissions: response.permissions ?? [],
      expiresAt: Date.now() + response.expires_in * 1000,
    }

    persistSession(nextSession)
    setSession(nextSession)

    try {
      const me = await getMe()
      setProfile(me)
    } catch {
      setProfile(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const me = await getMe()
      setProfile(me)
      setSession((previous) => {
        if (!previous) return previous
        const next: SessionData = {
          ...previous,
          roles: me.roles.map((role) => role.code),
          permissions: me.permissions ?? [],
        }
        persistSession(next)
        return next
      })
    } catch {
      logout()
    }
  }, [logout])

  const restoredSession = useRef(false)
  useEffect(() => {
    if (restoredSession.current) return
    restoredSession.current = true
    if (session) {
      queueMicrotask(() => {
        void refreshProfile()
      })
    }
  }, [refreshProfile, session])

  const permissions = useMemo(() => {
    if (profile) return profile.permissions ?? []
    return session?.permissions ?? []
  }, [profile, session])

  const roleCodes = useMemo(() => {
    if (profile) return profile.roles.map((role) => role.code)
    return session?.roles ?? []
  }, [profile, session])

  const hasPermission = useCallback(
    (permission: string): boolean => hasPermissionCode(roleCodes, permissions, permission),
    [permissions, roleCodes],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      permissions,
      isAuthenticated: Boolean(session),
      hasPermission,
      login,
      refreshProfile,
      logout,
    }),
    [hasPermission, login, logout, permissions, profile, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
