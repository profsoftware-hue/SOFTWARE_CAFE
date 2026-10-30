import { Building2, Link as LinkIcon, Printer, Upload } from 'lucide-react'

import { API_BASE_URL } from '@/api/client'
import { Card } from '@/components/ui/Card'

export const SettingsPage = () => {
  const uploadBase = `${API_BASE_URL.replace('/api/v1', '')}/api/v1/uploads`

  return (
    <div className="space-y-5">
      <Card title="Configuración" subtitle="Parámetros visibles de la interfaz CCP Pereira">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <Building2 size={16} />
              <h3 className="font-semibold">Identidad corporativa</h3>
            </div>
            <p className="text-sm text-slate-600">
              Nombre comercial aplicado en todo el frontend: <strong>CCP Pereira</strong>.
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <LinkIcon size={16} />
              <h3 className="font-semibold">API Backend</h3>
            </div>
            <p className="break-all text-sm text-slate-600">{API_BASE_URL}</p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <Upload size={16} />
              <h3 className="font-semibold">Uploads protegidos</h3>
            </div>
            <p className="break-all text-sm text-slate-600">Ruta protegida por JWT: {uploadBase}/{'{file_path}'}</p>
          </article>
        </div>
      </Card>

      <Card
        title="Impresora Epson TM-U220"
        subtitle="Recibos y cierres en papel de 76 mm"
        actions={<Printer size={18} className="text-slate-500" />}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>
            Instala el driver de Epson y deja la <strong>EPSON TM-U220</strong> como impresora predeterminada
            de Windows.
          </li>
          <li>Configura el ancho de papel en <strong>76 mm</strong>.</li>
          <li>
            Para imprimir sin diálogo, abre el POS con{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">start-pos-silencioso.bat</code> o{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">start-pos-kiosco.bat</code>.
          </li>
          <li>
            Si usas el navegador normal, selecciona la TM-U220 una vez en el diálogo de impresión; Chrome
            recordará esa elección.
          </li>
        </ol>
        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Los navegadores no permiten elegir una impresora por código: siempre usan la predeterminada de
          Windows. Deja la TM-U220 como predeterminada para que los recibos salgan directo por ella.
        </p>
      </Card>
    </div>
  )
}
