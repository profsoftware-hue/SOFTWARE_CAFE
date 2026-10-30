import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { getMe, loginRequest, logoutRequest, type LoginPayload } from '@/api/auth'
import { AuthContext, type AuthContextValue, type SessionData } from '@/auth/context'
import type { User } from '@/types/api'

const STORAGE_KEY = 'ccp_auth_session'

const readStoredSession = (): SessionData | null => {
  localStorage.removeItem('ccp_token')
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SessionData
    if (!parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
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
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setProfile(null)
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload)

    const nextSession: SessionData = {
      userId: response.user_id,
      username: response.username,
      roles: response.roles,
      expiresAt: Date.now() + response.expires_in * 1000,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
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
    } catch {
      logout()
    }
  }, [logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isAuthenticated: Boolean(session),
      login,
      refreshProfile,
      logout,
    }),
    [login, logout, profile, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
