import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
  type RoleCreatePayload,
} from '@/api/security'
import { useAuth } from '@/auth/context'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { expandPermissions } from '@/lib/permissions'
import { groupPermissionsByModule } from '@/pages/security/helpers'
import type { Role } from '@/types/api'

interface RoleFormState {
  code: string
  name: string
  description: string
  permission_codes: string[]
}

const initialRoleForm = (): RoleFormState => ({
  code: '',
  name: '',
  description: '',
  permission_codes: [],
})

export const RolesTab = () => {
  const queryClient = useQueryClient()
  const { hasPermission, permissions: actorPermissions, refreshProfile, session } = useAuth()
  const canManage = hasPermission('roles.manage')
  const isAdmin = session?.roles.includes('ADMIN') ?? false
  const expandedActorPermissions = expandPermissions(actorPermissions)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleFormState>(() => initialRoleForm())
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: listPermissions })

  const reloadSecurity = () => {
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    void queryClient.invalidateQueries({ queryKey: ['permissions'] })
  }

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      reloadSecurity()
      setModalOpen(false)
      setForm(initialRoleForm())
      setError(null)
      setMessage('Rol creado correctamente.')
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: Parameters<typeof updateRole>[1] }) =>
      updateRole(roleId, payload),
    onSuccess: () => {
      reloadSecurity()
      void refreshProfile()
      setModalOpen(false)
      setError(null)
      setMessage('Rol actualizado correctamente.')
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      reloadSecurity()
      void refreshProfile()
      setError(null)
      setMessage('Rol eliminado correctamente.')
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const openCreateModal = () => {
    setEditingRole(null)
    setForm(initialRoleForm())
    setError(null)
    setModalOpen(true)
  }

  const openEditModal = (role: Role) => {
    setEditingRole(role)
    setForm({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      permission_codes: (role.permissions ?? []).map((permission) => permission.code),
    })
    setError(null)
    setModalOpen(true)
  }

  const togglePermission = (permissionCode: string) => {
    if (editingRole?.code === 'ADMIN') return
    setForm((previous) => {
      const exists = previous.permission_codes.includes(permissionCode)
      return {
        ...previous,
        permission_codes: exists
          ? previous.permission_codes.filter((code) => code !== permissionCode)
          : [...previous.permission_codes, permissionCode],
      }
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!form.name.trim()) {
      setError('El nombre del rol es obligatorio.')
      return
    }

    if (editingRole) {
      updateMutation.mutate({
        roleId: editingRole.id,
        payload: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          permission_codes: editingRole.code === 'ADMIN' ? undefined : form.permission_codes,
        },
      })
      return
    }

    const payload: RoleCreatePayload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      permission_codes: form.permission_codes,
    }
    createMutation.mutate(payload)
  }

  const removeRole = (role: Role) => {
    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setMessage(null)
    setError(null)
    deleteMutation.mutate(role.id)
  }

  const permissions = permissionsQuery.data ?? []
  const availablePermissions = isAdmin
    ? permissions
    : permissions.filter((permission) => expandedActorPermissions.has(permission.code))
  const groups = groupPermissionsByModule(availablePermissions)
  const isAdminRole = editingRole?.code === 'ADMIN'

  const canEditRole = (role: Role): boolean => {
    if (!canManage) return false
    if (isAdmin) return true
    if (role.is_system) return false
    return !(role.permissions ?? []).some(
      (permission) => !expandedActorPermissions.has(permission.code),
    )
  }

  return (
    <div className="space-y-5">
      <Card
        title="Roles"
        subtitle="Agrupa permisos por función y asígnalos a los usuarios"
        actions={
          canManage ? (
            <Button type="button" onClick={openCreateModal}>
              <Plus size={16} className="mr-1" />
              Nuevo rol
            </Button>
          ) : null
        }
      >
        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error && !modalOpen ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
      </Card>

      {rolesQuery.isLoading ? <Loading message="Cargando roles..." /> : null}

      {!rolesQuery.isLoading && (!rolesQuery.data || rolesQuery.data.length === 0) ? (
        <EmptyState title="No hay roles" description="Crea un rol y asígnale los permisos necesarios." />
      ) : null}

      {rolesQuery.data && rolesQuery.data.length > 0 ? (
        <Card>
          <Table columns={['Rol', 'Tipo', 'Permisos', 'Usuarios', 'Acciones']}>
            {rolesQuery.data.map((role) => (
              <tr key={role.id}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-slate-800">{role.name}</p>
                  <p className="text-xs text-slate-500">{role.code}</p>
                  {role.description ? <p className="text-xs text-slate-400">{role.description}</p> : null}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={role.is_system ? 'warning' : 'default'}>
                    {role.is_system ? 'Sistema' : 'Personalizado'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="success">{role.permissions?.length ?? 0}</Badge>
                </td>
                <td className="px-3 py-2.5">{role.user_count ?? 0}</td>
                <td className="px-3 py-2.5">
                  {canManage ? (
                    canEditRole(role) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={(): void => openEditModal(role)}>
                          <Pencil size={14} className="mr-1" />
                          Editar
                        </Button>
                        {!role.is_system ? (
                          <Button
                            type="button"
                            variant="danger"
                            disabled={(role.user_count ?? 0) > 0}
                            title={
                              (role.user_count ?? 0) > 0
                                ? 'Reasigna los usuarios antes de eliminar el rol'
                                : undefined
                            }
                            onClick={(): void => removeRole(role)}
                          >
                            <Trash2 size={14} className="mr-1" />
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Solo administrador</span>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">Solo lectura</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={(): void => setModalOpen(false)}
        title={editingRole ? 'Editar rol' : 'Crear rol'}
        description="Selecciona los permisos que heredarán los usuarios con este rol."
        className="max-w-4xl"
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Código"
              value={form.code}
              onChange={(event): void =>
                setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))
              }
              helperText="Mayúsculas, números y guion bajo. Ej.: SUPERVISOR"
              disabled={Boolean(editingRole)}
              required
            />
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event): void => setForm((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </div>
          <Input
            label="Descripción"
            value={form.description}
            onChange={(event): void => setForm((previous) => ({ ...previous, description: event.target.value }))}
          />

          {isAdminRole ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              El rol ADMIN conserva todos los permisos del sistema y no se puede modificar.
            </div>
          ) : null}

          {permissionsQuery.isLoading ? <Loading message="Cargando permisos..." /> : null}

          <div className="space-y-3">
            {groups.map((group) => (
              <section key={group.module} className="rounded-lg border border-slate-200 p-3">
                <h4 className="text-sm font-semibold text-slate-800">{group.module}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const checked = isAdminRole || form.permission_codes.includes(permission.code)
                    return (
                      <label
                        key={permission.code}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={isAdminRole}
                          onChange={(): void => togglePermission(permission.code)}
                        />
                        <span>
                          <span className="block font-medium text-slate-800">{permission.name}</span>
                          <span className="block text-xs text-slate-500">{permission.code}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={(): void => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
