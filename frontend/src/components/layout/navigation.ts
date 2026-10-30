import {
  BadgeDollarSign,
  Boxes,
  Cog,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

import type { RoleCode } from '@/types/api'

export interface NavItem {
  label: string
  path: string
  icon: typeof LayoutDashboard
  roles?: RoleCode[]
}

export const navigationItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Inventario', path: '/inventario', icon: Boxes },
  { label: 'Ventas / POS', path: '/pos', icon: BadgeDollarSign, roles: ['ADMIN', 'SELLER'] },
  { label: 'Reportes', path: '/reportes', icon: ShieldCheck },
  { label: 'Usuarios', path: '/usuarios', icon: UserCog, roles: ['ADMIN'] },
  { label: 'Configuración', path: '/configuracion', icon: Cog },
]

export const findTitleFromPath = (pathname: string): string => {
  const matched = navigationItems.find((item) => pathname.startsWith(item.path))
  return matched?.label ?? 'CCP Pereira'
}
