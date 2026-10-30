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
import { SecurityPage } from '@/pages/security/SecurityPage'
import { SettingsPage } from '@/pages/SettingsPage'

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
        <Route
          path="/inventario"
          element={
            <ProtectedRoute allowPermissions={['inventory.view']}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="/productos" element={<Navigate to="/inventario" replace />} />
        <Route path="/entradas" element={<Navigate to="/inventario" replace />} />
        <Route path="/salidas" element={<Navigate to="/inventario" replace />} />
        <Route path="/rotulos" element={<Navigate to="/pos" replace />} />
        <Route
          path="/pos"
          element={
            <ProtectedRoute allowPermissions={['sales.create']}>
              <PosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute allowPermissions={['reports.view']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute allowPermissions={['users.view', 'roles.view']}>
              <SecurityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracion"
          element={
            <ProtectedRoute allowPermissions={['settings.view']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
