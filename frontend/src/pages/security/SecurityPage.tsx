import { KeyRound, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useAuth } from '@/auth/context'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { PermissionsTab } from '@/pages/security/PermissionsTab'
import { RolesTab } from '@/pages/security/RolesTab'
import { UsersTab } from '@/pages/security/UsersTab'

type SecurityTab = 'users' | 'roles' | 'permissions'

const tabIcons = {
  users: Users,
  roles: ShieldCheck,
  permissions: KeyRound,
}

export const SecurityPage = () => {
  const { hasPermission } = useAuth()
  const canViewUsers = hasPermission('users.view')
  const canViewRoles = hasPermission('roles.view')

  const tabs = useMemo(
    () => [
      ...(canViewUsers ? [{ id: 'users' as const, label: 'Usuarios' }] : []),
      ...(canViewRoles
        ? [
            { id: 'roles' as const, label: 'Roles' },
            { id: 'permissions' as const, label: 'Permisos' },
          ]
        : []),
    ],
    [canViewRoles, canViewUsers],
  )

  const [selectedTab, setSelectedTab] = useState<SecurityTab>(tabs[0]?.id ?? 'users')
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : (tabs[0]?.id ?? 'users')

  return (
    <div className="space-y-5">
      <Card
        title="Usuarios, roles y permisos"
        subtitle="Administra el acceso al sistema mediante roles y permisos por módulo"
      >
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.id]
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={(): void => setSelectedTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </Card>

      {activeTab === 'users' ? <UsersTab /> : null}
      {activeTab === 'roles' ? <RolesTab /> : null}
      {activeTab === 'permissions' ? <PermissionsTab /> : null}
    </div>
  )
}
