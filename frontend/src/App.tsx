import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PosPage } from '@/pages/PosPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { UsersPage } from '@/pages/UsersPage'

const RootRedirect = () => {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inventario" element={<InventoryPage />} />
        <Route path="/productos" element={<Navigate to="/inventario" replace />} />
        <Route path="/entradas" element={<Navigate to="/inventario" replace />} />
        <Route path="/salidas" element={<Navigate to="/inventario" replace />} />
        <Route path="/rotulos" element={<Navigate to="/pos" replace />} />
        <Route
          path="/pos"
          element={
            <ProtectedRoute allowRoles={['ADMIN', 'SELLER']}>
              <PosPage />
            </ProtectedRoute>
          }
        />
        <Route path="/reportes" element={<ReportsPage />} />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute allowRoles={['ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/configuracion" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
