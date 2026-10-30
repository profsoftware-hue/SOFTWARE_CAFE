import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listRoles } from '@/api/security'
import { createUser, listUsers, updateUser, type UserCreatePayload, type UserUpdatePayload } from '@/api/users'
import { useAuth } from '@/auth/context'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/format'
import { effectivePermissions } from '@/pages/security/helpers'
import type { User } from '@/types/api'

interface UserFormState {
  full_name: string
  email: string
  username: string
  password: string
  role_codes: string[]
}

const initialUserForm = (roleCode = ''): UserFormState => ({
  full_name: '',
  email: '',
  username: '',
  password: '',
  role_codes: roleCode ? [roleCode] : [],
})

export const UsersTab = () => {
  const queryClient = useQueryClient()
  const { hasPermission, refreshProfile, session } = useAuth()
  const canManage = hasPermission('users.manage')
  const isAdmin = session?.roles.includes('ADMIN') ?? false

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormState>(() => initialUserForm())
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: listRoles })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      setModalOpen(false)
      setForm(initialUserForm())
      setError(null)
      setMessage('Usuario creado correctamente.')
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UserUpdatePayload }) =>
      updateUser(userId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      if (variables.userId === session?.userId) {
        void refreshProfile()
      }
      setModalOpen(false)
      setError(null)
      setMessage('Usuario actualizado correctamente.')
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const nextDefaultRole = (): string => {
    const roles = rolesQuery.data ?? []
    return roles.find((role) => role.code === 'SELLER')?.code ?? roles[0]?.code ?? ''
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setForm(initialUserForm(nextDefaultRole()))
    setError(null)
    setModalOpen(true)
  }

  const openEditModal = (user: User) => {
    if (!isAdmin && user.roles.some((role) => role.code === 'ADMIN')) {
      setError('Solo un administrador puede editar una cuenta administradora.')
      setMessage(null)
      return
    }
    setEditingUser(user)
    setForm({
      full_name: user.full_name,
      email: user.email,
      username: user.username,
      password: '',
      role_codes: user.roles.map((role) => role.code),
    })
    setError(null)
    setModalOpen(true)
  }

  const toggleRole = (roleCode: string) => {
    setForm((previous) => {
      const exists = previous.role_codes.includes(roleCode)
      const nextRoles = exists
        ? previous.role_codes.filter((code) => code !== roleCode)
        : [...previous.role_codes, roleCode]
      return { ...previous, role_codes: nextRoles }
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (form.role_codes.length === 0) {
      setError('Selecciona al menos un rol.')
      return
    }

    const payload: UserCreatePayload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      username: form.username.trim(),
      password: form.password,
      role_codes: form.role_codes,
    }

    if (editingUser) {
      updateMutation.mutate({
        userId: editingUser.id,
        payload: {
          full_name: payload.full_name,
          email: payload.email,
          username: payload.username,
          password: payload.password || undefined,
          role_codes: payload.role_codes,
        },
      })
      return
    }

    if (!form.password) {
      setError('La contraseña es obligatoria para crear el usuario.')
      return
    }

    createMutation.mutate(payload)
  }

  const toggleActive = (user: User) => {
    setMessage(null)
    setError(null)
    updateMutation.mutate({
      userId: user.id,
      payload: { is_active: !user.is_active },
    })
  }

  const roles = rolesQuery.data ?? []
  const assignableRoles = isAdmin ? roles : roles.filter((role) => role.code !== 'ADMIN')
  const selectedPermissions = effectivePermissions(assignableRoles, form.role_codes)

  return (
    <div className="space-y-5">
      <Card
        title="Usuarios"
        subtitle="Cada usuario recibe uno o varios roles y hereda sus permisos"
        actions={
          canManage ? (
            <Button type="button" onClick={openCreateModal}>
              <Plus size={16} className="mr-1" />
              Nuevo usuario
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

      {usersQuery.isLoading ? <Loading message="Cargando usuarios..." /> : null}

      {!usersQuery.isLoading && (!usersQuery.data || usersQuery.data.length === 0) ? (
        <EmptyState
          title="No hay usuarios"
          description="Crea el primer usuario desde el botón Nuevo usuario."
        />
      ) : null}

      {usersQuery.data && usersQuery.data.length > 0 ? (
        <Card>
          <Table
            columns={[
              'Nombre',
              'Usuario',
              'Roles',
              'Permisos',
              'Estado',
              { label: 'Creado', className: 'hidden xl:table-cell' },
              'Acciones',
            ]}
          >
            {usersQuery.data.map((user) => {
              const isSelf = user.id === session?.userId
              const canEditUser =
                canManage && (isAdmin || !user.roles.some((role) => role.code === 'ADMIN'))
              return (
                <tr key={user.id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{user.full_name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-3 py-2.5">{user.username}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((role) => (
                        <Badge key={`${user.id}-${role.code}`} variant="default">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="success">{user.permissions?.length ?? 0}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={user.is_active ? 'success' : 'warning'}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-slate-500 xl:table-cell">
                    {formatDateTime(user.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    {canManage ? (
                      canEditUser ? (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" onClick={(): void => openEditModal(user)}>
                            <Pencil size={14} className="mr-1" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isSelf && user.is_active}
                            title={isSelf && user.is_active ? 'No puedes desactivar tu propio usuario' : undefined}
                            onClick={(): void => toggleActive(user)}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Solo administrador</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">Solo lectura</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={(): void => setModalOpen(false)}
        title={editingUser ? 'Editar usuario' : 'Crear usuario'}
        description="Los permisos se calculan automáticamente a partir de los roles seleccionados."
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Nombre completo"
              value={form.full_name}
              onChange={(event): void => setForm((previous) => ({ ...previous, full_name: event.target.value }))}
              required
            />
            <Input
              label="Correo"
              type="email"
              value={form.email}
              onChange={(event): void => setForm((previous) => ({ ...previous, email: event.target.value }))}
              required
            />
            <Input
              label="Usuario"
              value={form.username}
              onChange={(event): void => setForm((previous) => ({ ...previous, username: event.target.value }))}
              required
            />
            <Input
              label={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={(event): void => setForm((previous) => ({ ...previous, password: event.target.value }))}
              required={!editingUser}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Roles asignados</p>
            {rolesQuery.isLoading ? <p className="mt-1 text-xs text-slate-500">Cargando roles...</p> : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {assignableRoles.map((role) => {
                const checked = form.role_codes.includes(role.code)
                return (
                  <label
                    key={role.code}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={(): void => toggleRole(role.code)}
                    />
                    <span>
                      <span className="block font-medium text-slate-800">{role.name}</span>
                      <span className="block text-xs text-slate-500">
                        {role.code} · {role.permissions?.length ?? 0} permisos
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-sm font-semibold text-blue-900">
              Permisos efectivos: {selectedPermissions.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedPermissions.map((permission) => (
                <Badge key={permission.code} variant="default">
                  {permission.name}
                </Badge>
              ))}
              {selectedPermissions.length === 0 ? (
                <span className="text-xs text-blue-800">Selecciona un rol para ver sus permisos.</span>
              ) : null}
            </div>
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
