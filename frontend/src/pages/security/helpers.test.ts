import { describe, expect, it } from 'vitest'

import { effectivePermissions, groupPermissionsByModule } from '@/pages/security/helpers'
import type { Permission, Role } from '@/types/api'

const permission = (code: string, module: string, name: string): Permission => ({
  id: 1,
  code,
  module,
  name,
  description: null,
})

const role = (id: number, code: string, permissions: Permission[]): Role => ({
  id,
  code,
  name: code,
  permissions,
})

describe('security helpers', () => {
  it('agrupa permisos por módulo conservando el orden', () => {
    const groups = groupPermissionsByModule([
      permission('users.view', 'Seguridad', 'Ver usuarios'),
      permission('users.manage', 'Seguridad', 'Gestionar usuarios'),
      permission('reports.view', 'Reportes', 'Ver reportes'),
    ])

    expect(groups.map((group) => group.module)).toEqual(['Seguridad', 'Reportes'])
    expect(groups[0].permissions).toHaveLength(2)
  })

  it('calcula la unión de permisos de varios roles sin duplicados', () => {
    const roles = [
      role(1, 'SELLER', [
        permission('sales.create', 'Ventas', 'Registrar ventas'),
        permission('inventory.view', 'Inventario', 'Ver inventario'),
      ]),
      role(2, 'REPORTS', [
        permission('inventory.view', 'Inventario', 'Ver inventario'),
        permission('reports.view', 'Reportes', 'Ver reportes'),
      ]),
    ]

    const result = effectivePermissions(roles, ['SELLER', 'REPORTS'])
    expect(result.map((item) => item.code)).toEqual([
      'sales.create',
      'inventory.view',
      'reports.view',
    ])
  })

  it('ignora roles no seleccionados', () => {
    const roles = [
      role(1, 'SELLER', [permission('sales.create', 'Ventas', 'Registrar ventas')]),
      role(2, 'ADMIN', [permission('users.manage', 'Seguridad', 'Gestionar usuarios')]),
    ]

    expect(effectivePermissions(roles, ['SELLER']).map((item) => item.code)).toEqual(['sales.create'])
  })
})
