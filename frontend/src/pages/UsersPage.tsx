import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { createUser, listUsers, updateUser } from '@/api/users'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/format'
import type { RoleCode, User } from '@/types/api'

const roleOptions: RoleCode[] = ['ADMIN', 'SELLER', 'WAREHOUSE']

interface UserFormState {
  full_name: string
  email: string
  username: string
  password: string
  role_codes: RoleCode[]
}

const initialUserForm = (): UserFormState => ({
  full_name: '',
  email: '',
  username: '',
  password: '',
  role_codes: ['SELLER'],
})

export const UsersPage = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormState>(() => initialUserForm())
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
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
    mutationFn: ({ userId, payload }: { userId: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(userId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setMessage('Usuario actualizado correctamente.')
      setError(null)
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const toggleRole = (role: RoleCode) => {
    setForm((prev) => {
      const exists = prev.role_codes.includes(role)
      const nextRoles = exists ? prev.role_codes.filter((value) => value !== role) : [...prev.role_codes, role]
      return { ...prev, role_codes: nextRoles }
    })
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setForm(initialUserForm())
    setError(null)
    setModalOpen(true)
  }

  const openEditModal = (user: User) => {
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (form.role_codes.length === 0) {
      setError('Selecciona al menos un rol.')
      return
    }

    if (editingUser) {
      updateMutation.mutate({
        userId: editingUser.id,
        payload: {
          full_name: form.full_name,
          email: form.email,
          username: form.username,
          password: form.password || undefined,
          role_codes: form.role_codes,
        },
      })
      return
    }

    if (!form.password) {
      setError('La contraseña es obligatoria para crear usuario.')
      return
    }

    createMutation.mutate({
      full_name: form.full_name,
      email: form.email,
      username: form.username,
      password: form.password,
      role_codes: form.role_codes,
    })
  }

  const toggleActive = (user: User) => {
    updateMutation.mutate({
      userId: user.id,
      payload: {
        is_active: !user.is_active,
      },
    })
  }

  return (
    <div className="space-y-5">
      <Card
        title="Usuarios y roles"
        subtitle="Administradores, vendedores y personal de bodega"
        actions={
          <Button type="button" onClick={openCreateModal}>
            <Plus size={16} className="mr-1" />
            Nuevo usuario
          </Button>
        }
      >
        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
      </Card>

      {usersQuery.isLoading ? <Loading message="Cargando usuarios..." /> : null}

      {!usersQuery.isLoading && (!usersQuery.data || usersQuery.data.length === 0) ? (
        <EmptyState
          title="No hay usuarios"
          description="Usa el botón de nuevo usuario o bootstrap admin desde el login."
        />
      ) : null}

      {usersQuery.data && usersQuery.data.length > 0 ? (
        <Card>
          <Table
            columns={[
              'Nombre',
              'Usuario',
              'Roles',
              'Estado',
              { label: 'Creado', className: 'hidden xl:table-cell' },
              'Acciones',
            ]}
          >
            {usersQuery.data.map((user) => (
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
                        {role.code}
                      </Badge>
                    ))}
                  </div>
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
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={(): void => openEditModal(user)}>
                      <Pencil size={14} className="mr-1" />
                      Editar
                    </Button>
                    <Button type="button" variant="ghost" onClick={(): void => toggleActive(user)}>
                      {user.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={(): void => setModalOpen(false)}
        title={editingUser ? 'Editar usuario' : 'Crear usuario'}
      >
        <form className="space-y-3" onSubmit={submit}>
          <Input
            label="Nombre completo"
            value={form.full_name}
            onChange={(event): void => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            required
          />
          <Input
            label="Correo"
            type="email"
            value={form.email}
            onChange={(event): void => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
          <Input
            label="Usuario"
            value={form.username}
            onChange={(event): void => setForm((prev) => ({ ...prev, username: event.target.value }))}
            required
          />
          <Input
            label={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password"
            value={form.password}
            onChange={(event): void => setForm((prev) => ({ ...prev, password: event.target.value }))}
            required={!editingUser}
          />

          <div>
            <p className="text-sm font-medium text-slate-700">Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roleOptions.map((role) => {
                const checked = form.role_codes.includes(role)
                return (
                  <label
                    key={role}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                  >
                    <input type="checkbox" checked={checked} onChange={(): void => toggleRole(role)} />
                    {role}
                  </label>
                )
              })}
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
