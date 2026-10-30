import { ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import logoCcp from '@/assets/logo_ccp.svg'
import { bootstrapAdmin } from '@/api/auth'
import { getApiErrorMessage } from '@/api/client'
import { useAuth } from '@/auth/context'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

interface LocationState {
  from?: {
    pathname?: string
  }
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const state = location.state as LocationState | null
  const redirectPath = state?.from?.pathname ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showBootstrap, setShowBootstrap] = useState(false)
  const [bootstrapLoading, setBootstrapLoading] = useState(false)
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [bootstrapForm, setBootstrapForm] = useState({
    full_name: '',
    email: '',
    username: '',
    password: '',
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login({ username: username.trim(), password })
      navigate(redirectPath, { replace: true })
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }

  const handleBootstrap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBootstrapMessage(null)
    setBootstrapError(null)
    setBootstrapLoading(true)

    try {
      await bootstrapAdmin(bootstrapForm)
      setBootstrapMessage('Administrador inicial creado correctamente. Ya puedes iniciar sesión.')
      setBootstrapForm({
        full_name: '',
        email: '',
        username: '',
        password: '',
      })
    } catch (unknownError) {
      setBootstrapError(getApiErrorMessage(unknownError))
    } finally {
      setBootstrapLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.2fr_1fr] lg:gap-6">
        <section className="relative overflow-hidden rounded-2xl bg-ccp-gradient p-6 text-white shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-blue-400/25 blur-2xl" />

          <div className="relative">
            <div className="mb-6 inline-flex rounded-xl bg-white/95 px-4 py-2.5 shadow-sm">
              <img src={logoCcp} alt="Cámara de Comercio de Pereira" className="h-12 w-auto" />
            </div>

            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">CCP Pereira</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">Sistema de Inventario y Ventas</h1>
            <p className="mt-3 max-w-lg text-blue-50/90">
              Plataforma web tipo ERP para gestión de productos, inventario, POS, reportes y rótulos
              corporativos de CCP Pereira.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <h3 className="font-semibold">Inventario trazable</h3>
                <p className="mt-1 text-sm text-blue-50/80">Entradas, salidas, ajustes y kardex en tiempo real.</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <h3 className="font-semibold">POS con IVA</h3>
                <p className="mt-1 text-sm text-blue-50/80">Cálculo automático de subtotal, IVA y total por venta.</p>
              </article>
              <article className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:col-span-2">
                <h3 className="font-semibold">Identidad corporativa CCP Pereira</h3>
                <p className="mt-1 text-sm text-blue-50/80">
                  Nombre visible en login, encabezados y módulos de operación.
                </p>
              </article>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <Card title="Ingresar" subtitle="Accede con tu usuario autorizado">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Usuario o correo"
                name="username"
                value={username}
                onChange={(event): void => setUsername(event.target.value)}
                required
              />
              <Input
                label="Contraseña"
                name="password"
                type="password"
                value={password}
                onChange={(event): void => setPassword(event.target.value)}
                required
              />

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" loading={loading} className="w-full">
                Iniciar sesión
              </Button>
            </form>
          </Card>

          <Card
            title="Primer arranque"
            subtitle="Crear usuario administrador inicial"
            actions={
              <Button type="button" variant="secondary" onClick={(): void => setShowBootstrap((value) => !value)}>
                {showBootstrap ? 'Ocultar' : 'Mostrar'}
              </Button>
            }
          >
            {showBootstrap ? (
              <form className="space-y-3" onSubmit={handleBootstrap}>
                <Input
                  label="Nombre completo"
                  value={bootstrapForm.full_name}
                  onChange={(event): void =>
                    setBootstrapForm((prev) => ({ ...prev, full_name: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Correo"
                  type="email"
                  value={bootstrapForm.email}
                  onChange={(event): void =>
                    setBootstrapForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Usuario"
                  value={bootstrapForm.username}
                  onChange={(event): void =>
                    setBootstrapForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Contraseña"
                  type="password"
                  value={bootstrapForm.password}
                  onChange={(event): void =>
                    setBootstrapForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />

                {bootstrapMessage ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {bootstrapMessage}
                  </div>
                ) : null}

                {bootstrapError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {bootstrapError}
                  </div>
                ) : null}

                <Button type="submit" loading={bootstrapLoading} variant="secondary" className="w-full">
                  <ShieldCheck size={16} className="mr-1.5" />
                  Crear administrador
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                Si la base está recién configurada, habilita este bloque para crear el primer usuario admin.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
