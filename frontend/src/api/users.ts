import { apiClient } from '@/api/client'
import type { RoleCode, User } from '@/types/api'

export interface UserCreatePayload {
  full_name: string
  email: string
  username: string
  password: string
  role_codes: RoleCode[]
}

export interface UserUpdatePayload {
  full_name?: string
  email?: string
  username?: string
  password?: string
  is_active?: boolean
  role_codes?: RoleCode[]
}

export const listUsers = async (): Promise<User[]> => {
  const { data } = await apiClient.get<User[]>('/users', {
    params: { limit: 200 },
  })
  return data
}

export const createUser = async (payload: UserCreatePayload): Promise<User> => {
  const { data } = await apiClient.post<User>('/users', payload)
  return data
}

export const updateUser = async (userId: number, payload: UserUpdatePayload): Promise<User> => {
  const { data } = await apiClient.put<User>(`/users/${userId}`, payload)
  return data
}
