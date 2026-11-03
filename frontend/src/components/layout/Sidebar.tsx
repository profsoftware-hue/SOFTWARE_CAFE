import { LogOut, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import logoCcp from '@/assets/logo_ccp.svg'
import { useAuth } from '@/auth/context'
import { navigationItems } from '@/components/layout/navigation'
import { cn } from '@/lib/cn'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export const Sidebar = ({ mobileOpen, onCloseMobile }: SidebarProps) => {
  const { session, logout, hasPermission } = useAuth()

  const visibleItems = navigationItems.filter((item) => {
    if (!item.permissions || item.permissions.length === 0) return true
    return item.permissions.some((permission) => hasPermission(permission))
  })

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-56 flex-col overflow-y-auto border-r border-blue-900/30 bg-ccp-gradient px-2.5 py-3 text-white shadow-lg',
          'transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <img
              src={logoCcp}
              alt="Cámara de Comercio de Pereira"
              className="h-8 w-auto brightness-0 invert"
            />
            <h1 className="mt-1 text-base font-bold tracking-tight">CCP Pereira</h1>
            <p className="text-[10px] uppercase tracking-[0.14em] text-blue-100/90">Inventario y Ventas</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 p-1 text-slate-300 lg:hidden"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md border-l-2 px-2.5 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'border-cyan-300 bg-white/15 text-white'
                      : 'border-transparent text-blue-50/90 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-white/15 pt-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-blue-100/70">Usuario</p>
              <p className="truncate text-xs font-semibold text-white">{session?.username ?? 'Sin sesión'}</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-white/25 p-1.5 text-white transition-colors hover:bg-white/15"
              onClick={logout}
              title="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onCloseMobile}
        />
      ) : null}
    </>
  )
}
