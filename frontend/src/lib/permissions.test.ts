import { describe, expect, it } from 'vitest'

import { expandPermissions, hasPermissionCode } from '@/lib/permissions'

describe('permission helpers', () => {
  it('da acceso total al rol ADMIN', () => {
    expect(hasPermissionCode(['ADMIN'], [], 'cualquier.permiso')).toBe(true)
  })

  it('expande permisos de gestión a lectura', () => {
    const expanded = expandPermissions([
      'inventory.manage',
      'users.manage',
      'roles.manage',
      'settings.manage',
    ])

    expect(expanded).toEqual(
      new Set([
        'inventory.manage',
        'inventory.view',
        'users.manage',
        'users.view',
        'roles.manage',
        'roles.view',
        'settings.manage',
        'settings.view',
      ]),
    )
  })

  it('ventas implica consultar inventario', () => {
    expect(hasPermissionCode([], ['sales.create'], 'inventory.view')).toBe(true)
  })

  it('niega permisos no asignados', () => {
    expect(hasPermissionCode([], ['reports.view'], 'users.view')).toBe(false)
  })
})
