import { FileText, Printer } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export const LabelsPage = () => {
  const [saleNumber, setSaleNumber] = useState('')
  const [summaryDate, setSummaryDate] = useState('')

  return (
    <div className="space-y-5">
      <Card
        title="Rótulos / comprobantes"
        subtitle="Módulo visual preparado para comprobantes con encabezado CCP Pereira"
      >
        <p className="text-sm text-slate-600">
          En Fase 4 se habilitará la generación final de PDF desde backend. En esta fase queda listo el
          flujo de operación desde frontend.
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Comprobante por venta" subtitle="Imprime un rótulo individual de factura/venta">
          <div className="space-y-3">
            <Input
              label="Número de venta"
              placeholder="Ej. VENTA-20261028150000-AB12CD"
              value={saleNumber}
              onChange={(event): void => setSaleNumber(event.target.value)}
            />
            <Button type="button" variant="secondary" disabled>
              <Printer size={16} className="mr-1" />
              Generar PDF de venta
            </Button>
          </div>
        </Card>

        <Card title="Resumen de cierre diario" subtitle="Rótulo consolidado del día con subtotal, IVA y total">
          <div className="space-y-3">
            <Input
              label="Fecha del cierre"
              type="date"
              value={summaryDate}
              onChange={(event): void => setSummaryDate(event.target.value)}
            />
            <Button type="button" variant="secondary" disabled>
              <FileText size={16} className="mr-1" />
              Generar PDF resumen diario
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
