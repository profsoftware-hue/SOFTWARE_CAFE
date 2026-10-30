const PERMISSION_IMPLICATIONS: Record<string, string[]> = {
  'inventory.manage': ['inventory.view'],
  'sales.create': ['inventory.view'],
  'users.manage': ['users.view'],
  'roles.manage': ['roles.view'],
  'settings.manage': ['settings.view'],
}

export const expandPermissions = (permissions: string[]): Set<string> => {
  const granted = new Set(permissions)
  for (const code of permissions) {
    for (const implied of PERMISSION_IMPLICATIONS[code] ?? []) {
      granted.add(implied)
    }
  }
  return granted
}

export const hasPermissionCode = (
  roleCodes: string[],
  permissions: string[],
  permission: string,
): boolean => roleCodes.includes('ADMIN') || expandPermissions(permissions).has(permission)
