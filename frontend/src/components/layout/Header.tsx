import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import logoCcp from '@/assets/logo_ccp.svg'
import { useAuth } from '@/auth/context'
import { findTitleFromPath } from '@/components/layout/navigation'
import { Button } from '@/components/ui/Button'

interface HeaderProps {
  onOpenMobileMenu: () => void
}

export const Header = ({ onOpenMobileMenu }: HeaderProps) => {
  const { pathname } = useLocation()
  const { profile, session } = useAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="px-2 py-1.5 lg:hidden"
            onClick={onOpenMobileMenu}
          >
            <Menu size={16} />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src={logoCcp} alt="CCP Pereira" className="hidden h-6 w-auto sm:block" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-700">CCP Pereira</p>
            </div>
            <h2 className="truncate text-base font-semibold text-slate-800 sm:text-lg">
              {findTitleFromPath(pathname)}
            </h2>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <p className="truncate text-xs font-semibold text-slate-700 sm:text-sm">
            {profile?.full_name ?? profile?.username ?? session?.username ?? 'Usuario'}
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">Sistema Inventario y Ventas</p>
        </div>
      </div>
    </header>
  )
}
