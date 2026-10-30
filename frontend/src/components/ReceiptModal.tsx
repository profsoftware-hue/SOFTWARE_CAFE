import { Printer, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { formatCurrencyCOP, formatDateTime, formatNumber } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/payments'
import type { SaleReceipt } from '@/types/api'

interface ReceiptModalProps {
  open: boolean
  receipt: SaleReceipt | null
  loading?: boolean
  onClose: () => void
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const formatNit = (nit: string): string => {
  const digits = nit.replace(/\D/g, '')
  return digits.length === 10 ? digits.split('').join(' ') : nit
}

export const ReceiptModal = ({ open, receipt, loading = false, onClose }: ReceiptModalProps) => {
  if (!open) return null

  const printReceipt = () => {
    if (!receipt) return

    const rows = receipt.items
      .map(
        (item) => `
          <tr>
            <td class="qty">${formatNumber(item.quantity, 3)}</td>
            <td class="desc">
              ${escapeHtml(item.product_name)}
              ${item.barcode ? `<div class="small">Cod: ${escapeHtml(item.barcode)}</div>` : ''}
            </td>
            <td class="money">${formatCurrencyCOP(item.unit_price_excl_tax)}</td>
            <td class="money">${formatCurrencyCOP(item.line_total)}</td>
          </tr>
        `,
      )
      .join('')

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(receipt.sale_number)}</title>
<style>
  @page { size: 76mm auto; margin: 2mm 6.5mm; }
  html, body { margin: 0; padding: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; width: 63mm; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 6px; }
  .company { font-size: 13px; font-weight: bold; letter-spacing: .2px; }
  .meta { font-size: 9.5px; color: #333; line-height: 1.35; }
  .title { margin: 6px 0 3px; text-align: center; font-weight: bold; font-size: 11px; border-top: 1px dashed #555; border-bottom: 1px dashed #555; padding: 3px 0; }
  .data { margin: 5px 0; font-size: 9.5px; line-height: 1.4; }
  .data div { display: flex; justify-content: space-between; gap: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 3px; table-layout: fixed; }
  th { font-size: 8.5px; text-transform: uppercase; border-bottom: 1px solid #333; padding: 2px 1px; text-align: left; }
  td { padding: 2px 1px; vertical-align: top; border-bottom: 1px dotted #bbb; font-size: 9.5px; }
  .qty { width: 9mm; text-align: center; }
  .desc { width: auto; overflow-wrap: break-word; }
  .money { width: 15mm; text-align: right; white-space: nowrap; }
  .small { font-size: 8.5px; color: #555; }
  .totals { margin-top: 5px; font-size: 10px; }
  .totals div { display: flex; justify-content: space-between; padding: 1px 0; }
  .totals .total { font-size: 13px; font-weight: bold; border-top: 1px solid #333; margin-top: 2px; padding-top: 3px; }
  .footer { margin-top: 8px; text-align: center; font-size: 8.5px; color: #333; border-top: 1px dashed #555; padding-top: 5px; }
  .code { margin-top: 5px; text-align: center; font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: .5px; }
</style>
</head>
<body>
  <div class="header">
    <div class="meta" style="font-size:8.5px; text-transform:uppercase; letter-spacing:.4px;">Razón social</div>
    <div class="company">${escapeHtml(receipt.company_name)}</div>
    <div class="meta">
      ${receipt.company_nit ? `NIT: ${escapeHtml(formatNit(receipt.company_nit))}<br/>` : ''}
      ${receipt.company_address ? `${escapeHtml(receipt.company_address)}<br/>` : ''}
      ${receipt.company_phone ? `Tel: ${escapeHtml(receipt.company_phone)}` : ''}
    </div>
  </div>

  <div class="title">RECIBO DE VENTA</div>

  <div class="data">
    <div><span>No.</span><strong>${escapeHtml(receipt.sale_number)}</strong></div>
    <div><span>Fecha</span><span>${formatDateTime(receipt.sold_at)}</span></div>
    <div><span>Cliente</span><span>${escapeHtml(receipt.customer_name ?? 'Consumidor final')}</span></div>
    <div><span>Pago</span><span>${escapeHtml(PAYMENT_METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method)}</span></div>
    <div><span>Vendedor</span><span>${escapeHtml(receipt.seller_name ?? '-')}</span></div>
  </div>

  <table>
    <thead>
      <tr><th class="qty">Cant</th><th class="desc">Producto</th><th class="money">Vr. unit</th><th class="money">Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${formatCurrencyCOP(receipt.subtotal)}</span></div>
    <div><span>IVA</span><span>${formatCurrencyCOP(receipt.tax_total)}</span></div>
    <div class="total"><span>TOTAL</span><span>${formatCurrencyCOP(receipt.total)}</span></div>
  </div>

  <div class="footer">
    ¡Gracias por su compra!<br/>
    CCP Pereira - Inventario y Ventas
    <div class="code">${escapeHtml(receipt.sale_number)}</div>
  </div>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=420,height=720')
    if (!printWindow) {
      window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta de nuevo.')
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 print:static print:bg-white print:p-0">
      <section className="max-h-[92vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-xl print:max-h-none print:max-w-none print:overflow-visible print:shadow-none">
        <header className="mb-3 flex items-center justify-between gap-2 print:hidden">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Recibo de venta</h3>
            <p className="text-xs text-slate-500">Puedes imprimirlo o cerrarlo.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {loading ? <p className="text-sm text-slate-500">Cargando recibo...</p> : null}

        {receipt ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wide text-slate-400">Razón social</p>
              <p className="text-sm font-bold text-slate-900">{receipt.company_name}</p>
              {receipt.company_nit ? (
                <p className="text-[11px] text-slate-500">NIT: {formatNit(receipt.company_nit)}</p>
              ) : null}
              {receipt.company_address ? (
                <p className="text-[11px] text-slate-500">{receipt.company_address}</p>
              ) : null}
              {receipt.company_phone ? (
                <p className="text-[11px] text-slate-500">Tel: {receipt.company_phone}</p>
              ) : null}
            </div>

            <p className="my-2 border-y border-dashed border-slate-300 py-1 text-center text-xs font-bold uppercase tracking-wide text-slate-700">
              Recibo de venta
            </p>

            <div className="space-y-0.5 text-[11px] text-slate-600">
              <div className="flex justify-between gap-2">
                <span>No.</span>
                <strong className="text-slate-800">{receipt.sale_number}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Fecha</span>
                <span>{formatDateTime(receipt.sold_at)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Cliente</span>
                <span>{receipt.customer_name ?? 'Consumidor final'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pago</span>
                <span>{PAYMENT_METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method}</span>
              </div>
            </div>

            <table className="mt-2 w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-slate-300 text-[9px] uppercase text-slate-500">
                  <th className="py-1 text-center">Cant</th>
                  <th className="py-1 text-left">Producto</th>
                  <th className="py-1 text-right">Vr. unit</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={`${item.product_name}-${index}`} className="border-b border-dotted border-slate-200">
                    <td className="py-1 text-center">{formatNumber(item.quantity, 3)}</td>
                    <td className="py-1">
                      <p className="text-slate-800">{item.product_name}</p>
                      {item.barcode ? <p className="text-[9px] text-slate-400">Cod: {item.barcode}</p> : null}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">{formatCurrencyCOP(item.unit_price_excl_tax)}</td>
                    <td className="py-1 text-right whitespace-nowrap">{formatCurrencyCOP(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 space-y-0.5 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrencyCOP(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA</span>
                <span>{formatCurrencyCOP(receipt.tax_total)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCurrencyCOP(receipt.total)}</span>
              </div>
            </div>

            <p className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
              ¡Gracias por su compra!
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end gap-2 print:hidden">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={printReceipt} disabled={!receipt || loading}>
            <Printer size={16} className="mr-1.5" />
            Imprimir recibo
          </Button>
        </div>
      </section>
    </div>
  )
}
