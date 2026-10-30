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
  const { session, logout } = useAuth()

  const visibleItems = navigationItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true
    if (!session) return false
    return item.roles.some((role) => session.roles.includes(role))
  })

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-blue-900/30 bg-ccp-gradient px-3 py-4 text-white shadow-lg',
          'transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <img
              src={logoCcp}
              alt="Cámara de Comercio de Pereira"
              className="h-9 w-auto brightness-0 invert"
            />
            <h1 className="mt-1.5 text-lg font-bold tracking-tight">CCP Pereira</h1>
            <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100/90">Inventario y Ventas</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 p-1 text-slate-300 lg:hidden"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/20'
                      : 'text-blue-50/90 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-8 space-y-3 rounded-lg border border-white/20 bg-white/10 p-3">
          <p className="text-xs text-blue-100/80">Usuario activo</p>
          <p className="text-sm font-semibold text-white">{session?.username ?? 'Sin sesión'}</p>
          <button
            type="button"
            className="flex w-full items-center rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            onClick={logout}
          >
            <LogOut size={16} className="mr-2" />
            Cerrar sesión
          </button>
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
