import { apiClient } from '@/api/client'
import type { BootstrapAdminPayload, LoginResponse, User } from '@/types/api'

export interface LoginPayload {
  username: string
  password: string
}

export const loginRequest = async (payload: LoginPayload): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

export const logoutRequest = async (): Promise<void> => {
  await apiClient.post('/auth/logout')
}

export const bootstrapAdmin = async (payload: BootstrapAdminPayload): Promise<User> => {
  const { data } = await apiClient.post<User>('/auth/bootstrap-admin', payload)
  return data
}
