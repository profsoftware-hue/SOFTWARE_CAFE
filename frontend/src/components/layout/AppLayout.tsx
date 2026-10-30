import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'

export const AppLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={(): void => setMobileOpen(false)} />

      <div className="min-w-0 lg:ml-64">
        <Header onOpenMobileMenu={(): void => setMobileOpen(true)} />
        <main className="min-w-0 space-y-4 px-3 py-4 sm:px-5 sm:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
