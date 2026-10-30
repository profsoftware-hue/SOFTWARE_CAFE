import type { Permission, Role } from '@/types/api'

export const groupPermissionsByModule = (
  permissions: Permission[],
): Array<{ module: string; permissions: Permission[] }> => {
  const groups = new Map<string, Permission[]>()

  for (const permission of permissions) {
    const current = groups.get(permission.module) ?? []
    current.push(permission)
    groups.set(permission.module, current)
  }

  return Array.from(groups.entries()).map(([module, items]) => ({
    module,
    permissions: items,
  }))
}

export const effectivePermissions = (roles: Role[], roleCodes: string[]): Permission[] => {
  const selected = roles.filter((role) => roleCodes.includes(role.code))
  const unique = new Map<string, Permission>()

  for (const role of selected) {
    for (const permission of role.permissions ?? []) {
      unique.set(permission.code, permission)
    }
  }

  return Array.from(unique.values()).sort((left, right) => left.name.localeCompare(right.name))
}
