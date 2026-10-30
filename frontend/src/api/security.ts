import { apiClient } from '@/api/client'
import type { Permission, Role } from '@/types/api'

export interface RoleCreatePayload {
  code: string
  name: string
  description?: string | null
  permission_codes: string[]
}

export interface RoleUpdatePayload {
  name?: string
  description?: string | null
  permission_codes?: string[]
}

export const listRoles = async (): Promise<Role[]> => {
  const { data } = await apiClient.get<Role[]>('/roles')
  return data
}

export const listPermissions = async (): Promise<Permission[]> => {
  const { data } = await apiClient.get<Permission[]>('/permissions')
  return data
}

export const createRole = async (payload: RoleCreatePayload): Promise<Role> => {
  const { data } = await apiClient.post<Role>('/roles', payload)
  return data
}

export const updateRole = async (roleId: number, payload: RoleUpdatePayload): Promise<Role> => {
  const { data } = await apiClient.put<Role>(`/roles/${roleId}`, payload)
  return data
}

export const deleteRole = async (roleId: number): Promise<void> => {
  await apiClient.delete(`/roles/${roleId}`)
}
