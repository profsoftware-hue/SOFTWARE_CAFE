import {
  BadgeDollarSign,
  Boxes,
  Cog,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: typeof LayoutDashboard
  permissions?: string[]
}

export const navigationItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Inventario', path: '/inventario', icon: Boxes, permissions: ['inventory.view'] },
  { label: 'Ventas / POS', path: '/pos', icon: BadgeDollarSign, permissions: ['sales.create'] },
  { label: 'Reportes', path: '/reportes', icon: ShieldCheck, permissions: ['reports.view'] },
  {
    label: 'Usuarios y permisos',
    path: '/usuarios',
    icon: UserCog,
    permissions: ['users.view', 'roles.view'],
  },
  { label: 'Configuración', path: '/configuracion', icon: Cog, permissions: ['settings.view'] },
]

export const findTitleFromPath = (pathname: string): string => {
  const matched = navigationItems.find((item) => pathname.startsWith(item.path))
  return matched?.label ?? 'CCP Pereira'
}
