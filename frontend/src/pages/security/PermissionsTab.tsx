import { useQuery } from '@tanstack/react-query'

import { listPermissions, listRoles } from '@/api/security'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loading } from '@/components/ui/Loading'
import { groupPermissionsByModule } from '@/pages/security/helpers'

export const PermissionsTab = () => {
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: listPermissions })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: listRoles })

  const permissions = permissionsQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const groups = groupPermissionsByModule(permissions)

  if (permissionsQuery.isLoading || rolesQuery.isLoading) {
    return <Loading message="Cargando permisos..." />
  }

  if (permissions.length === 0) {
    return <EmptyState title="No hay permisos" description="Ejecuta las migraciones del sistema." />
  }

  return (
    <div className="space-y-4">
      <Card
        title="Catálogo de permisos"
        subtitle={`${permissions.length} permisos disponibles, agrupados por módulo`}
      >
        <p className="text-sm text-slate-600">
          Los permisos son unidades de acceso que se asignan a los roles. Un usuario recibe la suma de
          los permisos de todos sus roles.
        </p>
      </Card>

      {groups.map((group) => (
        <Card key={group.module} title={group.module} subtitle={`${group.permissions.length} permisos`}>
          <div className="space-y-3">
            {group.permissions.map((permission) => {
              const assignedRoles = roles.filter((role) =>
                (role.permissions ?? []).some((item) => item.code === permission.code),
              )
              return (
                <article
                  key={permission.code}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{permission.name}</p>
                    <p className="text-xs text-slate-500">{permission.code}</p>
                    {permission.description ? (
                      <p className="text-xs text-slate-500">{permission.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedRoles.length > 0 ? (
                      assignedRoles.map((role) => (
                        <Badge key={`${permission.code}-${role.id}`} variant="default">
                          {role.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="warning">Sin asignar</Badge>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </Card>
      ))}
    </div>
  )
}
