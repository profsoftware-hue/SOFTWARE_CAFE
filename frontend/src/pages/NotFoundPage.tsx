import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card title="Página no encontrada" subtitle="La ruta solicitada no existe en el sistema CCP Pereira.">
        <Link to="/dashboard">
          <Button>Ir al dashboard</Button>
        </Link>
      </Card>
    </div>
  )
}
